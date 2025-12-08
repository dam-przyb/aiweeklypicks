# View Implementation Plan – Admin: Import Detail (/admin/imports/[import_id])

## 1. Overview

An admin-only page that shows the audit record for a specific import, including filename, timing, status, and any error message. On success, it can show links to the created report (and its slug if available). Unauthorized users see a friendly 403.

## 2. View Routing

- Path: `/admin/imports/[import_id]`
- File: `src/pages/admin/imports/[import_id].astro`
- Access: Admin only; enforced by middleware and server checks.

## 3. Component Structure

- `src/pages/admin/imports/[import_id].astro`
  - `Header` (admin nav visible)
  - `SEOHead`
  - `AdminGuard` (SSR; friendly 403 if unauthorized)
    - `ImportAuditPanel` (SSR)
    - `InlineAlert` (SSR) for server error mapping
  - `Footer`

## 4. Component Details

### ImportAuditPanel (SSR)

- Purpose: Present all details of an import audit in a clear panel layout.
- Fields: `import_id`, `filename`, `status`, `started_at`, `finished_at`, `error_message (optional)`, optional `report_id`/`report_slug`.
- Interactions:
  - Link to created report (prefer `/reports/[slug]`; fallback to ID route if supported).
  - “Back to imports” link.
- Props: `{ audit: ImportAuditDetailDTO }`.

### InlineAlert (SSR)

- Purpose: Display server-mapped errors (e.g., record not found).
- Props: `{ variant: 'error'|'warning'|'info'; message: string }`.

## 5. Types

- DTOs:
  - `ImportAuditDetailDTO = { import_id, filename, status, started_at, finished_at, error_message?, report_id?, report_slug? }`

## 6. State Management

- No client state needed; SSR fetch provides the data. Optionally a small React island can add a manual refresh button/toast, but not required for MVP.

## 7. API Integration

- GET `/api/admin/imports/{import_id}`
  - Response 200: `ImportAuditDetailDTO`
  - Errors: 404 not found, 401/403 unauthorized

## 8. User Interactions

- Read-only view; navigate back to imports list or open the created report if available.

## 9. Conditions and Validation

- If audit not found: render 404 with link back to `/admin/imports`.
- If unauthorized: friendly 403 via `AdminGuard`.

## 10. Error Handling

- Server fetch errors mapped to `InlineAlert` or 404 page where applicable.
- No client retries; rely on page reload for refresh.

## 11. Implementation Steps

1. Create `src/pages/admin/imports/[import_id].astro` with `AdminGuard`.
2. Implement `ImportAuditPanel` SSR partial (`src/components/admin/ImportAuditPanel.astro`).
3. Wire SSR fetch to GET `/api/admin/imports/{import_id}`; map 404/403 accordingly.
4. QA: success with report link, failure with clear messages, unauthorized flow.
