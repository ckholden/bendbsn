# BendBSN Changes & Fixes - February 2026

## Summary
This document tracks all changes and fixes made during the February 2026 debugging and enhancement session.

---

## 2026-02-20 Updates

### Chat Connectivity + User Directory Reliability
**Problem:** Chat could show "Disconnected..." and DM user list could stay stuck on "Loading users..." for non-admin users.

**Root Cause:** Client logic depended on full `userProfiles` reads that are intentionally restricted by security rules.

**Fix:**
- Added graceful fallback when `userProfiles` read is denied.
- Continue loading DM/mention user directory from cache/Google Sheet response.
- Clear stale local session and redirect to login when Firebase auth is lost.

---

### Admin Registered Users Panel Empty
**Problem:** Registered Users panel could render empty after API shape changes or temporary Google Sheet issues.

**Fix:**
- Admin loader now accepts multiple response formats (`data.users`, `data.data`, or root array).
- Added normalization of returned user objects before rendering.
- Added Firebase `userProfiles` fallback list when Google Sheets response is empty/unavailable.

---

### Registration Email Delivery Restored
**Problem:** Admin new-user notifications and/or welcome emails stopped sending reliably in some flows.

**Fix:**
- Added `https://api.emailjs.com` to CSP `connect-src` for EmailJS requests.
- Added FormSubmit `Accept: application/json` header for stronger fallback behavior.
- Restored welcome-email send in the Create Account flow.
- Added welcome-email FormSubmit fallback when EmailJS fails.

---

### Security Fixes
**Fixes shipped:**
- Hardened Realtime Database `directMessages` write rule to prevent participant-takeover of existing threads.
- Escaped user-controlled chat name sinks to mitigate stored XSS vectors in chat UI/DM UI/typing/mentions/online list.

---

### Admin Chat Permission Fix
**Problem:** Admin page threw `permission_denied` when reading `/chat/messages`.

**Fix:** Added admin-only root read for `chat/messages` in `database.rules.json` so the admin panel can load cross-channel chat data without granting general user access.

---

### Login Redirect Loop Prevention
**Problem:** Users with stale local storage could be redirected away from the login page even when Firebase Auth was not active.

**Fix:**
- Removed early redirect based only on `bsn9b_auth`.
- Redirect now happens only after Firebase Auth confirms a valid session.
- If local storage is stale, it is cleared and a toast is shown: “Session expired. Please sign in again.”

---

### Home Page Duplication Cleanup
**Problem:** `/home/` showed duplicate navigation cards (Quick Start + another nav grid).

**Fix:** Removed the duplicate nav-card grid, keeping Quick Start only.

---

### Repo Hygiene
- Removed unused files `ai-proxy-script.js` and `nul`.
- Added `.gitignore` rules for Firebase admin key files.

---

## Issues Fixed

### 1. Note Type Toggle Buttons Not Working
**Problem:** Clicking DAR, SOAP, SBAR, etc. cards did nothing.

**Root Cause:**
- Duplicate event handlers (inline `onclick` AND `addEventListener`)
- JavaScript errors blocking execution

**Fix:**
- Removed inline `onclick` handlers from HTML
- Using only `data-note-type` attributes with event listeners

**Before:**
```html
<div class="note-type-card active" data-note-type="dar" onclick="selectNoteType('dar', this)">
```

**After:**
```html
<div class="note-type-card active" data-note-type="dar">
```

**JavaScript (kept):**
```javascript
document.querySelectorAll('.note-type-card').forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.noteType;
        if (type) selectNoteType(type, card);
    });
});
```

---

### 2. Date/Time Shortcuts (T for Today, N for Now) Not Working
**Problem:** Native `<input type="date">` and `<input type="time">` don't fire keyboard events reliably due to browser date picker capturing input.

**Solution:** Changed to Epic EMR style - text inputs that parse shortcuts on blur/Enter.

**Before:**
```html
<input type="date" id="noteDate" onfocus="showDateShortcut()" onclick="showDateShortcut()">
<input type="time" id="noteTime" onfocus="showTimeShortcut()" onclick="showTimeShortcut()">
```

**After:**
```html
<input type="text" id="noteDate">
<input type="text" id="noteTime">
```

**New JavaScript Functions:**
```javascript
function formatDateDisplay(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function formatTimeDisplay(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
}

function parseDateInput(input) {
    const val = input.trim().toLowerCase();
    const today = new Date();

    if (val === 't' || val === 'today') {
        return formatDateDisplay(today);
    }

    // Match t-2, t+1, t-10, etc.
    const match = val.match(/^t\s*([\+\-])\s*(\d+)$/);
    if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const days = parseInt(match[2]);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (sign * days));
        return formatDateDisplay(targetDate);
    }

    return input;
}

function parseTimeInput(input) {
    const val = input.trim().toLowerCase();
    const now = new Date();

    if (val === 'n' || val === 'now') {
        return formatTimeDisplay(now);
    }

    // Match n-30, n+15, n-5, etc.
    const match = val.match(/^n\s*([\+\-])\s*(\d+)$/);
    if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const minutes = parseInt(match[2]);
        const targetTime = new Date(now);
        targetTime.setMinutes(now.getMinutes() + (sign * minutes));
        return formatTimeDisplay(targetTime);
    }

    return input;
}

function setupDateTimeShortcuts() {
    const dateInput = document.getElementById('noteDate');
    const timeInput = document.getElementById('noteTime');

    if (dateInput) {
        dateInput.value = formatDateDisplay(new Date());
        dateInput.addEventListener('blur', function() {
            this.value = parseDateInput(this.value);
        });
        dateInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.value = parseDateInput(this.value);
                this.blur();
            }
        });
    }

    if (timeInput) {
        timeInput.value = formatTimeDisplay(new Date());
        timeInput.addEventListener('blur', function() {
            this.value = parseTimeInput(this.value);
        });
        timeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.value = parseTimeInput(this.value);
                this.blur();
            }
        });
    }
}
```

**Supported Shortcuts:**
- Date: `t`, `today`, `t-1`, `t+2`, `t-7`, etc.
- Time: `n`, `now`, `n-30`, `n+15`, `n-5`, etc.

---

### 3. JavaScript SyntaxError: Duplicate `displayName` Declaration
**Problem:** `Uncaught SyntaxError: Identifier 'displayName' has already been declared`

**Root Cause:** Two declarations of `displayName` in the same scope:
- Line 2478: `let displayName = ...`
- Line 4241: `const displayName = ...`

**Fix:** Renamed second declaration to `userDisplayName`

**Before:**
```javascript
const displayName = localStorage.getItem('bsn9b_displayName') || localStorage.getItem('bsn9b_user') || '';
if (displayName) {
    document.getElementById('userDisplay').textContent = 'Logged in as: ' + displayName;
}
```

**After:**
```javascript
const userDisplayName = localStorage.getItem('bsn9b_displayName') || localStorage.getItem('bsn9b_user') || '';
if (userDisplayName) {
    document.getElementById('userDisplay').textContent = 'Logged in as: ' + userDisplayName;
}
```

---

### 4. JavaScript ReferenceError: NOTE_SECTIONS Before Initialization
**Problem:** `Uncaught ReferenceError: Cannot access 'NOTE_SECTIONS' before initialization`

**Root Cause:** `const NOTE_SECTIONS` was declared AFTER `setNoteType(currentNoteType)` was called, which uses `updateSectionJumpList()` which references `NOTE_SECTIONS`.

**Fix:** Moved `NOTE_SECTIONS` declaration and related functions BEFORE the initialization code.

**Correct Order:**
1. `NOTE_SECTIONS` declaration
2. `toggleSectionJump()`, `updateSectionJumpList()`, `scrollToSection()` functions
3. `setNoteType()`, `selectNoteType()` functions
4. Initialization code calling `setNoteType(currentNoteType)`

---

### 5. Admin Login History Not Working
**Problem:** Login History showed nothing or permission denied.

**Root Cause:** Firebase database rules require authentication with `christiankholden@gmail.com` to read `/loginHistory`. The admin panel's password login is separate from Firebase Auth.

**Fix:** Added check for Firebase Auth sign-in status and helpful error messages.

**Code Added:**
```javascript
function loadLoginHistory() {
    const container = document.getElementById('loginHistoryContent');
    container.innerHTML = '<p>Loading...</p>';

    // Check if Firebase Auth is signed in (required by database rules)
    const currentUser = auth.currentUser;
    console.log('Login History - Current user:', currentUser ? currentUser.email : 'none');

    if (!currentUser) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">'+
            '<p style="color: #dc3545; font-weight: bold;">Firebase authentication required</p>'+
            '<p style="color: #666; margin: 10px 0;">Click the "Firebase Auth" button in the header to sign in.</p>'+
            '<button onclick="closeLoginHistory(); openFirebaseAuthModal();" style="...">Sign in to Firebase</button>'+
            '</div>';
        return;
    }

    container.innerHTML = '<p>Loading as ' + currentUser.email + '...</p>';

    loginHistoryRef.orderByChild('timestamp').limitToLast(200).once('value', (snapshot) => {
        // ... render logic
    }).catch((error) => {
        console.error('Login history error:', error);
        const userEmail = auth.currentUser ? auth.currentUser.email : 'not signed in';
        container.innerHTML = `<div style="text-align: center; padding: 20px;">
            <p style="color: #dc3545; font-weight: bold;">Permission denied</p>
            <p style="color: #666;">Error: ${error.message || error.code || 'Unknown error'}</p>
            <p style="color: #666;">Current Firebase user: <strong>${userEmail}</strong></p>
            <p style="color: #666;">Required: christiankholden@gmail.com</p>
        </div>`;
    });
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `/app/index.html` | Note type buttons, date/time shortcuts, displayName fix, NOTE_SECTIONS order |
| `/admin/index.html` | Login history Firebase auth check and error handling |

---

## Git Commits (February 2026)

```
807f079 Fix admin chat rules and clean home duplicates
26a810b Prevent login redirect loop with Firebase auth check
80ba78f Show session expired toast on login page
cbde19c Fix NOTE_SECTIONS initialization order
41619b0 Fix duplicate displayName declaration breaking JS
97a2a12 Add debug info to login history errors
12d1730 Implement Epic-style date/time shortcuts
bc07dee Fix login history requiring Firebase Auth
8d8aa25 Add clickable T/N buttons for date/time shortcuts
86334e9 Fix note type toggle buttons and date/time shortcuts
```

---

## Known Issues / Warnings (Non-blocking)

1. **favicon.ico 404** - Missing favicon file (cosmetic)
2. **Legacy document migration warning** - Expected when old email-based documents exist
3. **apple-mobile-web-app-capable deprecation** - Minor, can update meta tag

---

## Database Rules Reference (`database.rules.json`)

```json
{
  "loginHistory": {
    ".read": "auth != null && auth.token.email == \"christiankholden@gmail.com\"",
    ".write": "auth != null"
  }
}
```

---

## TODO / Future Improvements

- [ ] Redesign chat channels feature (Slack/Teams style)
- [ ] Add favicon.ico
- [ ] Update deprecated meta tag
