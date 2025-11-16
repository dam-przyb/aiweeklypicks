## API Endpoint Implementation Plan: POST /api/events

### 1. Endpoint Overview

Public endpoint to ingest client events (e.g., `registration_complete`, `login`, `report_view`, `table_view`). Validates input, enforces rate limits, computes a salted IP hash, and records the event via a SECURITY DEFINER RPC that sets server-controlled fields (`occurred_at`, bot/staff flags via triggers). Associates `auth.uid()` when a bearer token is provided but does not require authentication.

### 2. Request Details

- **HTTP Method**: POST
- **URL**: `/api/events`
- **Headers**:
  - `Authorization: Bearer <access_token>` (optional)
  - `Content-Type: application/json` (required)
- **Request Body** (matches `PostEventCommand`):
  - `event_type`: one of `registration_complete | login | report_view | table_view` (required)
  - `dwell_seconds`: number (optional; required and must be ≥ 10 for `report_view`)
  - `report_id`: UUID (optional; typically for `report_view`)
  - `metadata`: object (optional; JSON)

Validation rules:
- `event_type` must be from the allowed set.
- When `event_type == 'report_view'`: `dwell_seconds` is required and `>= 10`.
- `report_id` must be a valid UUID when present.
- `metadata` must be a JSON object (no arrays/primitives) and size-limited (recommend ≤ 8KB serialized) to prevent abuse.

Rate limits (per API plan):
- Global: 60/min per IP for all POSTs to `/api/events`.
- Additional: 10/min per user (when authenticated) for `report_view` events.

### 3. Used Types

- From `src/types.ts`:
  - `PublicEventType`
  - `PostEventCommand`
  - `PostEventAcceptedDTO`
- Entities (DB): `events` (partitioned), `weekly_reports` (for FK on `report_id`), `staff_networks` (used by triggers)

### 4. Response Details

- **202 Accepted** (success)
  - Body: `PostEventAcceptedDTO` → `{ event_id: UUID, accepted: true }`
- **400 Bad Request**
  - Invalid body, bad UUID, wrong `event_type`, missing `dwell_seconds` for `report_view`, excessive metadata size
- **422 Unprocessable Entity**
  - `dwell_seconds < 10` for `report_view`
- **429 Too Many Requests**
  - Rate limit exceeded (per IP or per-user `report_view` constraint)
- **500 Internal Server Error**
  - Unexpected server/RPC error

### 5. Data Flow

1. Extract bearer token (if any) and ensure `locals.supabase` is a per-request client bound to that token (middleware responsibility).
2. Parse and validate JSON body (`PostEventCommand`) with Zod, including conditional rules for `report_view`.
3. Compute `ip_hash` using a secret salt and the best-effort client IP (prefer `x-forwarded-for` first value → fallback to runtime client address).
4. Capture `user_agent` from `request.headers.get('user-agent')` (fallback to `''`).
5. Enforce rate limits:
   - 60/min per IP (key: `ip_hash` or raw IP)
   - If `event_type == 'report_view'` and token present: 10/min per user (key: `user_id`)
6. Call SECURITY DEFINER RPC `ingest_event(...)` with validated payload plus `ip_hash` and `user_agent`.
   - RPC sets `occurred_at` and records `auth.uid()` if token present; triggers set `is_staff_ip` and `is_bot`.
7. Return 202 with `{ event_id, accepted: true }` on success.

### 6. Security Considerations

- Public endpoint; do not require authentication. If bearer token is present, associate user via Supabase server client bound to the token.
- Hash IPs server-side: `sha256(salt + '|' + ip)`; never store raw IP. Keep salt in env (e.g., `EVENTS_IP_SALT`).
- Strict input validation (whitelisting event types, UUID check, conditional requirements) to avoid malformed writes.
- Clamp/limit `metadata` size (e.g., ≤ 8KB); optionally drop or truncate excessively large metadata.
- Rate limiting to mitigate abuse (document in-memory implementation; recommend Redis or platform limiter for prod/multi-instance).
- Return minimal error information; do not echo sensitive request details.

### 7. Error Handling

- Validation errors → 400 with `{ code: 'bad_request', message }`.
- `report_view` with `dwell_seconds < 10` → 422 with `{ code: 'validation_error', message: 'dwell_seconds must be >= 10 for report_view' }`.
- Rate limit exceeded → 429 with `{ code: 'rate_limited', message: 'too many requests' }`.
- Unexpected RPC/DB errors → 500 with `{ code: 'server_error', message: 'unexpected error' }`.

Server logs (structured): `{ route: '/api/events', user_id?, event_type, report_id?, ip_hash_prefix, rate_limited?, error? }` (never log full raw IP or full hash; prefix is fine for correlation).

### 8. Performance

- Keep request bodies small; reject oversized metadata quickly.
- In-memory rate limiter is O(1) and low overhead but not distributed; recommend Redis or provider limits in production.
- RPC keeps a single round-trip; partitioned table and indexes handle inserts efficiently.

### 9. Implementation Steps

1. Middleware (if not already done): per-request Supabase client
   - Read `Authorization` header and instantiate a Supabase client with `global.headers.Authorization = 'Bearer <token>'` so `auth.uid()` is available to RPCs.

2. Env types
   - Update `src/env.d.ts` with `EVENTS_IP_SALT: string`.

3. Validation (new): `src/lib/validation/events.ts`
   - Zod `postEventSchema` for `PostEventCommand` with conditional rules.
   - Helpers: `assertMetadataSize(metadata, maxBytes = 8 * 1024)`.

4. Rate limiting (new): `src/lib/services/rateLimit.ts`
   - In-memory token bucket / fixed window:
     - `limitPerKey({ key, max, windowMs }): boolean` returns allowed/rejected
     - Use keys: `ip:<ip_hash>` and `user:<user_id>:report_view`

5. Events service (new): `src/lib/services/events.ts`
   - `ingestEvent(supabase, args)`: calls `supabase.rpc('ingest_event', { ...validated, user_agent, ip_hash })` and returns `{ event_id }`.
   - Handle result/normalize errors.

6. API route (new): `src/pages/api/events.ts`
   - `export const prerender = false`
   - `POST` handler:
     - Parse and validate body via `postEventSchema`.
     - Compute `ip_hash` and `user_agent`.
     - Enforce rate limits (IP and per-user for `report_view`).
     - Call `ingestEvent` service.
     - Return 202 with `{ event_id, accepted: true }`.

7. Tests
   - Unit: validation schema (all event types, conditionals), metadata size checks.
   - Unit: rate limiter logic.
   - Integration: successful ingestion (with and without token), 422 for low dwell, 429 for rate limit, error mapping.

### 10. Example Handler Skeleton (Astro + TypeScript)

```ts
// src/pages/api/events.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { postEventSchema, assertMetadataSize } from '@/lib/validation/events';
import { ingestEvent } from '@/lib/services/events';
import { limitPerKey } from '@/lib/services/rateLimit';
import crypto from 'node:crypto';

function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  // As a fallback, you may need adapter-specific access to remote IP; leave empty when unknown
  return '';
}

function hashIp(ip: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}|${ip}`).digest('hex');
}

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const supabase = locals.supabase;

  if ((request.headers.get('content-type') || '').includes('application/json') === false) {
    return new Response(JSON.stringify({ code: 'bad_request', message: 'content-type must be application/json' }), { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = postEventSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ code: 'bad_request', message: parsed.error.issues.map(i => i.message).join('; ') }), { status: 400 });
    }

    const input = parsed.data;
    if (input.metadata) {
      const ok = assertMetadataSize(input.metadata);
      if (!ok) return new Response(JSON.stringify({ code: 'bad_request', message: 'metadata too large' }), { status: 400 });
    }

    if (input.event_type === 'report_view' && (typeof input.dwell_seconds !== 'number' || input.dwell_seconds < 10)) {
      return new Response(JSON.stringify({ code: 'validation_error', message: 'dwell_seconds must be >= 10 for report_view' }), { status: 422 });
    }

    const ip = getClientIp(request);
    const salt = import.meta.env.EVENTS_IP_SALT;
    const ip_hash = hashIp(ip, salt);
    const user_agent = request.headers.get('user-agent') || '';

    // Rate limits
    if (!limitPerKey({ key: `ip:${ip_hash}`, max: 60, windowMs: 60_000 })) {
      return new Response(JSON.stringify({ code: 'rate_limited', message: 'too many requests' }), { status: 429 });
    }

    // Per-user limit for report_view
    if (input.event_type === 'report_view') {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        if (!limitPerKey({ key: `user:${userId}:report_view`, max: 10, windowMs: 60_000 })) {
          return new Response(JSON.stringify({ code: 'rate_limited', message: 'too many report_view events' }), { status: 429 });
        }
      }
    }

    const { event_id } = await ingestEvent(supabase, { ...input, ip_hash, user_agent });

    return new Response(JSON.stringify({ event_id, accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ code: 'server_error', message: 'unexpected error' }), { status: 500 });
  }
};
```

### 11. Service Outline

```ts
// src/lib/services/events.ts
import type { PostEventCommand } from '@/types';

type RpcArgs = PostEventCommand & { ip_hash: string; user_agent: string };

export async function ingestEvent(supabase: App.Locals['supabase'], args: RpcArgs): Promise<{ event_id: string }> {
  // Suggested RPC signature (DB): ingest_event(event_type text, dwell_seconds numeric, report_id uuid, metadata jsonb, ip_hash text, user_agent text)
  const { data, error } = await supabase.rpc('ingest_event', args as any);
  if (error) throw error;
  return { event_id: (data as any).event_id };
}
```

### 12. Validation Outline

```ts
// src/lib/validation/events.ts
import { z } from 'zod';

const publicEventType = z.enum(['registration_complete', 'login', 'report_view', 'table_view']);
const uuid = z.string().uuid();

export const postEventSchema = z.object({
  event_type: publicEventType,
  dwell_seconds: z.number().positive().optional(),
  report_id: uuid.optional(),
  metadata: z.record(z.any()).optional(),
}).superRefine((val, ctx) => {
  if (val.event_type === 'report_view') {
    if (typeof val.dwell_seconds !== 'number') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dwell_seconds is required for report_view', path: ['dwell_seconds'] });
    } else if (val.dwell_seconds < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dwell_seconds must be >= 10 for report_view', path: ['dwell_seconds'] });
    }
  }
});

export function assertMetadataSize(obj: unknown, maxBytes = 8 * 1024): boolean {
  try { return Buffer.byteLength(JSON.stringify(obj)) <= maxBytes; } catch { return false; }
}
```

### 13. Files to Add/Update

- Update: `src/middleware/index.ts` to ensure per-request Supabase client bound to `Authorization` when present.
- Update: `src/env.d.ts` to include `EVENTS_IP_SALT: string`.
- New: `src/lib/validation/events.ts`
- New: `src/lib/services/rateLimit.ts`
- New: `src/lib/services/events.ts`
- New: `src/pages/api/events.ts`

