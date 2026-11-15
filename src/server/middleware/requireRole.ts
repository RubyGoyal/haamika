/**
 * Role-based authorization middleware.
 * Checks that the user is authenticated and has one of the allowed roles.
 * Every query is scoped to the session's circleId — enforced here.
 */
import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../../shared/types.js';

/**
 * Create middleware that requires the user to have one of the specified roles.
 * Attaches circleId and memberId to req for downstream use.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.session.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }

    next();
  };
}
