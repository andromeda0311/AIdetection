import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrafficSignalMachine, initTrafficSignal, trafficSignal } from './trafficSignal.service.js';
import { YoloLiveService, type ArduinoCommandSender, type SystemStateBroadcaster } from './yoloLive.service.js';
import { ArduinoTransportEnum } from '../entities/TrafficLightAuditLog.js';
import { SignalStateEnum, TriggeredByEnum } from '../entities/SignalEvent.js';

const signalConfig = vi.hoisted(() => ({
  getConfig: vi.fn(async () => null),
  upsertConfig: vi.fn(async () => ({ id: 1 })),
}));

const signalEventModel = vi.hoisted(() => ({
  createSignalEvent: vi.fn(),
}));

const audit = vi.hoisted(() => ({
  logArduinoActivation: vi.fn(),
}));

const yoloInstance = vi.hoisted(() => ({
  getSignalIo: () => null,
  yoloLiveStub: {
    setSignalStateProvider: vi.fn(),
    onTransition: vi.fn(() => () => undefined),
    setAutoCycleEnabled: vi.fn(),
    refreshSignalState: vi.fn(),
    setDurations: vi.fn(),
  },
}));

vi.mock('../models/SignalConfig.js', () => signalConfig);
vi.mock('../models/SignalEvent.js', () => signalEventModel);
vi.mock('./trafficLightAudit.service.js', () => audit);
vi.mock('./yoloLive.instance.js', () => ({
  getSignalIo: yoloInstance.getSignalIo,
  yoloLive: yoloInstance.yoloLiveStub,
}));

let eventCounter = 0;

function createEngine() {
  const commands: string[] = [];
  const broadcasts: Array<Record<string, unknown>> = [];
  const arduino: ArduinoCommandSender = {
    send: (command) => commands.push(command),
    getStatus: () => 'online',
  };
  const broadcaster: SystemStateBroadcaster = {
    broadcast: (state) => broadcasts.push({ ...state }),
  };
  const engine = new YoloLiveService(arduino, broadcaster, 5000, 3000, 15000);
  return { commands, broadcasts, engine };
}

function createMachine(engine: YoloLiveService, options = { yellowMs: 3000, redMs: 15000 }) {
  const machine = new TrafficSignalMachine(engine, options, ArduinoTransportEnum.LOG, signalEventModel.createSignalEvent);
  // Mirrors the production singleton wiring: mode and manual timers flow into the live state.
  engine.setSignalStateProvider(() => ({ mode: machine.getMode(), manualTimers: machine.getManualTimers() }));
  return machine;
}

const pedestrianDetection = { detectionId: 'd1', pedestrianDetected: true, totalPedestrians: 1 };

describe('TrafficSignalMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    eventCounter = 0;
    signalConfig.upsertConfig.mockClear();
    signalEventModel.createSignalEvent.mockReset().mockImplementation(async (data: Record<string, unknown>) => ({
      id: `event-${++eventCounter}`,
      createdAt: new Date(),
      ...data,
    }));
    audit.logArduinoActivation.mockReset().mockImplementation(async (data: Record<string, unknown>) => ({
      id: `audit-${eventCounter}`,
      createdAt: new Date(),
      ...data,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts GREEN from the live engine', () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);
    expect(machine.getStatus().state).toBe(SignalStateEnum.GREEN);
  });

  it('records a SignalEvent and an audit row for every automatic cycle transition', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    machine.onDetection(pedestrianDetection);
    expect(engine.getSystemState().traffic).toBe('caution');

    await vi.advanceTimersByTimeAsync(18000);

    expect(signalEventModel.createSignalEvent).toHaveBeenCalledTimes(3);
    expect(signalEventModel.createSignalEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: SignalStateEnum.YELLOW, triggeredBy: TriggeredByEnum.AUTO, detectionId: 'd1' }),
    );
    expect(signalEventModel.createSignalEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: SignalStateEnum.RED, triggeredBy: TriggeredByEnum.AUTO }),
    );
    expect(signalEventModel.createSignalEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ state: SignalStateEnum.GREEN, triggeredBy: TriggeredByEnum.AUTO }),
    );
    expect(audit.logArduinoActivation).toHaveBeenCalledTimes(3);
    expect(audit.logArduinoActivation).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: SignalStateEnum.GREEN, transport: ArduinoTransportEnum.LOG }),
    );
  });

  it('does not change the light from detections in manual mode, and resumes cycles in auto', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.setMode('manual');
    machine.onDetection(pedestrianDetection);
    await vi.advanceTimersByTimeAsync(20000);
    expect(engine.getSystemState().traffic).toBe('normal');
    expect(signalEventModel.createSignalEvent).not.toHaveBeenCalled();

    // Back in automatic mode the next detection starts a cycle again.
    await machine.setMode('auto');
    machine.onDetection(pedestrianDetection);
    expect(engine.getSystemState().traffic).toBe('caution');
    await vi.advanceTimersByTimeAsync(18000);
    expect(engine.getSystemState().traffic).toBe('normal');
    expect(signalEventModel.createSignalEvent).toHaveBeenCalledTimes(3);
  });

  it('reflects a forced RED in the live state immediately and records the audit row', async () => {
    const { engine, broadcasts } = createEngine();
    const machine = createMachine(engine);

    await machine.forceState(SignalStateEnum.RED, 'admin-1');

    expect(engine.getSystemState().traffic).toBe('stopped');
    expect(engine.getSystemState().pedState).toBe('WALK');
    // Broadcast happened at once, not on the next throttled update tick.
    expect(broadcasts[broadcasts.length - 1]).toMatchObject({ traffic: 'stopped' });
    expect(signalEventModel.createSignalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ state: SignalStateEnum.RED, triggeredBy: TriggeredByEnum.ADMIN }),
    );
    expect(audit.logArduinoActivation).toHaveBeenCalledWith(
      expect.objectContaining({
        state: SignalStateEnum.RED,
        triggeredBy: TriggeredByEnum.ADMIN,
        transport: ArduinoTransportEnum.LOG,
        userId: 'admin-1',
      }),
    );

    // Held RED: it stays until another command changes it.
    await vi.advanceTimersByTimeAsync(60000);
    expect(engine.getSystemState().traffic).toBe('stopped');
  });

  it('returns a forced phase with a duration to GREEN and records both transitions', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.forceStateWithDuration(SignalStateEnum.RED, 4000, 'admin-2');
    expect(engine.getSystemState().traffic).toBe('stopped');
    expect(engine.getSystemState().carTimer).toBe(4);

    await vi.advanceTimersByTimeAsync(4000);
    expect(engine.getSystemState().traffic).toBe('normal');

    expect(signalEventModel.createSignalEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: SignalStateEnum.RED, triggeredBy: TriggeredByEnum.ADMIN }),
    );
    expect(signalEventModel.createSignalEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: SignalStateEnum.GREEN, triggeredBy: TriggeredByEnum.ADMIN }),
    );
  });

  it('runs the manual test cycle YELLOW -> RED -> GREEN with the configured timers', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.triggerManualCycle('admin-3');
    expect(engine.getSystemState().traffic).toBe('caution');

    await vi.advanceTimersByTimeAsync(3000);
    expect(engine.getSystemState().traffic).toBe('stopped');

    // The manual cycle uses the manual timers (default redMs of 20000).
    await vi.advanceTimersByTimeAsync(20000);
    expect(engine.getSystemState().traffic).toBe('normal');

    expect(signalEventModel.createSignalEvent).toHaveBeenCalledTimes(3);
    expect(audit.logArduinoActivation).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: SignalStateEnum.GREEN, triggeredBy: TriggeredByEnum.ADMIN, userId: 'admin-3' }),
    );
  });

  it('does not copy manual timers into the automatic engine durations', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.setManualTimers({ redMs: 9000 });
    expect(machine.getManualTimers().redMs).toBe(9000);
    // The automatic red time comes only from signal_config.redMs (updateOptions).
    expect(engine.getSystemState().autoStopSec).toBe(15);
    expect(yoloInstance.yoloLiveStub.setDurations).not.toHaveBeenCalled();
  });

  it('updates the recorded mode and manual timers on the engine status card', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.setMode('manual');
    await machine.setManualTimers({ greenMs: 10000, yellowMs: 2000, redMs: 12000, pedWalkMs: 8000 });

    const state = engine.getSystemState();
    expect(state.mode).toBe('manual');
    expect(state.manualTimers).toEqual({ greenMs: 10000, yellowMs: 2000, redMs: 12000, pedWalkMs: 8000 });
  });

  it('persists new automatic timings and applies them to the engine at once', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);

    await machine.updateOptions({ detectionThresholdMs: 8000, yellowMs: 4000, redMs: 25000 });

    // Only the automatic-cycle columns are written.
    expect(signalConfig.upsertConfig).toHaveBeenCalledWith({
      detectionThresholdMs: 8000,
      yellowMs: 4000,
      redMs: 25000,
    });
    // The live state reflects the new values right away; a running cycle keeps its timing.
    const state = engine.getSystemState();
    expect(state.thresholdRequiredSec).toBe(8);
    expect(state.autoStopSec).toBe(25);
  });

  it('keeps the current value when a timing is undefined (row saved before the detection column)', async () => {
    const { engine } = createEngine();
    const machine = createMachine(engine);
    await machine.updateOptions({ detectionThresholdMs: 6000 });

    await machine.updateOptions({ detectionThresholdMs: undefined, yellowMs: 2000 });

    expect(machine.getOptions().detectionThresholdMs).toBe(6000);
    expect(signalConfig.upsertConfig).toHaveBeenLastCalledWith(expect.objectContaining({ detectionThresholdMs: 6000, yellowMs: 2000 }));
    expect(engine.getSystemState().thresholdRequiredSec).toBe(6);
  });

  it('applies the saved timings on startup so they survive a restart', async () => {
    signalConfig.getConfig.mockResolvedValueOnce({
      detectionThresholdMs: 7000,
      yellowMs: 2500,
      redMs: 22000,
      mode: 'auto',
      manualGreenMs: null,
      manualYellowMs: null,
      manualRedMs: null,
      manualPedWalkMs: null,
    });

    signalConfig.upsertConfig.mockClear();
    await initTrafficSignal();

    expect(signalConfig.upsertConfig).toHaveBeenCalledWith({
      detectionThresholdMs: 7000,
      yellowMs: 2500,
      redMs: 22000,
    });
    // The engine receives the persisted timings in its setDurations shape.
    expect(yoloInstance.yoloLiveStub.setDurations).toHaveBeenCalledWith({
      detectionThresholdMs: 7000,
      yellowDurationMs: 2500,
      stopDurationMs: 22000,
    });
    // The machine reports the persisted effective values.
    expect(trafficSignal.getOptions()).toEqual({ detectionThresholdMs: 7000, yellowMs: 2500, redMs: 22000 });
  });
});
