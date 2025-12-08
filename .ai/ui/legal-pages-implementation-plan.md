# View Implementation Plan – Legal Pages

## 1. Overview

Static, public pages that present Terms of Service and Privacy Policy in English and Polish. Pages are SSR for SEO with consistent layout and links from header/footer.

## 2. View Routing

- Paths:
  - `/legal/tos-en`, `/legal/tos-pl`
  - `/legal/privacy-en`, `/legal/privacy-pl`
- Files:
  - `src/pages/legal/tos-en.astro`, `src/pages/legal/tos-pl.astro`
  - `src/pages/legal/privacy-en.astro`, `src/pages/legal/privacy-pl.astro`
- Access: Public.

## 3. Component Structure

- Each page
  - `Header`
  - `SEOHead`
  - `LegalContent` (SSR; static or MDX content block)
  - `Footer`

## 4. Component Details

### LegalContent (SSR)

- Purpose: Render the legal text with semantic headings and readable typography.
- Main elements: `<article>` with headings (`h1`, `h2`, etc.), paragraphs, lists.
- Props: `{ variant: 'tos'|'privacy'; lang: 'en'|'pl' }`.
- A11y: semantic structure; skip-to-content link (optional).

## 5. Types

- None beyond props; content can be static strings/MDX files per language and variant.

## 6. State Management

- None; static SSR content.

## 7. API Integration

- None.

## 8. User Interactions

- Read-only; navigation via header/footer links; optional language switch links between EN/PL versions.

## 9. Conditions and Validation

- Ensure routes exist and are linked in `Header` and `Footer`.
- Maintain SEO metadata and canonical tags if needed.

## 10. Error Handling

- Not applicable; static routes. 404 if a route is missing.

## 11. Implementation Steps

1. Create four Astro pages under `src/pages/legal/` with `Header`, `SEOHead`, `LegalContent`, `Footer`.
2. Implement `LegalContent` as SSR component (`src/components/legal/LegalContent.astro`) or inline content per page.
3. Add header/footer links to all four routes.
4. QA: check EN/PL rendering, headings hierarchy, and link accessibility.
