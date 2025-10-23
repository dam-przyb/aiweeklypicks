## AI Weekly Picks

![Node](https://img.shields.io/badge/node-22.14.0-339933?logo=node.js)
![Astro](https://img.shields.io/badge/Astro-5-FF5D01?logo=astro)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-TBD-lightgrey)

### Table of Contents

- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

### Project description

AI Weekly Picks is a lightweight web app that publishes 1–5 AI-selected U.S. stock ideas each week for intermediate retail investors. An admin uploads a versioned JSON file, data are stored in Supabase Postgres, and users can browse:

- A blog-style list of weekly reports with summaries
- A historical picks table with simple sorting

For the MVP, all content is publicly visible; authentication exists to enable account creation and an admin-only import workflow. See the detailed Product Requirements Document for full scope and acceptance criteria: `.ai/prd.md`.

### Tech stack

- Frontend
  - Astro 5 (server output, Node adapter)
  - React 19 (islands for interactivity)
  - TypeScript 5
  - Tailwind CSS 4
  - shadcn/ui + Radix Primitives (e.g., `@radix-ui/react-slot`)

- Backend / Platform
  - Supabase (Postgres, Auth; Storage optional)
  - OpenRouter.ai for AI model access (cost controls)
  - CI/CD: GitHub Actions (planned)
  - Hosting: DigitalOcean App Platform via Docker (planned)

- Tooling
  - ESLint 9, Prettier, prettier-plugin-astro
  - Husky + lint-staged (pre-commit formatting/linting)

References: `.ai/tech-stack.md`

Key runtime/dependency highlights (see `package.json`): `astro@^5`, `@astrojs/react`, `@astrojs/node`, `@tailwindcss/vite`, `react@^19`, `react-dom@^19`, `tailwindcss@^4`, `lucide-react`, `class-variance-authority`, `clsx`.

### Getting started locally

Prerequisites

- Node.js 22.14.0 (matches `.nvmrc`)
- npm (repo includes `package-lock.json`)

Setup

1. Install dependencies

```
npm install
```

2. Start the dev server (Astro on port 3000 per config)

```
npm run dev
```

3. Open the app

```
http://localhost:3000
```

Build and preview

```
npm run build
npm run preview
```

Code quality

```
npm run lint       # Lint all files
npm run lint:fix   # Auto-fix where possible
npm run format     # Prettier format
```

Environment configuration (planned)

- Supabase and OpenRouter credentials will be added as `.env` variables once backend wiring is introduced. Refer to `.ai/prd.md` for schema and auth requirements.

### Available scripts

These are defined in `package.json`:

- `dev`: Run the Astro dev server
- `build`: Production build
- `preview`: Preview the production build locally
- `astro`: Run Astro CLI directly
- `lint`: Run ESLint
- `lint:fix`: Run ESLint with `--fix`
- `format`: Run Prettier on the repo

### Project scope

In scope (MVP)

- Public blog list of weekly reports and report detail pages
- Historical picks table with simple sorting (default sort: date desc)
- Supabase Postgres storage; admin-only JSON import with atomic transaction + audit
- Supabase Auth (email/password), email verification, password reset
- Legal pages (ToS, Privacy) in PL and EN; disclaimers on every report/pick
- ISO date formatting, UTC publish time with local tooltip; USD display
- Minimal event logging (registration, login, report view with ≥10s dwell, table view)

Out of scope (MVP)

- AI engine development/hosting; advanced table features; payments/paywalls
- Rich profiles, notifications, performance analytics/visualizations
- Third-party analytics tooling

For details: `.ai/prd.md` (sections: Functional Requirements, Boundaries, User Stories, Metrics).

### Project status

- Version: 0.0.1
- Status: MVP scaffolding in progress
  - Astro app boots with a stylized welcome page
  - Backend integration (Supabase, auth, import UI) is pending per PRD

### License

No license file is present yet. Until a license is added, the project should be treated as “All rights reserved.” If you intend to open source, add a `LICENSE` file (e.g., MIT) and update the badge above.


