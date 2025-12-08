# Admin Access Testing & Debugging Guide

## 🔍 Current Issue

App doesn't recognize user `73160ab7-5343-4206-af08-231690476bd4` as admin.

---

## ✅ Step-by-Step Fix

### 1. Run the SQL Script

**Go to Supabase Dashboard:**

1. Open https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New Query"**
5. Copy and paste **ALL content** from `scripts/debug-and-fix-admin.sql`
6. Click **"Run"** (or press Ctrl+Enter)

**Expected Output:**

```
Step 1: ✓ User exists with confirmed email
Step 2: Profile may or may not exist yet
Step 3: ✓ Profile created/updated successfully
Step 4: ✓ SUCCESS: User is admin
```

**If you see any ✗ FAIL messages:**

- Read the message carefully
- Most common: "Email not confirmed" - check your email for verification link
- If profile not found: Step 3 should create it

---

### 2. Clear Session & Cookies

**The most common issue!** The app caches your session.

**Option A: Clear Cookies (Recommended)**

```
1. Open DevTools (F12)
2. Go to "Application" tab
3. Click "Cookies" in left sidebar
4. Click "http://localhost:3000"
5. Right-click → "Clear all cookies"
6. Close and reopen browser
```

**Option B: Use Incognito/Private Window**

```
1. Open new incognito/private window
2. Navigate to http://localhost:3000
3. Log in with your admin account
4. Admin links should now appear
```

**Option C: Log Out & Log In**

```
1. Click Logout in header
2. Wait for redirect to home page
3. Click Login
4. Enter credentials
5. After login, check header for admin links
```

---

### 3. Verify Admin Access

**Check Header Navigation:**

✅ **Should see (as admin):**

```
[Reports] [Historical Picks] [↑ Import Reports] [Legal ▾] | Hi, username [Logout]
                              ^^^^^^^^^^^^^^^^^^^
                              THIS SHOULD BE VISIBLE
```

❌ **If you see (not recognized as admin):**

```
[Reports] [Historical Picks] [Legal ▾] | Hi, username [Logout]
```

**Test Admin Route:**

1. Navigate to: `http://localhost:3000/admin/imports`
2. **Should see:** Upload form and imports table
3. **Should NOT see:** Redirect to login or "Forbidden" page

---

## 🐛 Advanced Debugging

### Check Browser Console

Open DevTools (F12) → Console tab, then navigate to home page.

**Add this test script in browser console:**

```javascript
// Test 1: Check if session exists
fetch("/api/reports")
  .then((r) => r.json())
  .then((data) => console.log("API works:", data))
  .catch((err) => console.error("API error:", err));

// Test 2: Check cookies
console.log("Cookies:", document.cookie);

// Test 3: Manual admin check
fetch("/admin/imports")
  .then((r) => console.log("Admin route status:", r.status))
  .catch((err) => console.error("Admin route error:", err));
```

**Expected results:**

- Test 1: Should return reports data (may be empty)
- Test 2: Should show Supabase auth cookies (sb-\*-auth-token)
- Test 3: Should return 200 (page loads) not 302 (redirect)

---

### Check Server Logs

**In your terminal where `npm run dev` is running:**

Look for these log messages when you navigate to a page:

```
[middleware] User: { id: '73160ab7-...', email: 'your@email.com' }
[middleware] Admin check: ...
[Header] isAdmin: true/false
```

If you don't see these, the middleware might not be running properly.

---

### Manual Database Check

**Run this in Supabase SQL Editor:**

```sql
-- Quick verification query
SELECT
  u.email,
  p.is_admin,
  CASE
    WHEN p.is_admin = true THEN 'Admin access: YES ✓'
    ELSE 'Admin access: NO ✗'
  END as access_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.id = '73160ab7-5343-4206-af08-231690476bd4';
```

**Expected result:**

```
email          | is_admin | access_status
your@email.com | true     | Admin access: YES ✓
```

**If is_admin is false or null:**

```sql
-- Force update
UPDATE profiles
SET is_admin = true
WHERE user_id = '73160ab7-5343-4206-af08-231690476bd4';
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "Profile not found"

**Solution:**

```sql
INSERT INTO profiles (user_id, is_admin, created_at)
VALUES ('73160ab7-5343-4206-af08-231690476bd4', true, now());
```

### Issue 2: "Email not confirmed"

**Solution:**

1. Check your email for verification link
2. Or manually confirm in Supabase Dashboard → Authentication → Users → Click user → "Confirm email"

### Issue 3: Admin links still not showing after SQL fix

**Solution:** Clear cookies and log in again (step 2 above)

### Issue 4: Redirect to /admin/forbidden

**Solution:** Your middleware detected you're not admin. Run the SQL script again and clear cookies.

### Issue 5: Still doesn't work

**Solution:** Add debugging to Header.astro:

```typescript
// In Header.astro frontmatter (line ~32)
console.log("🔍 DEBUG Header:", {
  hasUser: !!user,
  userId: user?.id,
  profileData: profile,
  profileError: profileError,
  isAdmin: isAdmin,
});
```

Check browser console for output.

---

## 📞 Still Not Working?

If after all these steps it still doesn't work, provide:

1. Screenshot of SQL script results (Step 4)
2. Screenshot of browser console
3. Screenshot of header (should show/not show admin link)
4. Terminal logs when accessing /admin/imports

This will help diagnose the exact issue!
