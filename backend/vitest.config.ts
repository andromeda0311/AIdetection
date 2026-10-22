import { defineConfig } from 'vitest/config';

// Tests must not depend on a developer's backend/.env or a reachable database.
// Values set here take precedence over .env (dotenv never overrides existing vars).
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
      DB_SSL: 'false',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
      SIGNAL_TRANSPORT: 'log',
      YOLO_LIVE_ARDUINO_TRANSPORT: 'log',
      YOLO_INGEST_KEY: '',
    },
  },
});
