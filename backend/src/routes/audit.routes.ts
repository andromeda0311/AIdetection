import { Router } from 'express';
import { exportAudit, listAudit } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(listAudit));
router.get('/export', asyncHandler(exportAudit));

export default router;
