import { createApp } from './bootstrap';

async function bootstrap() {
  const app = await createApp();
  const port = process.env['PORT'] ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.warn(`API running on http://localhost:${port}`);
}

void bootstrap();
