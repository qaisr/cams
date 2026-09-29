import { defineConfig } from 'orval';

export default defineConfig({
  appMsw: {
    input: {
      target: '../../packages/api-spec/generated/openapi.json',
    },
    output: {
      target: './src/mocks/generated/index.ts',
      client: 'react-query',
      httpClient: 'fetch',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
    },
  },
});
