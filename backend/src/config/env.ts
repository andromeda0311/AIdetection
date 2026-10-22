import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().optional(),
  DB_NAME: z.string().default('postgres'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_SSL: z.enum(['true', 'false']).default('false'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  UPLOAD_DIR: z.string().default('./storage'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(200),
  UPLOAD_MAX_FILES_PER_REQUEST: z.coerce.number().int().positive().default(1),
  UPLOAD_ALLOWED_EXTENSIONS: z.string().default('mp4,mov,avi,mkv,webm,m4v'),
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .default('video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm'),

  DETECTION_MOCK: z.enum(['true', 'false']).default('true'),
  DETECTION_API_URL: z.string().default(''),
  DETECTION_API_KEY: z.string().default(''),
  DETECTION_API_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  DETECTION_MOCK_PEDESTRIANS: z.coerce.number().int().min(0).default(1),

  SIGNAL_TRANSPORT: z.enum(['log', 'serial', 'http']).default('log'),
  SIGNAL_SERIAL_PORT: z.string().default('COM3'),
  SIGNAL_BAUD: z.coerce.number().int().positive().default(9600),
  SIGNAL_YELLOW_MS: z.coerce.number().int().nonnegative().default(3000),
  SIGNAL_RED_MS: z.coerce.number().int().nonnegative().default(20_000),
  SIGNAL_CLEAR_GRACE_MS: z.coerce.number().int().nonnegative().default(2000),
  SIGNAL_ARDUINO_URL: z.string().default(''),

  YOLO_LIVE_DETECTION_THRESHOLD_MS: z.coerce.number().int().positive().default(5000),
  YOLO_LIVE_YELLOW_MS: z.coerce.number().int().nonnegative().default(3000),
  YOLO_LIVE_STOP_DURATION_MS: z.coerce.number().int().positive().default(15000),
  YOLO_LIVE_ARDUINO_TRANSPORT: z.enum(['log', 'serial']).default('log'),
  YOLO_LIVE_ARDUINO_PORT: z.string().default('COM3'),
  YOLO_LIVE_ARDUINO_BAUD: z.coerce.number().int().positive().default(9600),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  throw new Error(`Invalid environment configuration:\n  ${issues}`);
}

const env = parsed.data;

const databaseUrl =
  env.DATABASE_URL ??
  `postgres://${encodeURIComponent(env.DB_USER)}:${encodeURIComponent(env.DB_PASSWORD)}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

const config = {
  nodeEnv: env.NODE_ENV,
  host: env.HOST,
  port: env.PORT,
  logLevel: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,

  databaseUrl,
  dbSsl: env.DB_SSL === 'true',

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  },

  corsOrigins: env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),

  cookie: {
    secure: env.COOKIE_SECURE === 'true',
    sameSite: env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
  },

  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },

  upload: {
    dir: env.UPLOAD_DIR,
    maxFileSizeBytes: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
    maxFilesPerRequest: env.UPLOAD_MAX_FILES_PER_REQUEST,
    allowedExtensions: env.UPLOAD_ALLOWED_EXTENSIONS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    allowedMimeTypes: env.UPLOAD_ALLOWED_MIME_TYPES.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean),
  },

  detection: {
    mock: env.DETECTION_MOCK === 'true',
    apiUrl: env.DETECTION_API_URL,
    apiKey: env.DETECTION_API_KEY,
    timeoutMs: env.DETECTION_API_TIMEOUT_MS,
    mockPedestrians: env.DETECTION_MOCK_PEDESTRIANS,
  },

  signal: {
    transport: env.SIGNAL_TRANSPORT,
    serialPort: env.SIGNAL_SERIAL_PORT,
    baudRate: env.SIGNAL_BAUD,
    yellowMs: env.SIGNAL_YELLOW_MS,
    redMs: env.SIGNAL_RED_MS,
    clearGraceMs: env.SIGNAL_CLEAR_GRACE_MS,
    arduinoUrl: env.SIGNAL_ARDUINO_URL,
  },

  yoloLive: {
    detectionThresholdMs: env.YOLO_LIVE_DETECTION_THRESHOLD_MS,
    yellowDurationMs: env.YOLO_LIVE_YELLOW_MS,
    stopDurationMs: env.YOLO_LIVE_STOP_DURATION_MS,
    arduinoTransport: env.YOLO_LIVE_ARDUINO_TRANSPORT,
    arduinoPort: env.YOLO_LIVE_ARDUINO_PORT,
    arduinoBaud: env.YOLO_LIVE_ARDUINO_BAUD,
  },
};

export type Config = typeof config;

export default config;
