import { describe, expect, it, vi } from 'vitest';
import { LogArduinoController, SerialArduinoController, createArduinoController } from './arduinoLive.service.js';
import { getSharedArduinoSerial } from './arduinoSerial.shared.js';

describe('LogArduinoController', () => {
  it('reports offline because it is not a device', () => {
    const controller = new LogArduinoController();
    expect(controller.getStatus()).toBe('offline');
  });
});

describe('SerialArduinoController', () => {
  it('shares the serial connection status', () => {
    const shared = getSharedArduinoSerial({ portPath: 'COM3', baudRate: 9600 });
    const getSerialStatus = vi.spyOn(shared, 'getStatus');
    const controller = new SerialArduinoController(shared);
    const reported = controller.getStatus();
    expect(controller.getStatus()).toBe(reported);
    expect(getSerialStatus).toHaveBeenCalled();
  });
});

describe('createArduinoController', () => {
  it('uses the honest log controller when no hardware is configured', async () => {
    const controller = await createArduinoController({ transport: 'log', serialPort: 'COM3', baudRate: 9600 });
    expect(controller).toBeInstanceOf(LogArduinoController);
    expect(controller.getStatus()).toBe('offline');
  });
});
