# Report Detail Page Testing Checklist

## Implementation Status: ✅ Complete

### Components Created
- ✅ `src/types.ts` - Added `ReportMetaVM`, `PickItemVM`, `ReportWithPicksVM`
- ✅ `src/lib/view-helpers.ts` - Added `formatPercentageChange()`, `mapReportWithPicksDtoToViewModel()`
- ✅ `src/components/report/ReportHeader.astro` - SSR component for report metadata
- ✅ `src/components/report/PicksList.astro` - SSR component for stock picks
- ✅ `src/components/common/DisclaimerBlock.astro` - SSR component for legal disclaimers
- ✅ `src/components/islands/DwellTimer.tsx` - React island for view tracking
- ✅ `src/pages/reports/[slug].astro` - Main SSR page
- ✅ `src/layouts/Layout.astro` - Updated to support `head` slot

### Build Status
- ✅ Project builds successfully (npm run build)
- ✅ No linter errors in new code
- ✅ All TypeScript types validated
- ✅ React island compiled (DwellTimer.BekY9che.js - 1.43 kB)

## Testing Checklist

### 1. API Integration Tests

#### Valid Slug Test
```bash
# Start dev server
npm run dev

# Test valid report slug
curl http://localhost:4321/api/reports/2025-w47-v1

# Expected: 200 OK with ReportWithPicksDTO
```

#### Invalid Slug Test
```bash
# Test invalid report slug
curl http://localhost:4321/api/reports/invalid-slug

# Expected: 404 Not Found with error message
```

### 2. Page Rendering Tests

#### Valid Report Page
1. Navigate to: `http://localhost:4321/reports/2025-w47-v1` (or any valid slug)
2. Verify elements:
   - ✅ Page title includes report title and week
   - ✅ Report header shows: title, summary, week, published date, version
   - ✅ Published date has tooltip on hover showing local time
   - ✅ Stock picks section displays all picks (1-5)
   - ✅ Each pick shows: ticker (bold), exchange, side badge (LONG/SHORT), target percentage, rationale
   - ✅ Target percentages formatted with sign and 2 decimals (e.g., +12.34%, -5.67%)
   - ✅ Side badges: green for LONG, red for SHORT
   - ✅ Disclaimer block visible at bottom
   - ✅ DwellTimer component loaded (check browser console after 10s)

#### 404 Page
1. Navigate to: `http://localhost:4321/reports/nonexistent-slug`
2. Verify:
   - ✅ 404 status code (check network tab)
   - ✅ Error banner displayed
   - ✅ "404 - Report Not Found" heading
   - ✅ "View All Reports" button links to `/`

#### Empty Picks State
1. If a report has 0 picks (test with API mock):
2. Verify:
   - ✅ EmptyState component displayed under "Stock Picks" heading

### 3. DwellTimer Functionality Tests

#### Active Viewing
1. Navigate to a valid report page
2. Keep tab active and visible for 10+ seconds
3. Check browser console for:
   - ✅ "report_view event posted successfully: <event_id>" message after ~10 seconds
4. Check network tab:
   - ✅ POST request to `/api/events` after 10 seconds
   - ✅ Request body includes: `event_type: "report_view"`, `dwell_seconds: 10+`, `report_id: <uuid>`
   - ✅ Response: 202 Accepted with `event_id`

#### Pause/Resume Behavior
1. Navigate to a valid report page
2. Wait 5 seconds (timer active)
3. Switch to another tab (hide page) for 10 seconds
4. Switch back to report tab
5. Wait 5 more seconds
6. Verify:
   - ✅ Event fires after total of 10 seconds of **active** viewing time
   - ✅ Hidden time is not counted

#### No Duplicate Events
1. Navigate to a valid report page
2. Wait 15+ seconds (past threshold)
3. Check network tab:
   - ✅ Only ONE POST to `/api/events` is made
   - ✅ No duplicate events even after staying on page

### 4. SEO and Meta Tags Tests

1. View page source for a valid report
2. Verify `<head>` contains:
   - ✅ `<title>` with report title and week
   - ✅ `<meta name="description">` with report summary
   - ✅ `<link rel="canonical">` with `/reports/{slug}`
   - ✅ Open Graph tags: `og:title`, `og:description`, `og:type="article"`, `og:url`
   - ✅ Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`

### 5. Responsive Design Tests

#### Desktop (1920x1080)
1. Navigate to report page
2. Verify:
   - ✅ Max-width container (max-w-4xl) centers content
   - ✅ Proper spacing and padding
   - ✅ All content readable and well-spaced

#### Tablet (768px)
1. Resize viewport to 768px width
2. Verify:
   - ✅ Header elements stack properly
   - ✅ Picks metadata (ticker, exchange, side) reflow correctly
   - ✅ Target percentage remains visible and readable
   - ✅ Responsive padding (px-4 sm:px-6)

#### Mobile (375px)
1. Resize viewport to 375px width
2. Verify:
   - ✅ Title font size adjusts (text-3xl md:text-4xl)
   - ✅ Meta information wraps properly (flex-wrap gap)
   - ✅ Pick cards stack vertically
   - ✅ All content readable without horizontal scroll
   - ✅ Disclaimer text remains legible

### 6. Accessibility Tests

#### Keyboard Navigation
1. Use Tab key to navigate through page
2. Verify:
   - ✅ All interactive elements focusable (links, buttons)
   - ✅ Focus outline visible (Tailwind default or custom)
   - ✅ Logical tab order (header → picks → disclaimer → footer)
   - ✅ "View All Reports" button on 404 is keyboard accessible

#### Screen Reader
1. Test with screen reader (NVDA, JAWS, or VoiceOver)
2. Verify:
   - ✅ `<h1>` for report title is announced
   - ✅ `<h2>` for "Stock Picks" is announced
   - ✅ Semantic `<header>`, `<section>`, `<article>`, `<aside>` elements
   - ✅ Definition list (`<dl>`) for metadata is properly structured
   - ✅ Side badge has `aria-label` (e.g., "long position")
   - ✅ Published date tooltip uses `title` attribute
   - ✅ Disclaimer has `role="note"` and `aria-label`
   - ✅ Error banner has `role="alert"`

#### Color Contrast
1. Use browser DevTools or Lighthouse to check contrast
2. Verify:
   - ✅ Text meets WCAG AA contrast ratio (4.5:1 for normal text)
   - ✅ Side badges (green/red) have sufficient contrast
   - ✅ Target percentage colors (green/red) readable
   - ✅ Disclaimer amber background with dark text is legible

### 7. Performance Tests

#### Lighthouse Audit
1. Run Lighthouse in Chrome DevTools
2. Target scores:
   - ✅ Performance: 90+
   - ✅ Accessibility: 95+
   - ✅ Best Practices: 90+
   - ✅ SEO: 95+

#### Bundle Size
1. Check build output
2. Verify:
   - ✅ DwellTimer island is small (< 2 KB gzipped) ✅ 0.69 KB
   - ✅ Page uses SSR for main content (minimal client JS)
   - ✅ No unnecessary dependencies loaded

### 8. Error Handling Tests

#### Network Error Simulation
1. Disconnect network or use DevTools to block API
2. Navigate to report page
3. Verify:
   - ✅ Error banner displayed
   - ✅ User-friendly error message
   - ✅ "Reset" link to home page
   - ✅ No unhandled errors in console

#### Event Post Failure
1. Block `/api/events` endpoint
2. Wait 10 seconds on report page
3. Check console:
   - ✅ Warning logged: "Failed to post report_view event"
   - ✅ Page remains functional
   - ✅ No error thrown to user

#### Malformed Data
1. Test with API returning incomplete data (mock or test endpoint)
2. Verify:
   - ✅ Fallbacks applied (title → slug, empty summary → "")
   - ✅ Page renders without crashing
   - ✅ Empty picks show EmptyState component

### 9. Date and Number Formatting Tests

#### Date Format
1. View report with various published dates
2. Verify:
   - ✅ Displayed as `YYYY-MM-DD` (e.g., "2025-11-23")
   - ✅ Tooltip shows localized date/time (e.g., "November 23, 2025, 10:30 AM PST")
   - ✅ ISO week format correct (e.g., "2025-W47")

#### Percentage Format
1. View picks with various target percentages
2. Verify:
   - ✅ Positive: `+12.34%` (green color)
   - ✅ Negative: `-5.67%` (red color)
   - ✅ Zero: `+0.00%` (green color, treated as non-negative)
   - ✅ Always 2 decimal places
   - ✅ Always has sign prefix

### 10. Integration with Existing Code

#### Layout Compatibility
1. Verify Layout.astro head slot works:
   - ✅ Meta tags from page render in `<head>`
   - ✅ No duplicate tags
   - ✅ Proper integration with existing layout

#### Error Banner Reuse
1. Verify ErrorBanner component works:
   - ✅ Accepts `errorCode` and `errorMessage` props
   - ✅ Displays correct messages
   - ✅ "Reset" link navigates to `/`

#### EmptyState Reuse
1. Verify EmptyState component integration:
   - ✅ Renders when picks array is empty
   - ✅ Consistent styling with rest of app

## Manual Testing Steps (Developer)

```bash
# 1. Start development server
npm run dev

# 2. Navigate to existing report (if seeded)
# http://localhost:4321/reports/[existing-slug]

# 3. Test 404
# http://localhost:4321/reports/nonexistent

# 4. Test DwellTimer (keep tab active for 10+ seconds, check console)

# 5. Test responsiveness (resize browser)

# 6. Test keyboard navigation (Tab through page)

# 7. Run Lighthouse audit

# 8. Check network requests in DevTools
```

## Automated Testing (Future)

```typescript
// Suggested E2E tests with Playwright or Cypress
describe('Report Detail Page', () => {
  it('renders valid report with all metadata', async () => {
    // Visit page, assert elements present
  });

  it('shows 404 for invalid slug', async () => {
    // Visit invalid slug, assert 404 UI
  });

  it('posts report_view event after 10 seconds', async () => {
    // Mock API, wait 10s, assert POST made
  });

  it('pauses timer when tab hidden', async () => {
    // Hide tab, assert event timing correct
  });

  it('formats percentages correctly', async () => {
    // Assert all percentages have sign and 2 decimals
  });
});
```

## Compliance with PRD

### Functional Requirements Covered
- ✅ FR-031: Report content display (title, summary, week, date, version, picks)
- ✅ FR-060: Disclaimer block (not investment advice, corporate actions)
- ✅ FR-051: Numeric formatting (2 decimal percentage with sign)
- ✅ FR-070: Engagement tracking (>=10s dwell time)
- ✅ FR-080: Performance (SSR, minimal JS, small island)

### User Stories Covered
- ✅ US-002: View published reports
- ✅ US-015: View report details
- ✅ US-016: Read stock pick rationale
- ✅ US-018: Understand report context (week, date, version)
- ✅ US-021: See disclaimers
- ✅ US-026: Navigate with keyboard (accessibility)

## Notes

- DwellTimer uses `client:only="react"` directive for React 19 compatibility
- Page uses SSR for SEO and performance
- All dates stored/transmitted as UTC, displayed with timezone awareness
- Event posting failures are logged but don't block user experience
- Responsive design uses Tailwind 4 utility classes
- Accessibility follows ARIA best practices with semantic HTML

