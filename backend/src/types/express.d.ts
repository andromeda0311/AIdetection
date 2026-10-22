import type { AuthUser } from './authUser.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      validatedQuery?: unknown;
      validatedParams?: Record<string, unknown>;
    }
  }
}

export {};
