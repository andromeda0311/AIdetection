import { Router } from 'express';
import { login, logout, me, refresh } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loginSchema } from '../dto/auth.dto.js';

const router = Router();

// No /register: the system has a single administrator account (see auth.service.ts).
router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, me);

export default router;
