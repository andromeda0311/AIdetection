import { logger } from '../utils/logger.js';

type SerialPortLike = {
  isOpen: boolean;
  write(data: string, cb: (err?: Error | null) => void): void;
  close(cb: () => void): void;
  on(event: 'data', listener: (data: Buffer) => void): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
};

interface PortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
}

/** One USB serial connection shared by live YOLO traffic and manual dashboard overrides. */
export class SharedArduinoSerial {
  private port: SerialPortLike | null = null;
  private opening: Promise<void> | null = null;
  private status: 'online' | 'offline' = 'offline';

  constructor(
    private readonly options: { portPath: string; baudRate: number },
  ) {}

  getStatus(): 'online' | 'offline' {
    return this.status;
  }

  private async ensureOpen(): Promise<void> {
    if (this.port?.isOpen) return;
    if (!this.opening) {
      this.opening = this.open().then(
        () => {
          // Keep a resolved promise cached while the port stays open.
        },
        (err) => {
          // Reset so the next command retries opening instead of staying failed forever.
          this.opening = null;
          throw err;
        },
      );
    }
    await this.opening;
  }

  private async detectArduinoPort(): Promise<string | null> {
    try {
      const { SerialPort } = await import('serialport');
      const ports: PortInfo[] = await SerialPort.list();
      // Genuine Arduino + common clone UARTs (CH340, CP210x, FT232R, CH9102, etc.)
      const isLikelyArduino = (p: PortInfo): boolean => {
        const vid = (p.vendorId ?? '').toLowerCase();
        const pid = (p.productId ?? '').toLowerCase();
        const manufacturer = (p.manufacturer ?? '').toLowerCase();
        return (
          vid === '2341' || // genuine Arduino
          vid === '1a86' || // CH340 / CH341 (cheap Uno clones)
          vid === '10c4' || // CP210x
          vid === '0403' || // FTDI FT232R
          manufacturer.includes('arduino') ||
          manufacturer.includes('ch340') ||
          manufacturer.includes('cp210')
        );
      };
      return ports.find(isLikelyArduino)?.path ?? null;
    } catch (e) {
      logger.warn({ err: e }, 'Failed to list serial ports for auto-detect');
      return null;
    }
  }

  private async open(): Promise<void> {
    const { SerialPort } = await import('serialport');
    const primaryPort = this.options.portPath;

    const tryOpen = (p: string) =>
      new Promise<void>((resolve, reject) => {
        const port = new SerialPort({ path: p, baudRate: this.options.baudRate, autoOpen: false });
        port.on('data', (data: Buffer) => {
          logger.info({ response: data.toString().trim() }, 'Arduino says');
        });
        port.on('error', (err: Error) => {
          this.status = 'offline';
          logger.warn({ err }, 'Arduino serial error');
        });
        port.open((err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          this.status = 'online';
          logger.info({ port: p }, 'Arduino serial port opened');
          this.port = port;
          resolve();
        });
      });

    // Port fallback order: configured port first, then secondary ports, then auto-detect
    const portFallbackOrder: string[] = [primaryPort, 'COM3'];

    for (const p of portFallbackOrder) {
      try {
        await tryOpen(p);
        logger.info({ port: p }, 'Arduino serial port opened');
        return;
      } catch (err) {
        logger.warn({ err, path: p }, 'Port failed, trying next');
      }
    }

    const detected = await this.detectArduinoPort();
    if (detected) {
      try {
        await tryOpen(detected);
        return;
      } catch (e) {
        logger.error({ err: e, path: detected }, 'Auto-detected port also failed');
      }
    }

    throw new Error(`All ports failed (tried: ${portFallbackOrder.join(', ')}, auto-detected: ${detected || 'none'})`);
  }

  send(line: string): void {
    void this.ensureOpen()
      .then(() => {
        this.port?.write(`${line}\n`, (err) => {
          if (err) {
            this.status = 'offline';
            logger.error({ err, command: line }, 'Arduino write error');
            return;
          }
          logger.info({ command: line, port: this.options.portPath }, 'Arduino serial command sent');
        });
      })
      .catch((err) => {
        this.status = 'offline';
        logger.warn({ err, command: line }, 'Arduino serial unavailable');
      });
  }

  async close(): Promise<void> {
    if (this.port?.isOpen) {
      await new Promise<void>((resolve) => this.port?.close(() => resolve()));
    }
    this.port = null;
    this.opening = null;
    this.status = 'offline';
  }
}

let sharedInstance: SharedArduinoSerial | null = null;

export function getSharedArduinoSerial(options: {
  portPath: string;
  baudRate: number;
}): SharedArduinoSerial {
  if (!sharedInstance) {
    sharedInstance = new SharedArduinoSerial(options);
  }
  return sharedInstance;
}

export function mapSignalStateToArduinoCommand(state: 'GREEN' | 'YELLOW' | 'RED'): string {
  switch (state) {
    case 'GREEN':
      return 'NORMAL_TRAFFIC';
    case 'YELLOW':
      return 'CAUTION_TRAFFIC';
    case 'RED':
      return 'STOP_TRAFFIC';
  }
}

export function mapTimerCommand(type: 'car' | 'ped', seconds: number): string {
  const clamped = Math.max(0, Math.min(99, Math.floor(seconds)));
  const target = type === 'car' ? 'CARS' : 'PEDS';
  return `COUNTDOWN:${target}:${clamped.toString().padStart(2, '0')}`;
}
