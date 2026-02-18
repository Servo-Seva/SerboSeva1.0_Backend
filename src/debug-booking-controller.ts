import "dotenv/config";
import { Request, Response } from "express";
import { getUserBookings } from "./services/booking.service";

const mockReq = {
  userId: "e0c805e8-b1a7-465f-8af4-ceea41bf7b92",
  query: {
    limit: 5,
    offset: 0,
  },
} as unknown as Request;

const mockRes = {
  status: (code: number) => {
    console.log(`Response Status: ${code}`);
    return mockRes;
  },
  json: (data: any) => {
    console.log("Response JSON:");
    console.log(JSON.stringify(data, null, 2));
    return mockRes;
  },
} as unknown as Response;

const mockNext = (err: any) => {
  console.error("Next called with error:", err);
};

console.log("Running getUserBookings...");
getUserBookings(mockReq, mockRes, mockNext)
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Crash:", e);
    process.exit(1);
  });
