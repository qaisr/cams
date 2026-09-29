// Template: Next.js App Router error boundary
// File: apps/web/src/app/**/error.tsx  (per-segment)  or  app/global-error.tsx (root)
//
// App Router renders the nearest `error.tsx` when a Client/Server Component in
// that segment throws during render. It MUST be a Client Component and receives
// `{ error, reset }`. `reset()` re-renders the segment to retry.
//
// Placement:
//  - app/error.tsx            → catches errors in the whole app shell
//  - app/(dashboard)/error.tsx → scopes the boundary to that route group
//  - app/global-error.tsx     → replaces the ROOT layout (must render <html><body>)
//
// This is NOT for data-fetching errors inside React Query hooks — surface those
// inline with the hook's `error` state. Use this boundary for unexpected throws.
// See @.claude/standards/frontend-standards.md and (once created)
// @.claude/standards/error-handling-standards.md for RFC 7807 surfacing.

'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Report to the observability sink. `digest` correlates with the server log
    // for errors thrown in Server Components. Never render raw error details to
    // the user in production — they may contain sensitive internals.
    // logger.error('route-boundary', { message: error.message, digest: error.digest });
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-4 p-8">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-base-content/70">
        An unexpected error occurred. You can try again, or contact support if it persists.
      </p>
      {error.digest && (
        <p className="text-xs text-base-content/50">
          Reference: <code>{error.digest}</code>
        </p>
      )}
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Root variant: app/global-error.tsx — only fires for errors in the ROOT layout.
// It replaces the root layout, so it MUST render its own <html> and <body>.
//
// 'use client';
// export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
//   return (
//     <html lang="en">
//       <body>
//         <div role="alert">
//           <h2>Application error</h2>
//           <button type="button" onClick={reset}>Try again</button>
//         </div>
//       </body>
//     </html>
//   );
// }
