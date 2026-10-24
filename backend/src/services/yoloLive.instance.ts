import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createArduinoController } from './arduinoLive.service.js';
import {
  YoloLiveService,
  createSocketIoBroadcaster,
  type SystemStateBroadcaster,
} from './yoloLive.service.js';
import { recordDetection, markCycleTriggered } from './detectionActivity.service.js';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { loadFromEnv, isYoloEnabled, setYoloEnabled, toggleYolo } from './yoloEnabled.js';

let signalIo: SocketIOServer | null = null;

export function initSignalIo(httpServer: HttpServer): SocketIOServer {
  if (signalIo) return signalIo;

  signalIo = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  return signalIo;
}

export function getSignalIo(): SocketIOServer | null {
  return signalIo;
}

export const yoloLiveBroadcaster: SystemStateBroadcaster = {
  broadcast(state) {
    signalIo?.to('dashboard').emit('system:state', state);
  },
};

export const arduinoLive = await createArduinoController({
  transport: config.yoloLive.arduinoTransport,
  serialPort: config.yoloLive.arduinoPort,
  baudRate: config.yoloLive.arduinoBaud,
});

loadFromEnv();

export const yoloLive = new YoloLiveService(
  arduinoLive,
  yoloLiveBroadcaster,
  config.yoloLive.detectionThresholdMs,
  config.yoloLive.yellowDurationMs,
  config.yoloLive.stopDurationMs,
);

// The live state must say which Arduino transport the engine was configured
// with, so the website can report "not connected (log mode)" honestly.
yoloLive.setArduinoTransport(config.yoloLive.arduinoTransport);

// Lasting detection history: engine events become rows in detection_activity.
// The writes are fire-and-forget — the light's timing path never awaits them.
yoloLive.onActivity((event) => {
  if (event.type === 'detected') {
    recordDetection(event.peopleCount).catch((err) =>
      logger.error({ err }, 'Failed to record detection activity'),
    );
  } else {
    markCycleTriggered().catch((err) =>
      logger.error({ err }, 'Failed to mark the cycle trigger in the detection activity'),
    );
  }
});

// When the detection feed (dashboard browser or Python) goes quiet, mark it offline
// and drop the stale pedestrian state.
setInterval(() => yoloLive.markYoloOffline(), 1000).unref();
