import 'reflect-metadata';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import config from './config/env.js';
import { AppDataSource, initDB, runPendingMigrations } from './config/ormconfig.js';
import { logger } from './utils/logger.js';
import { trafficSignal, initTrafficSignal } from './services/trafficSignal.service.js';
import { arduinoLive, initSignalIo, getSignalIo, yoloLive } from './services/yoloLive.instance.js';
import { setupSocketIoHandlers } from './services/socketIoBroadcaster.js';

const server = createServer(app);

// Initialize Socket.io (single real-time transport)
export const signalIo = initSignalIo(server);

// Setup Socket.io event handlers
setupSocketIoHandlers(signalIo, yoloLive);

signalIo.on('connection', (socket) => {
  logger.debug({ id: socket.id }, 'Socket.io client connected');
  socket.on('disconnect', (reason) => logger.debug({ id: socket.id, reason }, 'Socket.io client disconnected'));
});

await initDB();
// Bring the schema up to date before anything reads it. A failure stops the
// start, so the host keeps the previous version running.
if (config.runMigrationsOnStart) {
  const applied = await runPendingMigrations();
  logger.info(applied.length ? { applied } : {}, applied.length ? 'Database migrations applied' : 'Database schema up to date');
}
await initTrafficSignal();

server.listen(config.port, config.host, () => {
  logger.info(`API server listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
  logger.info('WebSocket server ready for live YOLO state');
  logger.info(
    {
      transport: config.yoloLive.arduinoTransport,
      port: config.yoloLive.arduinoPort,
      baudRate: config.yoloLive.arduinoBaud,
    },
    'Live Arduino transport configured',
  );

  if (config.yoloLive.arduinoTransport === 'serial') {
    arduinoLive.send('PING');
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down...`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      yoloLive.close();
      await arduinoLive.close();
      await trafficSignal.close();
      if (AppDataSource.isInitialized) await AppDataSource.destroy();
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
