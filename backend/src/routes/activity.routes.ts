import { Router } from 'express';
import { listRecentActivity } from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recentActivityQuery } from '../dto/activity.dto.js';

const router = Router();

router.use(authenticate);

router.get('/recent', validate(recentActivityQuery, 'query'), asyncHandler(listRecentActivity));

export default router;
