# ServoSeva API Documentation

## Overview

This API provides endpoints for managing service categories, subcategories, services, and providers.

- **Authentication**: JWT-based auth via cookies
- **Admin Role**: Required for `/admin/*` endpoints
- **Base URL**: `http://localhost:3000`

---

## Database Schema

### Existing Table (DO NOT MODIFY)

```sql
categories
- id (uuid, PK)
- name
- description
- created_at
```

### New Tables

```sql
subcategories
- id (uuid, PK)
- category_id (uuid, FK → categories.id)
- name
- icon
- created_at

providers
- id (uuid, PK)
- name
- phone (unique)
- experience (integer)
- status ('pending' | 'active' | 'blocked')
- avatar_url
- created_at

provider_services (ADMIN ASSIGNMENT TABLE)
- id (uuid, PK)
- provider_id (uuid, FK → providers.id)
- service_id (uuid, FK → services.id)
- status ('active' | 'inactive')
- created_at
- UNIQUE(provider_id, service_id)

services (modified)
- subcategory_id (uuid, FK → subcategories.id) -- NEW COLUMN
- base_price (numeric) -- NEW COLUMN
```

---

## Admin APIs (Requires Admin Role)

### 1. Create Subcategory

```
POST /admin/subcategories
```

**Request Body:**

```json
{
  "categoryId": "uuid",
  "name": "Home Appliances",
  "icon": "❄️"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category_id": "uuid",
    "name": "Home Appliances",
    "icon": "❄️",
    "created_at": "2026-01-10T..."
  }
}
```

---

### 2. Create Service

```
POST /admin/services
```

**Request Body:**

```json
{
  "subcategoryId": "uuid",
  "name": "AC Installation",
  "description": "Professional AC installation service",
  "basePrice": 1500,
  "durationMinutes": 60,
  "thumbnailUrl": "https://..."
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subcategory_id": "uuid",
    "name": "AC Installation",
    "description": "Professional AC installation service",
    "base_price": "1500",
    "is_active": true,
    "created_at": "2026-01-10T..."
  }
}
```

---

### 3. Create Provider

```
POST /admin/providers
```

**Request Body:**

```json
{
  "name": "John Doe",
  "phone": "+919876543210",
  "experience": 5,
  "status": "active",
  "avatarUrl": "https://..."
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+919876543210",
    "experience": 5,
    "status": "active",
    "avatar_url": "https://...",
    "created_at": "2026-01-10T..."
  }
}
```

---

### 4. Assign Provider to Services

```
POST /admin/assign-provider
```

**Request Body:**

```json
{
  "providerId": "uuid",
  "serviceIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "assigned": [
      {
        "id": "uuid",
        "provider_id": "uuid",
        "service_id": "uuid-1",
        "status": "active",
        "created_at": "..."
      }
    ],
    "skipped": 1,
    "message": "2 assigned, 1 skipped (already assigned or service not found)"
  }
}
```

**Rules:**

- Prevents duplicate provider-service mappings
- Uses `ON CONFLICT DO NOTHING`
- Returns count of skipped duplicates

---

### 5. Enable/Disable Provider Service

```
PATCH /admin/provider-services/:id
```

**Request Body:**

```json
{
  "status": "inactive"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider_id": "uuid",
    "service_id": "uuid",
    "status": "inactive",
    "created_at": "..."
  }
}
```

---

### 6. Get All Providers (Admin)

```
GET /admin/providers
GET /admin/providers?status=active
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210",
      "experience": 5,
      "status": "active",
      "avatar_url": "...",
      "created_at": "...",
      "service_count": 3
    }
  ]
}
```

---

### 7. Get All Provider-Service Assignments

```
GET /admin/provider-services
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "service_id": "uuid",
      "status": "active",
      "created_at": "...",
      "provider_name": "John Doe",
      "provider_phone": "+91...",
      "provider_experience": 5,
      "provider_status": "active",
      "service_name": "AC Installation",
      "service_description": "...",
      "service_base_price": "1500"
    }
  ]
}
```

---

## Public APIs (User)

### 1. Get Categories

```
GET /api/categories
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "AC & Appliances",
      "description": "...",
      "created_at": "...",
      "service_count": 15
    }
  ]
}
```

---

### 2. Get Subcategories by Category

```
GET /api/categories/:categoryId/subcategories
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "name": "Home Appliances",
      "icon": "❄️",
      "created_at": "..."
    }
  ],
  "category": {
    "id": "uuid",
    "name": "AC & Appliances"
  }
}
```

---

### 3. Get Services by Subcategory

```
GET /api/subcategories/:subcategoryId/services
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "subcategory_id": "uuid",
      "name": "AC Installation",
      "description": "...",
      "base_price": "1500",
      "is_active": true,
      "avg_rating": 4.5,
      "reviews_count": 120,
      "duration_minutes": 60,
      "thumbnail_url": "..."
    }
  ],
  "subcategory": {
    "id": "uuid",
    "name": "Home Appliances",
    "icon": "❄️",
    "category_id": "uuid"
  }
}
```

---

### 4. Get Providers for Service

```
GET /api/services/:serviceId/providers
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "provider_name": "John Doe",
      "provider_phone": "+919876543210",
      "provider_experience": 5,
      "provider_avatar_url": "...",
      "assignment_status": "active"
    }
  ],
  "service": {
    "id": "uuid",
    "name": "AC Installation"
  }
}
```

**Rules:**

- Only returns providers where:
  - `provider_services.status = 'active'`
  - `providers.status = 'active'`

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "name is required"
}
```

### 401 Unauthorized

```json
{
  "message": "Not authenticated"
}
```

### 403 Forbidden

```json
{
  "message": "Admin access required"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Category not found"
}
```

### 409 Conflict

```json
{
  "success": false,
  "error": "Provider with this phone number already exists"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to create subcategory"
}
```

---

## Architecture

```
src/
├── app.ts                    # Express app configuration
├── server.ts                 # Server entry point
├── db.ts                     # PostgreSQL connection
├── middlewares/
│   ├── auth.middleware.ts    # JWT authentication
│   └── admin.middleware.ts   # Admin role verification
├── models/
│   ├── category.model.ts     # Category queries
│   ├── subcategory.model.ts  # Subcategory queries
│   ├── provider.model.ts     # Provider queries
│   ├── provider-service.model.ts  # Assignment queries
│   ├── service-v2.model.ts   # Service queries (v2)
│   └── service-process.model.ts  # Service process/FAQs/includes/excludes
└── routes/
    ├── admin.routes.ts       # Admin endpoints
    ├── public.routes.ts      # Public user endpoints
    └── service-process.routes.ts  # Service process endpoints
```

---

## Service Process API

These endpoints manage the different processes/steps for each service, along with FAQs, cover promises, includes, and excludes.

### Database Tables

```sql
service_processes
- id (uuid, PK)
- service_id (uuid, FK → services.id)
- step_number (integer)
- title (text)
- description (text)
- icon (text, default 'check')
- estimated_minutes (integer)
- is_required (boolean)
- created_at, updated_at

service_cover_promises
- id (uuid, PK)
- service_id (uuid, FK → services.id)
- title (text)
- description (text)
- icon (text)
- sort_order (integer)
- is_active (boolean)

service_faqs
- id (uuid, PK)
- service_id (uuid, FK → services.id)
- question (text)
- answer (text)
- sort_order (integer)
- is_active (boolean)

service_includes
- id (uuid, PK)
- service_id (uuid, FK → services.id)
- item (text)
- description (text)
- sort_order (integer)

service_excludes
- id (uuid, PK)
- service_id (uuid, FK → services.id)
- item (text)
- description (text)
- sort_order (integer)
```

### Public Endpoints

#### GET /api/services/:serviceId/process-details

Get all process details for a service.

**Response:**

```json
{
  "success": true,
  "data": {
    "processes": [
      {
        "id": "uuid",
        "service_id": "uuid",
        "step_number": 1,
        "title": "Inspection",
        "description": "We inspect the area",
        "icon": "search",
        "estimated_minutes": 10
      }
    ],
    "coverPromises": [
      {
        "id": "uuid",
        "title": "30-Day Warranty",
        "description": "Free re-service if issues arise"
      }
    ],
    "faqs": [
      {
        "id": "uuid",
        "question": "What if I need to reschedule?",
        "answer": "You can reschedule anytime..."
      }
    ],
    "includes": [
      {
        "id": "uuid",
        "item": "Professional tools",
        "description": "All tools provided by technician"
      }
    ],
    "excludes": [
      {
        "id": "uuid",
        "item": "Spare parts",
        "description": "Charged separately if needed"
      }
    ]
  }
}
```

#### GET /api/services/:serviceId/processes

Get process steps only.

#### GET /api/services/:serviceId/cover-promises

Get cover promises only.

#### GET /api/services/:serviceId/faqs

Get FAQs only.

#### GET /api/services/:serviceId/includes

Get what's included only.

#### GET /api/services/:serviceId/excludes

Get what's excluded only.

### Admin Endpoints (Requires Auth)

#### PUT /api/admin/services/:serviceId/process-details

Bulk update all process details for a service.

**Request Body:**

```json
{
  "processes": [
    {
      "step_number": 1,
      "title": "Inspection",
      "description": "Check the area",
      "icon": "search",
      "estimated_minutes": 10
    },
    {
      "step_number": 2,
      "title": "Service",
      "description": "Perform the service"
    }
  ],
  "coverPromises": [
    {
      "title": "30-Day Warranty",
      "description": "Free re-service"
    }
  ],
  "faqs": [
    {
      "question": "How long does it take?",
      "answer": "Usually 1-2 hours"
    }
  ],
  "includes": [
    {
      "item": "Tools & Equipment"
    }
  ],
  "excludes": [
    {
      "item": "Spare parts"
    }
  ]
}
```

#### PUT /api/admin/services/:serviceId/processes

Bulk update process steps only.

#### PUT /api/admin/services/:serviceId/cover-promises

Bulk update cover promises only.

#### PUT /api/admin/services/:serviceId/faqs

Bulk update FAQs only.

#### PUT /api/admin/services/:serviceId/includes

Bulk update includes only.

#### PUT /api/admin/services/:serviceId/excludes

Bulk update excludes only.

#### POST /api/admin/services/:serviceId/processes

Add a single process step.

#### POST /api/admin/services/:serviceId/cover-promises

Add a single cover promise.

#### POST /api/admin/services/:serviceId/faqs

Add a single FAQ.

#### PATCH /api/admin/processes/:processId

Update a single process step.

#### PATCH /api/admin/cover-promises/:promiseId

Update a single cover promise.

#### PATCH /api/admin/faqs/:faqId

Update a single FAQ.

#### DELETE /api/admin/processes/:processId

Delete a process step.

#### DELETE /api/admin/cover-promises/:promiseId

Delete a cover promise.

#### DELETE /api/admin/faqs/:faqId

Delete a FAQ.

---

## Key Business Rules

1. **Providers have a separate table** - Not linked to users
2. **Providers CANNOT select categories or services** - No self-selection
3. **ONLY ADMIN can assign providers to services** - Via `/admin/assign-provider`
4. **Users book SERVICES, not providers** - Provider is assigned by system
5. **Providers appear only if ADMIN assigned them** - Filtered by assignment status
6. **Each service can have unique process steps** - Managed via service_processes table
7. **FAQs, includes, excludes are service-specific** - Allows customization per service
