import { defineConfig } from 'orval';

export default defineConfig({
  app: {
    input: {
      target: '../../packages/api-spec/generated/openapi.json',
    },
    output: {
      target: './src/hooks/generated/index.ts',
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './src/lib/api-client.ts',
          name: 'customFetch',
        },
      },
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
    },
  },
});
