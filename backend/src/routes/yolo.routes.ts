import { Router } from 'express';
import {
  getApiHealth,
  getArduinoStatus,
  getSystemStatus,
  getYoloStatus,
  postYoloDetection,
} from '../controllers/yolo.controller.js';
import { yoloIngestRateLimiter } from '../middleware/rateLimiter.js';
import { requireIngestKey } from '../middleware/requireIngestKey.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toggleYolo } from '../services/yoloEnabled.js';

const router = Router();

router.get('/health', asyncHandler(getApiHealth));
router.post('/yolo/detection', yoloIngestRateLimiter, requireIngestKey, asyncHandler(postYoloDetection));
router.get('/yolo/status', asyncHandler(getYoloStatus));
router.get('/arduino/status', asyncHandler(getArduinoStatus));
router.get('/system/status', asyncHandler(getSystemStatus));
router.post('/yolo/toggle', authenticate, authorize('admin'), async (req, res) => {
  const newState = toggleYolo();
  res.json({ ok: true, enabled: newState });
});

export default router;