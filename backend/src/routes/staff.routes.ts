import { Router } from 'express';
import { createStaff, deactivateStaff, listStaff, updateStaff } from '../controllers/staff.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createStaffSchema, staffIdParams, updateStaffSchema } from '../dto/staff.dto.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(listStaff));
router.post('/', validate(createStaffSchema), asyncHandler(createStaff));
router.patch('/:id', validate(staffIdParams, 'params'), validate(updateStaffSchema), asyncHandler(updateStaff));
router.delete('/:id', validate(staffIdParams, 'params'), asyncHandler(deactivateStaff));

export default router;
