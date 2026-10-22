import { Router } from 'express';
import {
  forceState,
  getSignalEvents,
  getSignalStatus,
  getSignalConfig,
  updateSignalConfig,
  exportSignalEvents,
  getSignalMode,
  setSignalMode,
  getManualTimers,
  setManualTimers,
  forcePhase,
  triggerManualCycle,
} from '../controllers/signal.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SignalStateEnum } from '../entities/SignalEvent.js';

const router = Router();

router.use(authenticate);

router.get('/status', asyncHandler(getSignalStatus));
router.get('/events', asyncHandler(getSignalEvents));
router.get('/events/export', authorize('admin'), asyncHandler(exportSignalEvents));
router.get('/config', authorize('admin'), asyncHandler(getSignalConfig));
router.put('/config', authorize('admin'), asyncHandler(updateSignalConfig));

router.post('/green', authorize('admin'), asyncHandler(forceState(SignalStateEnum.GREEN)));
router.post('/yellow', authorize('admin'), asyncHandler(forceState(SignalStateEnum.YELLOW)));
router.post('/red', authorize('admin'), asyncHandler(forceState(SignalStateEnum.RED)));

// Mode endpoints
router.get('/mode', asyncHandler(getSignalMode));
router.put('/mode', authorize('admin'), asyncHandler(setSignalMode));

// Manual timers endpoints
router.get('/manual-timers', asyncHandler(getManualTimers));
router.put('/manual-timers', authorize('admin'), asyncHandler(setManualTimers));

// Force phase with optional custom duration
router.post('/force-phase', authorize('admin'), asyncHandler(forcePhase));

// Trigger full manual cycle (Green -> Yellow -> Red -> Green)
router.post('/trigger-cycle', authorize('admin'), asyncHandler(triggerManualCycle));

export default router;
