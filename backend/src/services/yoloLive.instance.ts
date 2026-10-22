import config from '../config/env.js';
import { createArduinoController } from './arduinoLive.service.js';
import {
  YoloLiveService,
  createSocketIoBroadcaster,
  type SystemStateBroadcaster,
} from './yoloLive.service.js';
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
