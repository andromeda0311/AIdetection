import { computed, onMounted, onUnmounted, ref } from 'vue';
import { io, Socket } from 'socket.io-client';
import { getLiveSystemStatus } from '../api/live';
import { useAuthStore } from '../stores/auth';
import type { LiveSystemState, ServerToClientEvents, ClientToServerEvents, SignalMode, ManualTimers, RecordingStatus } from '../types';

const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function normalizeLiveState(payload: LiveSystemState): LiveSystemState {
  return {
    ...payload,
    detections: payload.detections ?? [],
    frameWidth: payload.frameWidth ?? 0,
    frameHeight: payload.frameHeight ?? 0,
    updatedAt: payload.updatedAt ?? Date.now(),
  };
}

export function useLiveSystemState() {
  const liveState = ref<LiveSystemState | null>(null);
  const connected = ref(false);
  const lastReceivedAt = ref(0);
  const checkedAt = ref(Date.now());
  const available = computed(() => lastReceivedAt.value > 0 && checkedAt.value - lastReceivedAt.value < 5000);

  let socket: TypedSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  function applyState(payload: LiveSystemState) {
    liveState.value = normalizeLiveState(payload);
    lastReceivedAt.value = Date.now();
    checkedAt.value = lastReceivedAt.value;
  }

  async function pollState() {
    checkedAt.value = Date.now();
    try {
      const state = await getLiveSystemStatus();
      applyState(state);
    } catch {
      // Keep last known state; polling is a fallback only.
    }
  }

  function connectSocketIo() {
    if (disposed) return;

    socket?.disconnect();
    socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      autoConnect: true,
      // Called on every (re)connect so a renewed access token is picked up.
      auth: (cb) => cb({ token: useAuthStore().accessToken ?? undefined }),
    });

    socket.on('connect', () => {
      connected.value = true;
      console.log('[Socket.io] Connected:', socket?.id);
      // Join dashboard room for state updates
      socket?.emit('ui:subscribe', { room: 'dashboard' }, () => {});
      // Request initial state
      socket?.emit('ui:request_state', (response) => {
        if (response?.state) applyState(response.state);
      });
    });

    socket.on('disconnect', (reason) => {
      connected.value = false;
      console.log('[Socket.io] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      connected.value = false;
      console.error('[Socket.io] Connection error:', err.message);
      // Rejected by the server's auth check: Socket.IO won't retry on its own.
      // Renew the session (expired access token) and reconnect.
      if (!socket?.active && !disposed) {
        void useAuthStore()
          .refresh()
          .finally(() => {
            if (!disposed && useAuthStore().accessToken) setTimeout(() => socket?.connect(), 5000);
          });
      }
    });

    socket.on('system:state', (state: LiveSystemState) => {
      applyState(state);
    });

    socket.on('yolo:toggle', (data: { enabled: boolean }) => {
      if (liveState.value) {
        liveState.value.yolo = data.enabled ? 'online' : 'offline';
        liveState.value.camera = data.enabled ? 'online' : 'offline';
      }
    });

    socket.on('signal:mode', (data: { mode: SignalMode }) => {
      if (liveState.value) {
        liveState.value.mode = data.mode;
      }
    });

    socket.on('signal:manualTimers', (data: ManualTimers) => {
      if (liveState.value) {
        liveState.value.manualTimers = data;
      }
    });

    socket.on('recording:status', (data: RecordingStatus) => {
      if (liveState.value) {
        liveState.value.recording = data;
      }
    });
  }

  onMounted(() => {
    void pollState();
    connectSocketIo();
    pollTimer = setInterval(() => {
      void pollState();
    }, 1000);
  });

  onUnmounted(() => {
    disposed = true;
    if (pollTimer) clearInterval(pollTimer);
    socket?.disconnect();
    socket = null;
  });

  // Expose socket for advanced usage (manual overrides, etc.)
  const setMode = (mode: 'AUTO' | 'MANUAL') =>
    socket?.emit('ui:mode/set', { mode }, (ack: any) => {
      if (!ack?.ok) console.warn('setMode rejected:', ack?.reason)
    })

  const pressManual = (phase: 'GREEN' | 'YELLOW' | 'RED') =>
    socket?.emit('ui:manual/press', { phase }, (ack: any) => {
      if (!ack?.ok) console.warn('manual rejected:', ack?.reason)
    })

  const runScenario = (name: 'QUICK_TEST' | 'FULL_CYCLE' | 'PEDESTRIAN_TEST') =>
    socket?.emit('ui:manual/scenario', { name }, (ack: any) => {
      if (!ack?.ok) console.warn('scenario rejected:', ack?.reason)
    })

  // Expose socket getter for advanced usage (manual overrides, listening to events)
  const getSocket = () => socket;

  return { liveState, connected, available, setMode, pressManual, runScenario, socket: getSocket };
}
