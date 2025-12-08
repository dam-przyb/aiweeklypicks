# View Implementation Plan – Admin: Imports List & Upload (/admin/imports)

## 1. Overview

An admin-only page that allows uploading weekly report JSON files and viewing recent import audits with statuses. The upload enforces filename pattern `YYYY-MM-DDreport.json` and client size ≤ 2MB. The list can optionally auto-refresh (light polling). Unauthorized users see a friendly 403.

## 2. View Routing

- Path: `/admin/imports`
- File: `src/pages/admin/imports.astro`
- Access: Admin only; enforced by middleware (`src/middleware/index.ts`) and server checks.

## 3. Component Structure

- `src/pages/admin/imports.astro`
  - `Header` (admin nav visible)
  - `SEOHead`
  - `AdminGuard` (SSR wrapper; shows friendly 403 if unauthorized)
    - `FileUploadForm` (React island; multipart upload with progress)
    - `InlineAlert` (SSR) for server-side error mapping
    - `ImportsTable` (SSR) with optional client polling
  - `Footer`

## 4. Component Details

### AdminGuard (SSR)

- Purpose: Server-side check/conditional render for admin-only content; shows friendly 403 if not authorized.
- Props: `{ isAdmin: boolean }`.

### FileUploadForm (React island)

- Purpose: Upload a `.json` file with client-side validation and progress UI.
- Main elements:
  - Dropzone or file input (accept `.json`); filename regex validation `^\d{4}-\d{2}-\d{2}report\.json$`.
  - Size limit: ≤ 2MB (client-side check).
  - Upload button with progress indicator.
- Interactions:
  - POST `/api/admin/imports` as multipart (non-interactive/automated).
  - On success: toast with link to created report and import detail (`/admin/imports/[import_id]`).
  - On failure: show inline errors with specific reason (409 duplicate, 413 too large, 422 schema).
- Types:
  - Props: none.
  - Local VM: `{ file?: File; progress: number; error?: string }`.

### ImportsTable (SSR)

- Purpose: List recent imports with status and metadata.
- Columns: `filename`, `status (success|failed)`, `started_at`, `finished_at`, `error_message (optional)`, link to detail.
- Props: `ImportsListDTO` (server-defined).
- Optional: lightweight polling via client script or a React island to refresh every 15–30s.

### InlineAlert (SSR)

- Purpose: Display server-side mapped errors (e.g., rate limit).
- Props: `{ variant: 'error'|'warning'|'info'; message: string }`.

## 5. Types

- DTOs (server-defined):
  - `ImportAuditItemDTO = { import_id, filename, status, started_at, finished_at, error_message? }`
  - `ImportsListDTO = Paginated<ImportAuditItemDTO>`

## 6. State Management

- Client (island): `FileUploadForm` manages selected file, progress, and errors; optional polling island manages refresh cadence.
- Server: imports list fetched SSR; no global client state.

## 7. API Integration

- GET `/api/admin/imports`
  - Response: `ImportsListDTO` (paginated).
- POST `/api/admin/imports`
  - Request: multipart with `.json` file.
  - Response: `201 Created` with `import_id`, and link to detail; or errors:
    - 409 duplicate (existing `report_id` or checksum)
    - 413 payload too large (>2MB)
    - 422 schema/validation errors with field messages
    - 401/403 unauthorized

## 8. User Interactions

- Select or drop `.json` file → validate → upload.
- See progress updates; on success, navigate to detail or click link.
- Review recent imports; optionally auto-refresh list.

## 9. Conditions and Validation

- Client: enforce `.json` extension, filename regex, size ≤ 2MB before submit.
- Server responses mapped to friendly copy (409/413/422).
- Admin-only: show 403 if not authorized; never expose upload UI to non-admins.

## 10. Error Handling

- Inline validation errors prior to submit.
- Server errors presented via `InlineAlert` and toasts.
- Network failures: show retry guidance; do not leave the UI in indeterminate state.

## 11. Implementation Steps

1. Create `src/pages/admin/imports.astro` with `AdminGuard` wrapper.
2. Implement `FileUploadForm` (`src/components/admin/FileUploadForm.tsx`) with:
   - Filename regex and size checks; progress UI; toasts; success link to detail.
3. Implement `ImportsTable` SSR partial (`src/components/admin/ImportsTable.astro`) with pagination.
4. Wire GET `/api/admin/imports` and POST `/api/admin/imports`; ensure JWT attached and server checks admin role.
5. (Optional) Add polling island for list refresh; ensure minimal interval (15–30s) and pause when tab hidden.
6. QA: invalid file type/size, duplicate errors, schema errors, unauthorized access flow.
