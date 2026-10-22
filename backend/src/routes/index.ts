import { Router } from 'express';
import authRoutes from './auth.routes.js';
import staffRoutes from './staff.routes.js';
import detectionRoutes from './detection.routes.js';
import signalRoutes from './signal.routes.js';
import yoloRoutes from './yolo.routes.js';
import recordingRoutes from './recording.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/staff', staffRoutes);
router.use('/detections', detectionRoutes);
router.use('/signal', signalRoutes);
router.use('/recordings', recordingRoutes);
router.use('/audit', auditRoutes);
router.use('/', yoloRoutes);

export default router;
