import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import routes from './routes/index.js';
import { AppDataSource } from './config/ormconfig.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiterUnlessYoloIngest } from './middleware/rateLimiter.js';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use(requestLogger);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Thesis Backend API',
    basePath: '/api',
    endpoints: {
      auth: '/api/auth/login',
      staff: '/api/staff',
      detections: '/api/detections',
      signal: '/api/signal',
    },
  });
});

app.get('/health', async (_req, res) => {
  try {
    await AppDataSource.query('SELECT 1');
    res.json({ success: true, status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ success: false, status: 'degraded', database: 'unreachable' });
  }
});

app.use('/api', apiRateLimiterUnlessYoloIngest);
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
