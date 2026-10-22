import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Compile and upload the traffic‑light firmware to the given Serial port.
 * Requires `arduino-cli` to be installed and available in PATH.
 */
export async function flashFirmware(port: string, baudRate: number): Promise<void> {
  const sketchPath = 'backend/arduino/traffic_light/traffic_light.ino';
  const fqbn = 'arduino:avr:uno'; // board definition matching Arduino Uno

  // Compile the sketch (optional – requires arduino-cli)
  try {
    logger.info('Compiling Arduino sketch...');
    await execFileAsync('arduino-cli', ['compile', '--fqbn', fqbn, sketchPath]);
  } catch (e) {
    logger.warn({ err: e }, 'arduino-cli not available – skipping compilation');
  }

  // Upload the compiled sketch to the selected COM port (optional)
  try {
    logger.info('Uploading firmware to %s', port);
    await execFileAsync('arduino-cli', [
      'upload',
      '-p', port,
      '--fqbn', fqbn,
      sketchPath,
    ]);
  } catch (e) {
    logger.warn({ err: e }, 'arduino-cli not available – skipping upload');
  }
}
