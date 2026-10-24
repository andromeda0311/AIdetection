import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSafetySettings } from './useSafetySettings';
import type { SignalConfig } from '../api';

const api = vi.hoisted(() => ({
  getSignalConfig: vi.fn(),
  updateSignalConfig: vi.fn(),
}));

vi.mock('../api', () => ({ getSignalConfig: api.getSignalConfig, updateSignalConfig: api.updateSignalConfig }));

function configResponse(overrides: Partial<SignalConfig> = {}): SignalConfig {
  return {
    detectionThresholdMs: 5000,
    yellowMs: 5000,
    redMs: 15000,
    mode: 'auto',
    manualGreenMs: 30000,
    manualYellowMs: 3000,
    manualRedMs: 20000,
    manualPedWalkMs: 15000,
    ...overrides,
  };
}

describe('useSafetySettings', () => {
  beforeEach(() => {
    api.getSignalConfig.mockReset();
    api.updateSignalConfig.mockReset();
  });

  it('loads the current timings from the API as whole seconds', async () => {
    api.getSignalConfig.mockResolvedValue(configResponse({ detectionThresholdMs: 7000, yellowMs: 3000, redMs: 22000 }));
    const setup = useSafetySettings();
    await setup.loadTimings();

    expect(api.getSignalConfig).toHaveBeenCalledTimes(1);
    expect(setup.settings.value).toEqual({ detection: 7, warning: 3, red: 22 });
    expect(setup.dirty.value).toBe(false);
    expect(setup.loadFailed.value).toBe(false);
    expect(setup.message.value).toBe('');
  });

  it('shows an unavailable message and keeps the form out of action when loading fails', async () => {
    api.getSignalConfig.mockRejectedValue(new Error('network down'));
    const setup = useSafetySettings();
    await setup.loadTimings();

    expect(setup.loadFailed.value).toBe(true);
    expect(setup.message.value).toBe('Timings are unavailable.');
  });

  it('saves the timings converted to milliseconds and reports the server response', async () => {
    api.getSignalConfig.mockResolvedValue(configResponse());
    const setup = useSafetySettings();
    await setup.loadTimings();

    setup.settings.value.detection = 8;
    setup.settings.value.warning = 4;
    setup.settings.value.red = 25;
    api.updateSignalConfig.mockResolvedValue(configResponse({ detectionThresholdMs: 8000, yellowMs: 4000, redMs: 25000 }));

    await setup.saveSettings();

    expect(api.updateSignalConfig).toHaveBeenCalledTimes(1);
    expect(api.updateSignalConfig).toHaveBeenCalledWith({ detectionThresholdMs: 8000, yellowMs: 4000, redMs: 25000 });
    expect(setup.settings.value).toEqual({ detection: 8, warning: 4, red: 25 });
    expect(setup.dirty.value).toBe(false);
    expect(setup.message.value).toBe('Saved. New timings apply from the next cycle on every device.');
  });

  it('rejects out-of-range and non-integer values without calling the API', async () => {
    api.getSignalConfig.mockResolvedValue(configResponse());
    const setup = useSafetySettings();
    await setup.loadTimings();

    setup.settings.value.detection = 0;
    await setup.saveSettings();
    expect(api.updateSignalConfig).not.toHaveBeenCalled();
    expect(setup.messageFailed.value).toBe(true);

    setup.settings.value.red = 301;
    await setup.saveSettings();
    expect(api.updateSignalConfig).not.toHaveBeenCalled();
    expect(setup.messageFailed.value).toBe(true);

    setup.settings.value.warning = 2.5;
    await setup.saveSettings();
    expect(api.updateSignalConfig).not.toHaveBeenCalled();
    expect(setup.messageFailed.value).toBe(true);
    expect(setup.message.value).toBe('Enter whole numbers within the displayed limits.');
  });

  it('shows the API error when saving fails', async () => {
    api.getSignalConfig.mockResolvedValue(configResponse());
    const setup = useSafetySettings();
    await setup.loadTimings();

    setup.settings.value.detection = 9;
    const failure = Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 422, data: { message: 'Detection time must be between 1000 and 60000 milliseconds.' } } });
    api.updateSignalConfig.mockRejectedValue(failure);
    await setup.saveSettings();

    expect(setup.messageFailed.value).toBe(true);
    expect(setup.message.value).toBe('Detection time must be between 1000 and 60000 milliseconds.');
    expect(setup.dirty.value).toBe(true);
  });

  it('never touches localStorage (the timings live on the server)', async () => {
    const storageSpies = ['getItem', 'setItem', 'removeItem', 'clear', 'key'].map((method) => vi.spyOn(Storage.prototype, method as 'getItem'));
    api.getSignalConfig.mockResolvedValue(configResponse());
    api.updateSignalConfig.mockResolvedValue(configResponse({ detectionThresholdMs: 9000 }));
    const setup = useSafetySettings();
    await setup.loadTimings();
    setup.settings.value.detection = 9;
    await setup.saveSettings();
    await setup.discard();
    expect(setup.settings.value).toEqual({ detection: 9, warning: 5, red: 15 });
    setup.resetDefaults();
    expect(setup.settings.value.detection).toBe(5);
    for (const spy of storageSpies) expect(spy).not.toHaveBeenCalled();
  });
});
