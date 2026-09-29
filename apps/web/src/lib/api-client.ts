const getBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const generateCorrelationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type OkResponse<D> = { data: D; status: number; headers: Headers };

export const customFetch = async <T extends OkResponse<unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-correlation-id': generateCorrelationId(),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = url.startsWith('http') ? url : `${getBaseUrl()}${url}`;

  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('authUser');
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  const data: unknown = contentType?.includes('application/json')
    ? await response.json()
    : undefined;

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};
