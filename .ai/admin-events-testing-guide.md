# Testing Guide: GET /api/admin/events

## Overview

This document outlines testing scenarios for the admin events analytics endpoint.

## Test Environment Setup

### Prerequisites
- Admin user account with valid bearer token
- Non-admin user account for authorization tests
- Test events seeded in the database
- Rate limiting should be testable (or clearable between tests)

### Test Data Requirements
- Events with different `event_type` values
- Events across different time ranges
- Events linked to various `report_id` and `user_id` values
- Mix of staff/non-staff IPs and bot/non-bot events

---

## Test Scenarios

### 1. Authentication & Authorization Tests

#### 1.1 Missing Authorization Header
**Request:**
```
GET /api/admin/events
```

**Expected Response:**
- Status: 401 Unauthorized
- Body: `{ "code": "unauthorized", "message": "Invalid or missing authentication token" }`

#### 1.2 Invalid Bearer Token
**Request:**
```
GET /api/admin/events
Authorization: Bearer invalid_token_12345
```

**Expected Response:**
- Status: 401 Unauthorized
- Body: `{ "code": "unauthorized", "message": "..." }`

#### 1.3 Valid Token but Non-Admin User
**Request:**
```
GET /api/admin/events
Authorization: Bearer <valid_non_admin_token>
```

**Expected Response:**
- Status: 403 Forbidden
- Body: `{ "code": "forbidden", "message": "Admin privileges required" }`

#### 1.4 Valid Admin Token
**Request:**
```
GET /api/admin/events
Authorization: Bearer <valid_admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: Paginated list of events

---

### 2. Pagination Tests

#### 2.1 Default Pagination
**Request:**
```
GET /api/admin/events
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body includes:
  - `page: 1`
  - `page_size: 20`
  - `items`: Array with ≤ 20 items
  - `total_items`: Total count
  - `total_pages`: Calculated total pages

#### 2.2 Custom Page Size
**Request:**
```
GET /api/admin/events?page_size=50
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: `page_size: 50`, items array with ≤ 50 items

#### 2.3 Page Size Clamping (Max 100)
**Request:**
```
GET /api/admin/events?page_size=200
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: `page_size: 100` (clamped to maximum)

#### 2.4 Page Size Clamping (Min 1)
**Request:**
```
GET /api/admin/events?page_size=0
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: Validation error about page_size

#### 2.5 Navigating Pages
**Request:**
```
GET /api/admin/events?page=2&page_size=10
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: `page: 2`, items from second page (skip first 10)

#### 2.6 Out of Range Page
**Request:**
```
GET /api/admin/events?page=999999
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: Empty `items` array, but valid pagination metadata

---

### 3. Event Type Filtering Tests

#### 3.1 Single Event Type
**Request:**
```
GET /api/admin/events?event_type=report_view
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have `event_type: "report_view"`

#### 3.2 Multiple Event Types (Repeated Params)
**Request:**
```
GET /api/admin/events?event_type=login&event_type=registration_complete
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have `event_type` in ["login", "registration_complete"]

#### 3.3 Multiple Event Types (Comma-Separated)
**Request:**
```
GET /api/admin/events?event_type=report_view,table_view
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have `event_type` in ["report_view", "table_view"]

#### 3.4 Invalid Event Type
**Request:**
```
GET /api/admin/events?event_type=invalid_type
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: Validation error about invalid event_type

#### 3.5 Duplicate Event Types (Should Deduplicate)
**Request:**
```
GET /api/admin/events?event_type=login,login,login
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Should work correctly (duplicates removed internally)

---

### 4. Time Range Filtering Tests

#### 4.1 Filter by occurred_after
**Request:**
```
GET /api/admin/events?occurred_after=2025-01-01T00:00:00Z
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have `occurred_at >= "2025-01-01T00:00:00Z"`

#### 4.2 Filter by occurred_before
**Request:**
```
GET /api/admin/events?occurred_before=2025-12-31T23:59:59Z
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have `occurred_at <= "2025-12-31T23:59:59Z"`

#### 4.3 Filter by Both (Valid Range)
**Request:**
```
GET /api/admin/events?occurred_after=2025-01-01T00:00:00Z&occurred_before=2025-12-31T23:59:59Z
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items within the specified range

#### 4.4 Invalid Date Range (after > before)
**Request:**
```
GET /api/admin/events?occurred_after=2025-12-31T00:00:00Z&occurred_before=2025-01-01T00:00:00Z
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: `{ "code": "bad_request", "message": "occurred_after must be <= occurred_before" }`

#### 4.5 Invalid Date Format
**Request:**
```
GET /api/admin/events?occurred_after=not-a-date
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: Validation error about invalid datetime

---

### 5. Entity Filtering Tests

#### 5.1 Filter by report_id
**Request:**
```
GET /api/admin/events?report_id=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have matching `report_id` (or null if not applicable)

#### 5.2 Filter by user_id
**Request:**
```
GET /api/admin/events?user_id=660e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items have matching `user_id`

#### 5.3 Invalid UUID Format (report_id)
**Request:**
```
GET /api/admin/events?report_id=invalid-uuid
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: Validation error about invalid UUID

#### 5.4 Invalid UUID Format (user_id)
**Request:**
```
GET /api/admin/events?user_id=not-a-uuid
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 400 Bad Request
- Body: Validation error about invalid UUID

---

### 6. Combined Filtering Tests

#### 6.1 Multiple Filters Combined
**Request:**
```
GET /api/admin/events?event_type=report_view&occurred_after=2025-01-01T00:00:00Z&page_size=50
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- All items match ALL filters (AND logic)

#### 6.2 Filters Resulting in Empty Set
**Request:**
```
GET /api/admin/events?event_type=report_view&occurred_after=2099-01-01T00:00:00Z
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Body: `items: []`, but valid pagination structure

---

### 7. Response Structure Tests

#### 7.1 Verify All Admin Fields Present
**Request:**
```
GET /api/admin/events?page_size=1
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Each item in `items` array must contain:
  - `event_id` (UUID)
  - `user_id` (UUID or null)
  - `event_type` (string)
  - `occurred_at` (ISO datetime)
  - `user_agent` (string or null)
  - `ip_hash` (string - hashed, not raw IP)
  - `dwell_seconds` (number or null)
  - `metadata` (JSON or null)
  - `is_staff_ip` (boolean)
  - `is_bot` (boolean)
  - `report_id` (UUID or null)

#### 7.2 Verify Ordering (occurred_at DESC)
**Request:**
```
GET /api/admin/events?page_size=10
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Items ordered by `occurred_at` descending (newest first)

---

### 8. Rate Limiting Tests

#### 8.1 Within Rate Limit
**Test:**
- Send 30 requests within 1 minute from same admin user

**Expected Response:**
- All 30 requests return 200 OK

#### 8.2 Exceeding Rate Limit
**Test:**
- Send 31 requests within 1 minute from same admin user

**Expected Response:**
- First 30 requests: 200 OK
- 31st request: 429 Too Many Requests
- Body: `{ "code": "rate_limited", "message": "Rate limit exceeded. Maximum 30 requests per minute." }`

#### 8.3 Rate Limit Per User
**Test:**
- Admin A sends 30 requests
- Admin B sends 30 requests
- Both within same minute

**Expected Response:**
- All requests from both admins succeed (rate limit is per-user)

#### 8.4 Rate Limit Window Reset
**Test:**
- Send 30 requests (exhaust limit)
- Wait 60+ seconds
- Send another request

**Expected Response:**
- After waiting, new request succeeds (200 OK)

---

### 9. Error Handling & Edge Cases

#### 9.1 Database Connection Error
**Scenario:** Simulate database unavailability

**Expected Response:**
- Status: 500 Internal Server Error
- Body: `{ "code": "server_error", "message": "Failed to retrieve events" }`
- Server logs error details (not exposed to client)

#### 9.2 Large Result Set Performance
**Test:**
- Query with no filters on large dataset (10,000+ events)
- Request `page_size=100`

**Expected Response:**
- Status: 200 OK
- Response time should be reasonable (<2 seconds)

#### 9.3 Special Characters in String Params
**Request:**
```
GET /api/admin/events?event_type=report_view%2Ctable_view
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- URL-encoded comma is properly decoded

---

### 10. Cache Control Tests

#### 10.1 Verify No-Store Header
**Request:**
```
GET /api/admin/events
Authorization: Bearer <admin_token>
```

**Expected Response:**
- Status: 200 OK
- Headers include: `cache-control: no-store`

---

## Performance Benchmarks

### Expected Response Times
- Simple query (no filters): < 500ms
- Complex query (multiple filters): < 1000ms
- Large page size (100 items): < 1500ms

### Database Query Efficiency
- Should use indexes on:
  - `event_type`
  - `occurred_at` (DESC)
  - `report_id`
  - `user_id`

---

## Security Tests

### 10.1 SQL Injection Attempts
**Test:** Attempt SQL injection in various params
```
GET /api/admin/events?user_id='; DROP TABLE events; --
```

**Expected:** Parameters are safely escaped/validated, no SQL injection

### 10.2 XSS in Metadata
**Verify:** Returned JSON is properly escaped, no XSS possible

### 10.3 Sensitive Data Exposure
**Verify:**
- `ip_hash` is hashed, not raw IP
- No overly sensitive metadata exposed
- Admin-only fields only accessible by admins

---

## Integration Test Checklist

- [ ] Authentication: Unauthorized access blocked
- [ ] Authorization: Non-admin access blocked
- [ ] Validation: Invalid params rejected with 400
- [ ] Pagination: All scenarios work correctly
- [ ] Filtering: All filter combinations work
- [ ] Rate limiting: 30/min enforced per admin
- [ ] Response structure: All fields present and correct types
- [ ] Ordering: Events ordered by occurred_at DESC
- [ ] Error handling: Proper status codes for all errors
- [ ] Cache headers: no-store present
- [ ] Performance: Response times acceptable
- [ ] Security: No injection vulnerabilities

---

## Test Automation Recommendations

### Unit Tests
- Validation schema (`parseAdminEventsQuery`)
- Rate limiter logic
- Service layer (`listAdminEvents`)
- Authorization helper (`requireAdmin`)

### Integration Tests
- Full endpoint flow with real database
- Authentication/authorization flows
- All filter combinations
- Error scenarios

### Load Tests
- Rate limit enforcement under load
- Large result set pagination
- Concurrent admin users

