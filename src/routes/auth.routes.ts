import { Router } from "express";
import jwt from "jsonwebtoken";
import admin from "../firebaseAdmin";
import { findUserByFirebaseUid, createUser } from "../models/user.model";

const router = Router();

/**
 * LOGIN
 * Frontend sends Firebase ID token
 */
router.post("/login", async (req, res) => {
  try {
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    const { firebaseToken } = req.body;
    console.log(
      "Login request received. Token length:",
      firebaseToken ? firebaseToken.length : 0
    );

    if (!firebaseToken) {
      console.error("Login failed: Token missing");
      return res.status(400).json({ message: "Token missing" });
    }

    // 1️⃣ Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    console.log("Decoded Token:", JSON.stringify(decoded, null, 2));

    const firebaseUid = decoded.uid;
    let phone = decoded.phone_number;
    let email = decoded.email;
    let name = decoded.name;

    // Fallback: If email/phone missing in token, fetch from Auth User Record
    if (!phone && !email) {
      console.log(
        "Contact info missing in token, fetching from Firebase Admin..."
      );
      try {
        const userRecord = await admin.auth().getUser(firebaseUid);
        console.log(
          "Fetched User Record:",
          JSON.stringify(userRecord, null, 2)
        );
        if (userRecord.email) email = userRecord.email;
        if (userRecord.phoneNumber) phone = userRecord.phoneNumber;
        if (userRecord.displayName && !name) name = userRecord.displayName;
      } catch (fetchErr) {
        console.error("Failed to fetch user record:", fetchErr);
      }
    }

    if (!phone && !email) {
      console.error("Login failed: Phone or Email required but not found.");
      return res.status(400).json({
        message: "Phone number or email required",
        debug: { uid: firebaseUid, claims: decoded },
      });
    }

    // 2️⃣ Find or create user
    let user = await findUserByFirebaseUid(firebaseUid);

    if (!user) {
      user = await createUser(firebaseUid, phone, email, name);
    }

    // 3️⃣ Issue JWT (include is_admin flag)
    const token = jwt.sign(
      { userId: user.id, is_admin: (user as any).is_admin ?? false },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    // 4️⃣ Set cookie — environment-aware options
    const isProd = process.env.NODE_ENV === "production";
    // When in production and your frontend is on a different domain, use SameSite=None and secure
    const cookieOptions: any = {
      httpOnly: true,
      secure: isProd, // true in production (requires HTTPS)
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    // Optional: set cookie domain if FRONTEND_URL specifies a domain
    if (process.env.FRONTEND_URL) {
      try {
        const url = new URL(process.env.FRONTEND_URL.split(",")[0].trim());
        cookieOptions.domain = url.hostname;
      } catch (e) {
        // ignore invalid FRONTEND_URL
      }
    }

    res.cookie("token", token, cookieOptions);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        is_admin: (user as any).is_admin ?? false,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

/**
 * LOGOUT
 */
router.post("/logout", (_req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  if (process.env.FRONTEND_URL) {
    try {
      const url = new URL(process.env.FRONTEND_URL.split(",")[0].trim());
      cookieOptions.domain = url.hostname;
    } catch (e) {
      // ignore invalid FRONTEND_URL
    }
  }

  res.clearCookie("token", cookieOptions);

  res.json({ message: "Logged out successfully" });
});

export default router;
