# Test Plan: AI Weekly Picks

## 1. Introduction

This document outlines the comprehensive testing strategy for the **AI Weekly Picks** application. The goal is to ensure high quality, reliability, and security of the platform, which is built using Astro 5, React 19, Tailwind 4, and Supabase.

## 2. Scope

### In Scope

- **Frontend**: All public pages (Home, Picks, Reports, Legal) and protected Admin pages.
- **Backend**: Astro API routes (Auth, Admin, Public Data).
- **Database**: Supabase tables, RLS policies, and stored procedures (RPCs).
- **Authentication**: User flows (Login, Register, Logout, Session Management).
- **Authorization**: Role-based access control (RBAC) for Admin vs. Public users.
- **Integrations**: Supabase Auth & Database, OpenRouter.ai (if/when implemented).

### Out of Scope

- **Third-party Service Uptime**: We verify our integration, not the uptime of Supabase or OpenRouter.ai themselves.
- **Browser Compatibility for Legacy Browsers**: Focus is on modern browsers (Chrome, Firefox, Safari, Edge) supporting ES Modules.

## 3. Test Levels & Types

### 3.1. Unit Testing

**Focus**: Individual functions, components, and modules in isolation.

- **Tools**: `Vitest`, `@testing-library/react`.
- **Targets**:
  - **Libraries (`src/lib`)**: Utility functions, validation schemas (Zod), service layers (business logic).
  - **React Components**: Interactive UI components (e.g., `AuthForm`, `ImportsFilters`, `SortControls`) ensuring state updates and event handling work.
  - **Database Functions**: RPC logic (if complex enough to extract) or mocked database client calls.

### 3.2. Integration Testing

**Focus**: Interaction between modules and external services (mocked or local).

- **Tools**: `Vitest`.
- **Targets**:
  - **API Routes (`src/pages/api`)**: Test request handling, input validation, status codes, and response payloads. Mock Supabase calls to verify correct data is passed to the DB client.
  - **Service Integrations**: Verify that service functions correctly call external APIs (e.g., OpenRouter wrapper) using mocks.

### 3.3. End-to-End (E2E) Testing

**Focus**: Complete user flows from the browser perspective against a running environment.

- **Tools**: `Playwright`.
- **Targets**:
  - **Public Flows**: Navigation, searching/filtering picks, viewing reports.
  - **Auth Flows**: Sign up, sign in, password recovery, protected route redirection.
  - **Admin Flows**: File upload process, audit log viewing.
  - **Visual Regression**: Ensure UI looks correct across breakpoints (Mobile/Desktop).

### 3.4. Database Testing

**Focus**: Data integrity and security rules.

- **Tools**: `Supabase Local`, `pgTAP` (optional for complex SQL), or integration tests against a local Supabase instance.
- **Targets**:
  - **Row Level Security (RLS)**: Verify that non-admins cannot access admin tables (`imports_audit`) or execute admin RPCs.
  - **Triggers/RPCs**: Verify that data import RPCs correctly parse JSON and insert/update records.

## 4. Test Areas & Cases

### 4.1. Authentication & Authorization

| Case ID | Scenario                                 | Expected Result                                                      | Priority |
| ------- | ---------------------------------------- | -------------------------------------------------------------------- | -------- |
| AUTH-01 | User registers with valid email/password | Account created, verification email sent (or auto-confirmed in dev). | High     |
| AUTH-02 | User logs in with correct credentials    | Redirected to dashboard/home, session token set.                     | High     |
| AUTH-03 | User logs in with invalid credentials    | Error message displayed.                                             | High     |
| AUTH-04 | Non-admin attempts to access `/admin`    | Redirected to 403 or Login.                                          | High     |
| AUTH-05 | Admin accesses `/admin`                  | Access granted.                                                      | High     |

### 4.2. Admin Features (Imports)

| Case ID | Scenario                          | Expected Result                                                         | Priority |
| ------- | --------------------------------- | ----------------------------------------------------------------------- | -------- |
| ADM-01  | Upload valid JSON report via form | Success message, record added to `imports_audit` with status 'success'. | High     |
| ADM-02  | Upload invalid JSON file          | Error 400/422, descriptive error message.                               | Medium   |
| ADM-03  | Upload file > 5MB                 | Error 413 Payload Too Large.                                            | Medium   |
| ADM-04  | List imports with filters         | Table updates to show only matching records.                            | Medium   |

### 4.3. Public Features (Picks & Reports)

| Case ID | Scenario                     | Expected Result                                   | Priority |
| ------- | ---------------------------- | ------------------------------------------------- | -------- |
| PUB-01  | View Picks page              | List of picks displayed, sorted by default order. | High     |
| PUB-02  | Filter Picks by category/tag | List updates to show relevant items.              | Medium   |
| PUB-03  | View individual Report       | Report details rendered correctly.                | High     |
| PUB-04  | Invalid Report slug          | 404 Error page displayed.                         | Low      |

### 4.4. API & Data Validation

| Case ID | Scenario                                      | Expected Result                         | Priority |
| ------- | --------------------------------------------- | --------------------------------------- | -------- |
| API-01  | POST `/api/admin/imports` without token       | 401 Unauthorized.                       | High     |
| API-02  | POST `/api/admin/imports` with malformed body | 400 Bad Request (Zod validation error). | Medium   |

## 5. Test Environment & Data

### 5.1. Local Development (Unit/Integration)

- **Database**: Local Supabase instance (`npx supabase start`).
- **Data**: Seed data (`supabase/seed.sql`) containing test users (admin/user) and sample reports.
- **Env Vars**: `.env.test` with local API keys.

### 5.2. CI Environment (GitHub Actions)

- **Runner**: Ubuntu latest.
- **Database**: Service container for Supabase/Postgres or mocked client for unit tests.
- **Process**:
  1. Lint (`eslint`).
  2. Type Check (`tsc`).
  3. Unit/Integration Tests (`vitest`).
  4. E2E Tests (`playwright`) - optional on every PR, mandatory on merge to main.

## 6. Tools & Frameworks

| Category         | Tool                     | Purpose                                                    |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| **Test Runner**  | `Vitest`                 | Fast unit/integration testing, compatible with Vite/Astro. |
| **DOM Testing**  | `@testing-library/react` | Testing React components in isolation.                     |
| **E2E Testing**  | `Playwright`             | Browser automation for full system tests.                  |
| **API Testing**  | `Vitest` / `Supertest`   | Testing API endpoints.                                     |
| **Load Testing** | `k6`                     | (Future) Stress testing API endpoints.                     |
| **Linting**      | `ESLint`, `Prettier`     | Code quality and formatting.                               |

## 7. Risks & Assumptions

- **Risk**: Supabase local environment might slightly differ from production (hosted).
  - _Mitigation_: Use Staging environment for final E2E pass.
- **Assumption**: OpenRouter API has rate limits that we must mock in tests to avoid costs/flakiness.
- **Risk**: Testing Astro components purely with Unit tests is complex.
  - _Mitigation_: Rely on E2E (Playwright) for visual/rendering correctness of Astro pages.

## 8. Success Criteria

- **Code Coverage**: Target > 70% coverage for `src/lib` and `src/pages/api`.
- **Pass Rate**: 100% of critical path tests (AUTH-_, ADM-_, PUB-\*) must pass before deployment.
- **Performance**: Homepage loads in < 1.5s (Lighthouse score > 90).
- **Security**: No high-severity vulnerabilities in `npm audit`.
