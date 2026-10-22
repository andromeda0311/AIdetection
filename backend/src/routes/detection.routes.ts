import { Router } from 'express';
import {
  downloadFrame,
  downloadInput,
  getDetection,
  listDetections,
  uploadDetection,
} from '../controllers/detection.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { videoUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { detectionIdParams, frameIdParams, listDetectionsQuery } from '../dto/detection.dto.js';
import config from '../config/env.js';

const router = Router();

router.use(authenticate);

// Video upload is not offered on the hosted server: files would fill its small,
// temporary disk, and detection there is simulated (no Python service).
if (config.nodeEnv !== 'production') {
  router.post('/upload', videoUpload.single('file'), asyncHandler(uploadDetection));
}
router.get('/', validate(listDetectionsQuery, 'query'), asyncHandler(listDetections));
router.get('/:id', validate(detectionIdParams, 'params'), asyncHandler(getDetection));
router.get('/:id/input/file', validate(detectionIdParams, 'params'), asyncHandler(downloadInput));
router.get(
  '/:id/frames/:frameId/file',
  validate(detectionIdParams, 'params'),
  validate(frameIdParams, 'params'),
  asyncHandler(downloadFrame),
);

export default router;
