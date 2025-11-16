# RLS Policy Verification for GET /api/admin/imports

## Overview
This document verifies that Row-Level Security (RLS) policies on the `imports_audit` table correctly enforce admin-only access for the GET /api/admin/imports endpoint.

## RLS Policy Review

### Policy: `imports_audit_select_admin`
**Source**: `supabase/migrations/20251029120400_setup_rls_policies.sql` (lines 126-137)

```sql
create policy "imports_audit_select_admin"
  on imports_audit
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );
```

**Purpose**: Restricts SELECT access to authenticated users with admin privileges only.

**Mechanism**:
- Policy applies to `authenticated` role
- Checks `profiles.is_admin = true` for `auth.uid()`
- Denies access if user is not admin or not authenticated

## Application Layer Authorization

### Service: `requireAdmin`
**Source**: `src/lib/services/authz.ts` (lines 51-71)

```typescript
export async function requireAdmin(
  supabase: SupabaseClient<Database>
): Promise<void> {
  // First, get the current user ID
  const userId = await getCurrentUserId(supabase);
  
  // Query the profiles table to check admin status
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  
  if (error || !profile) {
    throw new ForbiddenError('Profile not found');
  }
  
  if (!profile.is_admin) {
    throw new ForbiddenError();
  }
}
```

**Verification**: The `requireAdmin` function uses the **exact same check** as the RLS policy:
- Validates `auth.uid()` exists via `getCurrentUserId`
- Queries `profiles` table for `is_admin` flag
- Throws `ForbiddenError` if not admin

## Endpoint Implementation

### GET Handler
**Source**: `src/pages/api/admin/imports.ts` (lines 230-339)

**Authorization Flow**:
1. **Line 241**: Calls `requireAdmin(supabase)` - Application layer check
2. **Line 262**: Calls `listAdminImports(supabase, query)` - Service layer
3. **Service queries `imports_audit`**: RLS policy enforced by database

### Defense in Depth

**Layer 1 - Application (API Route)**:
- `requireAdmin` explicitly checks admin status
- Returns HTTP 403 if not admin
- **Result**: Non-admin requests blocked before database query

**Layer 2 - Database (RLS Policy)**:
- `imports_audit_select_admin` policy enforces admin-only SELECT
- **Result**: Even if application layer is bypassed, database denies access

## Column Selection Verification

### Service Query
**Source**: `src/lib/services/admin/imports.ts` (lines 11-21)

```typescript
const ADMIN_IMPORTS_COLUMNS = [
  'import_id',
  'uploaded_by_user_id',
  'filename',
  'source_checksum',
  'schema_version',
  'status',
  'error_message',
  'started_at',
  'finished_at',
] as const;
```

**Excluded Columns**:
- `source_json` - Large payload (up to 5MB) excluded to keep response lightweight

**Verification**:
- ✅ All selected columns are defined in `imports_audit` table schema
- ✅ Selected columns match `ImportsAuditDTO` type definition
- ✅ Heavy `source_json` payload intentionally excluded for performance
- ✅ All columns are accessible under admin RLS policy

## Security Assessment

### ✅ Authentication
- Supabase JWT required via `Authorization` header
- `requireAdmin` validates user session via `supabase.auth.getUser()`
- Unauthenticated requests cannot reach database query

### ✅ Authorization
- Two-layer enforcement: application + database
- Both layers use identical admin check logic
- Non-admin users receive HTTP 403 before querying database
- Database RLS provides defense-in-depth protection

### ✅ Data Exposure
- Only intended columns exposed via `ImportsAuditDTO`
- Sensitive `source_json` payload excluded
- No raw SQL or dynamic column references
- Query builder parameterization prevents injection

### ✅ Rate Limiting
- Per-admin rate limiting (30 requests/min) prevents abuse
- Rate limit enforced **after** authentication but **before** database query
- Key format: `admin:imports:<user_id>`

## Conclusion

✅ **VERIFIED**: RLS policies correctly enforce admin-only access for GET /api/admin/imports

**Key Points**:
1. RLS policy `imports_audit_select_admin` restricts SELECT to admins only
2. Application layer `requireAdmin` provides early rejection and clear error codes
3. Both layers use identical authorization logic (`profiles.is_admin = true`)
4. Column selection is safe and matches DTO definition
5. Rate limiting prevents abuse without compromising security

**Compliance**: Fully aligned with security requirements specified in:
- `.ai/db-plan.md` (Section 4: PostgreSQL policies)
- `.ai/admin-imports-implementation-plan.md` (Section 6: Security Considerations)

