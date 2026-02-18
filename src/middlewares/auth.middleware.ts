import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import sql from "../db";

interface JwtPayload {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  console.log(req.cookies);

  console.log("from auth middleware" + token + "end");

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as JwtPayload;

    (req as any).userId = decoded.userId;
    (req as any).user = { uid: decoded.userId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid session" });
  }
}

/**
 * Middleware to require admin role
 * Must be used after requireAuth
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = (req as any).userId;

    console.log("[requireAdmin] Checking admin for userId:", userId);

    if (!userId) {
      console.log("[requireAdmin] No userId found - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Check if user is admin in database
    // userId from JWT is the database 'id' column, not firebase_uid
    const rows = await sql`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;

    console.log("[requireAdmin] User lookup result:", rows);

    if (rows.length === 0 || !rows[0].is_admin) {
      console.log("[requireAdmin] User not admin - returning 403");
      return res.status(403).json({ message: "Admin access required" });
    }

    console.log("[requireAdmin] Admin access granted");
    next();
  } catch (err) {
    console.error("Admin check error:", err);
    return res.status(500).json({ message: "Failed to verify admin status" });
  }
}
