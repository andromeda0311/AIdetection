import { logger } from '../utils/logger.js';
import { flashFirmware } from './arduinoFlasher.js';
import type { ArduinoCommand, ArduinoCommandSender } from './yoloLive.service.js';
import { getSharedArduinoSerial } from './arduinoSerial.shared.js';

/** Writes high-level traffic commands to the console when no hardware is attached. */
export class LogArduinoController implements ArduinoCommandSender {
  private status: 'online' | 'offline' = 'online';

  send(command: ArduinoCommand): void {
    logger.info({ command }, 'Arduino command');
  }

  getStatus(): 'online' | 'offline' {
    return this.status;
  }

  async close(): Promise<void> {
    // No-op.
  }
}

/** Sends CAUTION_TRAFFIC / STOP_TRAFFIC / NORMAL_TRAFFIC over USB serial to the Arduino Uno. */
export class SerialArduinoController implements ArduinoCommandSender {
  constructor(
    private readonly serial: ReturnType<typeof getSharedArduinoSerial>,
  ) {}

  send(command: ArduinoCommand): void {
    this.serial.send(command);
  }

  getStatus(): 'online' | 'offline' {
    return this.serial.getStatus();
  }

  async close(): Promise<void> {
    await this.serial.close();
  }
}

export async function createArduinoController(configuration: {
  transport: 'log' | 'serial';
  serialPort: string;
  baudRate: number;
}): Promise<ArduinoCommandSender & { close(): Promise<void> }> {
  if (configuration.transport === 'serial') {
    // Ensure any existing serial connection is closed before flashing
    try {
      await getSharedArduinoSerial({
        portPath: configuration.serialPort,
        baudRate: configuration.baudRate,
      }).close();
    } catch (_) {}
    // Flash the latest firmware to the Arduino
    try {
      await flashFirmware(configuration.serialPort, configuration.baudRate);
      logger.info('Arduino firmware flashed successfully');
    } catch (e) {
      logger.error({ err: e }, 'Failed to flash Arduino firmware');
      // Fallback to log controller if flashing fails
      return new LogArduinoController();
    }
    return new SerialArduinoController(
      getSharedArduinoSerial({
        portPath: configuration.serialPort,
        baudRate: configuration.baudRate,
      }),
    );
  }
  return new LogArduinoController();
}
