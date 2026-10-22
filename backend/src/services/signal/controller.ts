import { logger } from '../../utils/logger.js';
import { getSharedArduinoSerial, mapSignalStateToArduinoCommand, mapTimerCommand } from '../arduinoSerial.shared.js';

export type SignalState = 'GREEN' | 'YELLOW' | 'RED';
export type PedestrianState = 'WALK' | 'DONT_WALK';

export interface SignalController {
  send(state: SignalState, pedState: PedestrianState, carTimer: number | null, pedTimer: number | null): Promise<void>;
  close(): Promise<void>;
}

/** Writes commands to the console only — used in development without hardware. */
export class LogSignalController implements SignalController {
  async send(state: SignalState, pedState: PedestrianState, carTimer: number | null, pedTimer: number | null): Promise<void> {
    logger.info({ state, pedState, carTimer, pedTimer }, 'Traffic signal command');
  }

  async close(): Promise<void> {
    // No-op.
  }
}

/**
 * Sends traffic commands over the same USB serial connection used by live YOLO detection.
 * Maps dashboard GREEN/YELLOW/RED to NORMAL_TRAFFIC / CAUTION_TRAFFIC / STOP_TRAFFIC.
 */
export class SerialSignalController implements SignalController {
  constructor(
    private readonly serial: ReturnType<typeof getSharedArduinoSerial>,
  ) {}

  async send(state: SignalState, pedState: PedestrianState, carTimer: number | null, pedTimer: number | null): Promise<void> {
    this.serial.send(mapSignalStateToArduinoCommand(state));
    if (carTimer !== null) {
      this.serial.send(mapTimerCommand('car', carTimer));
    }
    if (pedTimer !== null) {
      this.serial.send(mapTimerCommand('ped', pedTimer));
    }
  }

  async close(): Promise<void> {
    // Shared serial is closed by the live Arduino controller on shutdown.
  }
}

/** Sends state changes to an Arduino with networking (ESP8266/ESP32) via HTTP. */
export class HttpSignalController implements SignalController {
  constructor(private readonly url: string) {}

  async send(state: SignalState, pedState: PedestrianState, carTimer: number | null, pedTimer: number | null): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, pedState, carTimer, pedTimer }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        logger.warn({ status: response.status, state }, 'Arduino HTTP controller returned an error status');
      }
    } catch (err) {
      logger.warn({ err }, 'Arduino HTTP controller unreachable; signal not sent');
    }
  }

  async close(): Promise<void> {
    // No-op.
  }
}

export function createSignalController(configuration: {
  transport: 'log' | 'serial' | 'http';
  serialPort: string;
  baudRate: number;
  arduinoUrl: string;
}): SignalController {
  switch (configuration.transport) {
    case 'serial':
      return new SerialSignalController(
        getSharedArduinoSerial({
          portPath: configuration.serialPort,
          baudRate: configuration.baudRate,
        }),
      );
    case 'http':
      return new HttpSignalController(configuration.arduinoUrl);
    default:
      return new LogSignalController();
  }
}
