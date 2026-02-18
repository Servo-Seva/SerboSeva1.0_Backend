import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import addressRoutes from "./routes/address.routes";
import categoryRoutes from "./routes/category.routes";
import serviceRoutes from "./routes/service.routes";
import adminRoutes from "./routes/admin.routes";
import publicRoutes from "./routes/public.routes";
import serviceProcessRoutes from "./routes/service-process.routes";
import reviewRoutes from "./routes/review.routes";
import bookingRoutes from "./routes/booking.routes";
import webhookRoutes from "./routes/webhook.routes";
import providerRegistrationRoutes from "./routes/provider-registration.routes";
import providerAuthRoutes from "./routes/provider-auth.routes";
import providerPaymentRoutes from "./routes/provider-payment.routes";
import providerNotificationRoutes from "./routes/provider-notification.routes";
import slotRoutes from "./routes/slot.routes";
import supportTicketRoutes from "./routes/support-ticket.routes";
import offerRoutes from "./routes/offer.routes";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Trust proxy when deploying behind a proxy (e.g. Heroku, nginx, Vercel)
// so secure cookies work when TLS is terminated upstream.
app.set("trust proxy", 1);

// Allow configuring frontend origin(s) via FRONTEND_URL (comma separated)
const rawOrigins =
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8081,http://localhost:8081,http://127.0.0.1:8082,http://localhost:8082,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000";
const whitelist = rawOrigins.split(",").map((s) => s.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      if (whitelist.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      // Allow dynamic ports for testing? For now, strict whitelist but expanded.
      console.log("CORS Check for origin:", origin);
      // Return false but allow the request to proceed (will show in logs)
      callback(null, false);
    },
    credentials: true,
  }),
);

// Increase body size limit to handle image uploads (base64 encoded)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use(userRoutes);
app.use(addressRoutes);
app.use(categoryRoutes);
app.use(serviceRoutes);

// Admin routes (protected, requires admin role)
app.use("/api/admin", adminRoutes);

// Public API routes (v2 - subcategory based)
app.use("/api", publicRoutes);

// Service process routes (processes, FAQs, includes, excludes)
app.use("/api", serviceProcessRoutes);

// Review routes (user reviews for services)
app.use("/api", reviewRoutes);

// Booking routes (user bookings)
app.use("/api/bookings", bookingRoutes);

// Provider registration routes (public - no auth required)
app.use("/api/provider-registration", providerRegistrationRoutes);

// Provider authentication routes (login, dashboard)
app.use("/api/provider-auth", providerAuthRoutes);

// Provider payment details routes (bank accounts, UPI)
app.use("/api/provider-payment", providerPaymentRoutes);

// Provider notification routes (FCM token, notification history)
app.use("/api/provider/notifications", providerNotificationRoutes);

// Slot availability routes (time slots for bookings)
app.use("/api", slotRoutes);

// Support ticket routes (provider support requests)
app.use("/api/support-tickets", supportTicketRoutes);

// Offer routes (promotional banners and discounts)
app.use("/api", offerRoutes);

// Webhook routes (payment gateway callbacks - no auth required)
app.use("/api/webhooks", webhookRoutes);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Global error handler:", err);

    // Handle PostgreSQL errors
    if (err.code && err.code.startsWith("22")) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    // Handle other errors
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  },
);

export default app;
