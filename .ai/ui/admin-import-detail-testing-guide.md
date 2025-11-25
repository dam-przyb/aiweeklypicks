# Admin Import Detail View - Testing Guide

## Implementation Summary

✅ **Completed Components:**
- `ImportAuditDetailDTO` type definition (src/types.ts)
- `ImportAuditPanel.astro` component (src/components/admin/ImportAuditPanel.astro)
- `/admin/imports/[import_id]` page (src/pages/admin/imports/[import_id].astro)
- `GET /api/admin/imports/[import_id]` endpoint (src/pages/api/admin/imports/[import_id].ts)
- `InlineAlert.astro` reusable component (src/components/common/InlineAlert.astro)
- Enhanced `ImportsTable.astro` with "View Details" action links

## Test Scenarios

### 1. Success Flow with Report Link

**Test Steps:**
1. Log in as an admin user
2. Navigate to `/admin/imports`
3. Find an import with status "Success"
4. Click "View Details" link
5. Verify the import detail page displays:
   - Import ID (UUID format)
   - Filename with file icon
   - Started At timestamp
   - Finished At timestamp
   - Duration (formatted)
   - Checksum (SHA-256)
   - Schema Version
   - Uploaded By User ID
   - Green success badge
   - Green alert box with "Report Created Successfully"
   - Report ID and Report Slug displayed
   - "View Report" link

**Expected Results:**
- All fields populated correctly
- Timestamps formatted as "Month DD, YYYY, HH:MM:SS AM/PM Timezone"
- Duration shows in appropriate format (ms, s, or m s)
- "View Report" link navigates to `/reports/[slug]` (or `/reports/id/[report_id]` as fallback)
- "Back to Imports List" link returns to `/admin/imports`

### 2. Failure Flow with Error Message

**Test Steps:**
1. Log in as an admin user
2. Navigate to `/admin/imports`
3. Find an import with status "Failed"
4. Click "View Details" link
5. Verify the import detail page displays:
   - All standard fields (ID, filename, timing, etc.)
   - Red failed badge
   - Red alert box with "Import Error" heading
   - Full error message displayed
   - No report link section

**Expected Results:**
- Error message clearly visible in red alert box
- No "View Report" link or report information displayed
- "Back to Imports List" link returns to `/admin/imports`

### 3. 404 Not Found Flow

**Test Steps:**
1. Log in as an admin user
2. Navigate to `/admin/imports/00000000-0000-0000-0000-000000000000` (invalid UUID)
3. Or navigate to `/admin/imports/invalid-id` (malformed ID)

**Expected Results:**
- Error banner displays with code "404"
- Message: "Import audit record not found."
- Helpful message explaining the record doesn't exist
- "View All Imports" button navigates back to `/admin/imports`
- "Back to Imports" link in error banner

### 4. Unauthorized Access Flow

**Test Steps:**

**Test 4a: Non-authenticated User**
1. Log out (clear session)
2. Try to navigate to `/admin/imports/[any-import-id]`

**Expected Results:**
- Middleware redirects to `/auth/login?returnUrl=/admin/imports/[import-id]`
- After successful login, user is redirected back to the original URL

**Test 4b: Authenticated Non-Admin User**
1. Log in as a regular (non-admin) user
2. Try to navigate to `/admin/imports/[any-import-id]`

**Expected Results:**
- Middleware redirects to `/admin/forbidden`
- 403 page displays with clear messaging
- Links to home page and login (as admin)

### 5. API Endpoint Testing

**Test using curl or API client:**

```bash
# Get import detail (requires admin auth token)
curl -X GET "http://localhost:4321/api/admin/imports/[import-id]" \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json"
```

**Expected Responses:**

**200 Success:**
```json
{
  "import_id": "uuid",
  "uploaded_by_user_id": "uuid",
  "filename": "2025-11-20report.json",
  "source_checksum": "sha256-hash",
  "schema_version": "1.0",
  "status": "success",
  "error_message": null,
  "started_at": "2025-11-20T10:00:00Z",
  "finished_at": "2025-11-20T10:00:05Z",
  "report_id": "uuid",
  "report_slug": "2025-11-20-us-market-report"
}
```

**404 Not Found:**
```json
{
  "code": "not_found",
  "message": "Import audit record not found"
}
```

**401 Unauthorized:**
```json
{
  "code": "unauthorized",
  "message": "Not authenticated"
}
```

**403 Forbidden:**
```json
{
  "code": "forbidden",
  "message": "Admin privileges required"
}
```

## Accessibility Testing

### Keyboard Navigation
1. Tab through all interactive elements
2. Verify focus indicators are visible
3. Test "Skip to main content" link
4. Verify all links are keyboard accessible

### Screen Reader Testing
1. Use NVDA/JAWS/VoiceOver
2. Verify all content is announced properly
3. Check role="alert" on error states
4. Verify semantic heading structure (h1, h2, dt/dd)

### Visual Testing
1. Test at different zoom levels (100%, 150%, 200%)
2. Verify responsive layout (mobile, tablet, desktop)
3. Check color contrast ratios (WCAG AA compliance)
4. Verify status badges are distinguishable without color alone

## Performance Testing

1. **Page Load Time:**
   - Measure initial load time with dev tools
   - Target: < 500ms for SSR page

2. **Database Query Performance:**
   - Check query execution time in console logs
   - Verify proper indexing on `import_id`

3. **Network Waterfall:**
   - Verify no unnecessary API calls
   - Check resource loading order

## Edge Cases to Test

1. **Import in Progress:**
   - Import with `started_at` but no `finished_at`
   - Verify duration shows "N/A" or "In Progress"

2. **Null/Missing Fields:**
   - Import with null `schema_version`
   - Import with null `source_checksum`
   - Verify "N/A" displayed appropriately

3. **Long Error Messages:**
   - Import with very long error message
   - Verify text wraps properly, no overflow

4. **Very Long Filenames:**
   - Import with maximum length filename
   - Verify filename doesn't break layout

5. **Special Characters:**
   - Filename with special characters
   - Error message with HTML entities
   - Verify proper escaping/sanitization

## Browser Compatibility

Test in the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Integration Points

### From Imports List
- Verify "View Details" link in `ImportsTable.astro` navigates correctly
- Verify breadcrumb/back navigation maintains filter state

### To Report View
- Verify "View Report" link from successful import navigates to correct report
- Test both slug-based and ID-based report routes

### Middleware Protection
- Verify all admin routes protected
- Test session expiration handling
- Verify returnUrl preservation

## Known Limitations

1. **No Real-time Updates:** Page doesn't auto-refresh if import status changes
   - **Mitigation:** User can manually refresh browser

2. **Direct Database Query:** Page queries database directly instead of using API endpoint
   - **Rationale:** Better performance for SSR; API endpoint available for other use cases

3. **No Edit/Delete Actions:** View is read-only
   - **Future Enhancement:** May add delete functionality for failed imports

## Implementation Notes

### Security
- ✅ Admin-only access enforced by middleware
- ✅ RLS policies on `imports_audit` table
- ✅ Proper error handling prevents info leakage
- ✅ No sensitive data exposed in error messages

### Accessibility
- ✅ Semantic HTML with proper heading hierarchy
- ✅ ARIA labels on all interactive elements
- ✅ role="alert" on error messages
- ✅ Keyboard navigation fully supported
- ✅ Focus management with skip links

### Performance
- ✅ SSR for fast initial load
- ✅ Minimal client-side JavaScript
- ✅ Efficient database queries (single fetch with join)
- ✅ No-store cache headers for admin data

### Code Quality
- ✅ TypeScript types for all data structures
- ✅ Error boundaries and graceful degradation
- ✅ Consistent styling with Tailwind
- ✅ Reusable components (ErrorBanner, InlineAlert)
- ✅ No linter errors

## QA Sign-off Checklist

- [ ] All test scenarios pass
- [ ] Accessibility requirements met
- [ ] Performance benchmarks achieved
- [ ] Cross-browser compatibility verified
- [ ] Edge cases handled gracefully
- [ ] Security review completed
- [ ] Code review approved
- [ ] Documentation updated

## Future Enhancements

1. **Auto-refresh:** Add optional polling to detect status changes
2. **Delete Action:** Allow admins to delete failed imports
3. **Retry Action:** Re-run failed imports
4. **Audit Log:** Show detailed step-by-step import process
5. **Comparison View:** Compare two imports side-by-side
6. **Export:** Download import audit as JSON/CSV

