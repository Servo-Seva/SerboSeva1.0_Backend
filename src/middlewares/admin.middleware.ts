import { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth.middleware";
import { findUserById } from "../models/user.model";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // first ensure authenticated
  requireAuth(req, res, async () => {
    try {
      const userId = (req as any).userId;
      const user = await findUserById(userId);
      if (!user || !user.is_admin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to verify admin" });
    }
  });
}
