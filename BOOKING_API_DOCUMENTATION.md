# ServoSeva Booking & Payment API Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Cart → Checkout → Select Payment Mode → Pay/Confirm → Track Booking   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐     ┌──────────────────────┐                  │
│  │   COD Flow           │     │   Online Payment     │                  │
│  ├──────────────────────┤     ├──────────────────────┤                  │
│  │ 1. Create Booking    │     │ 1. Create Booking    │                  │
│  │    (status:confirmed)│     │    (status:pending)  │                  │
│  │ 2. Assign Provider   │     │ 2. Create Razorpay   │                  │
│  │ 3. Service Done      │     │    Order             │                  │
│  │ 4. Collect Payment   │     │ 3. Return order_id   │                  │
│  └──────────────────────┘     │    to frontend       │                  │
│                               │ 4. Frontend opens    │                  │
│                               │    Razorpay popup    │                  │
│                               │ 5. Payment done      │                  │
│                               │ 6. Verify signature  │                  │
│                               │ 7. Confirm booking   │                  │
│                               └──────────────────────┘                  │
│                                         │                                │
│                                         ▼                                │
│                           ┌─────────────────────────┐                   │
│                           │   Razorpay Webhook      │                   │
│                           │   (payment.captured)    │                   │
│                           │   (payment.failed)      │                   │
│                           │   (refund.processed)    │                   │
│                           └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Checkout (Main Entry Point)

**POST** `/api/bookings/checkout`

Creates bookings with support for both COD and Online payment.

#### Request Body:

```json
{
  "items": [
    {
      "service": {
        "service_id": "uuid",
        "service_name": "AC Repair",
        "quantity": 1,
        "price": 499,
        "category": "AC & Appliances",
        "image_url": "https://..."
      },
      "slot": {
        "date": "2026-01-25",
        "time": "09:00-11:00"
      }
    }
  ],
  "delivery_address": {
    "full_name": "John Doe",
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "Kolkata",
    "state": "West Bengal",
    "pincode": "700001",
    "phone": "9876543210"
  },
  "address_id": "uuid (optional)",
  "payment_mode": "cod | online",
  "promo_code": "SAVE20 (optional)",
  "discount_amount": 100,
  "tip_amount": 50,
  "customer_notes": "Please come after 10 AM",
  "idempotency_key": "unique-key-for-retry"
}
```

#### Response (COD):

```json
{
  "success": true,
  "batch_id": "uuid",
  "bookings_count": 1,
  "payment_mode": "cod",
  "total_amount": 449,
  "message": "Booking confirmed! Pay after service completion.",
  "bookings": [
    {
      "id": "uuid",
      "order_number": "SS-20260125-0001",
      "status": "confirmed",
      "payment_status": "pending",
      "service_otp": "123456",
      ...
    }
  ]
}
```

#### Response (ONLINE):

```json
{
  "success": true,
  "batch_id": "uuid",
  "bookings_count": 1,
  "payment_mode": "online",
  "total_amount": 449,
  "bookings": [...],
  "payment": {
    "gateway": "razorpay",
    "order_id": "order_ABC123",
    "amount": 44900,
    "currency": "INR",
    "key_id": "rzp_test_xxx",
    "expires_at": "2026-01-25T10:15:00Z"
  }
}
```

---

### 2. Verify Payment (After Razorpay Success)

**POST** `/api/bookings/verify-payment`

Called by frontend after successful Razorpay payment popup.

#### Request Body:

```json
{
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "signature_hash",
  "batch_id": "uuid"
}
```

#### Response:

```json
{
  "success": true,
  "message": "Payment verified and booking confirmed!",
  "bookings": [
    {
      "id": "uuid",
      "status": "confirmed",
      "payment_status": "paid",
      ...
    }
  ]
}
```

---

### 3. Cancel Booking (with Refund)

**POST** `/api/bookings/:id/cancel`

Cancels booking and initiates refund based on cancellation policy.

#### Cancellation Policy:

| Time Before Service | Refund |
| ------------------- | ------ |
| > 24 hours          | 100%   |
| 6-24 hours          | 50%    |
| < 6 hours           | 0%     |

#### Request Body:

```json
{
  "cancellation_reason": "Changed my mind"
}
```

#### Response:

```json
{
  "success": true,
  "message": "Booking cancelled",
  "booking": {...},
  "refund": {
    "amount": 449,
    "percentage": 100,
    "status": "initiated",
    "refund_id": "rfnd_ABC123"
  }
}
```

---

### 4. Get User Bookings

**GET** `/api/bookings`

Query params: `status`, `limit`, `offset`

```json
{
  "success": true,
  "bookings": [...]
}
```

---

### 5. Get Booking Details

**GET** `/api/bookings/:id`

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "order_number": "SS-20260125-0001",
    "status": "assigned",
    "payment_status": "paid",
    "service": {...},
    "provider_name": "Rajesh Kumar",
    "provider_phone": "9876543210",
    "service_otp": "123456",
    ...
  }
}
```

---

### 6. Verify Service OTP (Provider)

**POST** `/api/bookings/:id/verify-otp`

Provider verifies OTP to start service.

```json
{ "otp": "123456" }
```

---

### 7. Complete Service (Provider)

**POST** `/api/bookings/:id/complete`

```json
{ "provider_notes": "Service completed successfully" }
```

---

### 8. Razorpay Webhook

**POST** `/api/webhooks/razorpay`

Server-to-server callback from Razorpay.

Headers:

- `x-razorpay-signature`: HMAC signature for verification

---

## Database Schema

### bookings

| Column          | Type        | Description                                                      |
| --------------- | ----------- | ---------------------------------------------------------------- |
| id              | UUID        | Primary key                                                      |
| batch_id        | UUID        | Groups multi-service checkout                                    |
| order_number    | VARCHAR(20) | Human readable: SS-YYYYMMDD-XXXX                                 |
| user_id         | TEXT        | FK to users                                                      |
| service         | JSONB       | Service details                                                  |
| subtotal        | DECIMAL     | Before discounts                                                 |
| discount_amount | DECIMAL     | Promo discount                                                   |
| tip_amount      | DECIMAL     | Tip to provider                                                  |
| tax_amount      | DECIMAL     | Tax applied                                                      |
| total_amount    | DECIMAL     | Final amount                                                     |
| status          | VARCHAR     | pending_payment → confirmed → assigned → in_progress → completed |
| payment_mode    | VARCHAR     | cod / online                                                     |
| payment_status  | VARCHAR     | pending → paid / failed / refunded                               |
| pg_order_id     | VARCHAR     | Razorpay order ID                                                |
| pg_payment_id   | VARCHAR     | Razorpay payment ID                                              |
| provider_id     | UUID        | Assigned provider                                                |
| service_otp     | VARCHAR(6)  | OTP for verification                                             |
| expires_at      | TIMESTAMP   | Payment expiry for online                                        |
| idempotency_key | VARCHAR     | Prevent duplicate bookings                                       |

### payment_transactions

| Column           | Type    | Description                  |
| ---------------- | ------- | ---------------------------- |
| id               | UUID    | Primary key                  |
| booking_id       | UUID    | FK to bookings               |
| transaction_type | VARCHAR | payment / refund             |
| amount           | DECIMAL | Transaction amount           |
| status           | VARCHAR | initiated → success / failed |
| gateway_response | JSONB   | Full gateway response        |

---

## Frontend Integration (Razorpay)

```typescript
// After receiving checkout response for online payment
const { payment } = checkoutResponse;

const options = {
  key: payment.key_id,
  amount: payment.amount,
  currency: payment.currency,
  order_id: payment.order_id,
  name: "ServoSeva",
  description: "Service Booking",
  handler: async (response) => {
    // Verify payment on backend
    await api.post("/api/bookings/verify-payment", {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      batch_id: checkoutResponse.batch_id,
    });

    // Navigate to success page
    navigate("/booking-success");
  },
  prefill: {
    name: user.name,
    email: user.email,
    contact: user.phone,
  },
  theme: { color: "#3B82F6" },
};

const razorpay = new Razorpay(options);
razorpay.open();
```

---

## Edge Cases Handled

### 1. Payment Success but Booking Fails

- Webhook ensures booking is confirmed even if frontend verification fails
- Idempotent webhook processing prevents duplicate updates

### 2. Booking Created but Payment Not Completed

- `expires_at` field tracks payment timeout (15 minutes)
- Background job cancels expired bookings
- Status set to `failed` with reason "Payment timeout"

### 3. COD Cancellation After Provider Assignment

- Cancellation allowed until service is `in_progress`
- Provider notified via push notification
- No refund needed for COD

### 4. Duplicate Booking Prevention

- `idempotency_key` field ensures same checkout creates same bookings
- Returns existing batch if key matches

### 5. Double Payment Prevention

- Razorpay order is single-use
- Signature verification ensures authenticity
- Webhook is idempotent (checks `payment_status` before updating)

---

## Environment Variables

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# Database
DATABASE_URL=postgres://...

# JWT
JWT_SECRET=your-secret-key
```

---

## Security Best Practices

1. **Signature Verification**: All Razorpay callbacks verified via HMAC
2. **Idempotency**: Prevent duplicate bookings with idempotency keys
3. **Authorization**: User can only access their own bookings
4. **Rate Limiting**: Implement on checkout endpoint (recommended)
5. **Webhook IP Whitelisting**: Optional for production
6. **Logging**: All payment transactions logged with full gateway response

---

## Scalability Considerations

1. **Batch ID**: Groups bookings for efficient querying
2. **Indexes**: Optimized queries on user_id, status, order_id
3. **Pagination**: All list endpoints support limit/offset
4. **Background Jobs**: Expired booking cleanup runs async
5. **Transaction Audit**: Full payment history for reconciliation
6. **Stateless API**: No session state, JWT-based auth
