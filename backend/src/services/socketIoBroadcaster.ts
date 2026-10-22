import { Server as SocketIOServer, Socket } from 'socket.io';
import type { SystemState, SystemStateBroadcaster } from './yoloLive.service.js';
import { isAdminSocket, socketAuthMiddleware } from './socketAuth.js';

interface SocketIoBroadcasterConfig {
  io: SocketIOServer;
  room?: string;
}

export function createSocketIoBroadcaster(config: SocketIoBroadcasterConfig): SystemStateBroadcaster {
  const { io, room = 'dashboard' } = config;

  return {
    broadcast(state: SystemState): void {
      io.to(room).emit('system:state', state);
    },
  };
}

export function setupSocketIoHandlers(io: SocketIOServer, yoloLive: { getSystemState: () => SystemState }): void {
  io.use((socket, next) => void socketAuthMiddleware(socket, next));

  io.on('connection', (socket: Socket) => {
    console.log(`Socket.io client connected: ${socket.id}`);

    socket.on('ui:subscribe', (data: { room: string }, ack) => {
      const { room } = data;
      if (room === 'admin' && !isAdminSocket(socket)) {
        ack?.({ success: false, error: 'Forbidden' });
        return;
      }
      if (room === 'dashboard' || room === 'admin') {
        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}`);
        ack?.({ success: true });
      } else {
        ack?.({ success: false, error: 'Invalid room' });
      }
    });

    socket.on('ui:request_state', (_data, ack) => {
      const state = yoloLive.getSystemState();
      ack?.({ state });
    });

    socket.on('ui:override_traffic', (data: { traffic: 'normal' | 'caution' | 'stopped' }, ack) => {
      if (!isAdminSocket(socket)) {
        ack?.({ success: false, error: 'Forbidden' });
        return;
      }
      console.log(`Manual traffic override requested: ${data.traffic} by ${socket.id}`);
      ack?.({ success: true, state: yoloLive.getSystemState() });
    });

    socket.on('ui:arduino_ping', (_data, ack) => {
      ack?.({ pong: true });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket.io client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });
}