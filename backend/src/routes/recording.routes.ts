import { Router } from 'express';
import {
  startRecording,
  stopRecording,
  listRecordings,
  deleteRecording,
  getRecordingStatus,
} from '../controllers/recording.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/status', asyncHandler(getRecordingStatus));
router.get('/', authorize('admin'), asyncHandler(listRecordings));
router.post('/start', authorize('admin'), asyncHandler(startRecording));
router.post('/stop', authorize('admin'), asyncHandler(stopRecording));
router.delete('/:id', authorize('admin'), asyncHandler(deleteRecording));

export default router;