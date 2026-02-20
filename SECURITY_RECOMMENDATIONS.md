# Security Recommendations for BendBSN

## Executive Summary

Codex security audit identified 5 areas of concern. This document provides analysis, risk assessment, and remediation strategies compatible with the GitHub Pages + Firebase architecture.

---

## Issues Found

### 🔴 HIGH PRIORITY

#### 1. Admin Panel - Hard-Coded Password in Client JS

**Location:** `bendbsn-repo/admin/index.html:568`
```javascript
const ADMIN_PASSWORD = 'admin1374';
```

**Risk Level:** **CRITICAL**
**Impact:** Anyone viewing page source can see admin password and gain full admin access

**Current Implementation:**
- Password stored in plaintext in client JavaScript
- sessionStorage flag (`bsn9b_admin`) unlocks admin UI
- No server-side validation

**Recommended Fix:**
Use Firebase Auth Custom Claims + Database Rules

**Implementation Steps:**
1. **Set up Cloud Function to assign admin claims:**
   ```javascript
   // Cloud Function (requires Firebase Blaze plan)
   exports.setAdminClaim = functions.https.onCall(async (data, context) => {
     // Verify request is from authorized user
     if (!context.auth || !ADMIN_EMAILS.includes(context.auth.token.email)) {
       throw new functions.https.HttpsError('permission-denied');
     }

     await admin.auth().setCustomUserClaims(data.uid, {
       admin: true
     });
     return { success: true };
   });
   ```

2. **Check claims client-side:**
   ```javascript
   auth.currentUser.getIdTokenResult().then((idTokenResult) => {
     if (idTokenResult.claims.admin) {
       showAdminUI();
     }
   });
   ```

3. **Enforce with Firebase Database Rules:**
   ```json
   {
     "rules": {
       "chat": {
         ".read": "auth != null",
         ".write": "auth != null && root.child('userProfiles').child(auth.uid).child('role').val() == 'admin'"
       }
     }
   }
   ```

**Alternative (No Cloud Function):**
- Store admin UIDs in Firebase Database (`/adminUsers/{uid}`)
- Check if current user's UID exists in that list
- Still requires Database Rules for security

---

#### 2. Admin Auto-Bypass for Specific Email

**Location:** `bendbsn-repo/admin/index.html` (auto-login logic)

**Risk Level:** **HIGH**
**Impact:** Client-side checks can be bypassed with browser DevTools

**Current Implementation:**
```javascript
if (userEmail === 'christiankholden@gmail.com') {
    sessionStorage.setItem('bsn9b_admin', 'true');
}
```

**Recommended Fix:**
- Remove client-side bypass logic entirely
- Use Firebase Custom Claims (see Issue #1)
- All admin checks must be enforced server-side via Database Rules

---

#### 3. Apps Script Endpoint + Token Embedded in Client

**Location:** `bendbsn-repo/admin/index.html:569`
```javascript
const API_URL = 'https://script.google.com/macros/s/AKfycbw.../exec?token=bsn_k7x9m2p4';
```

**Risk Level:** **HIGH**
**Impact:** Anyone can call your Apps Script API with the token, potentially:
- Reading all user data from Google Sheets
- Modifying/deleting user records
- Bypassing Firebase security

**Recommended Fix (Option 1 - Secure Apps Script):**
Add Firebase ID token validation to Apps Script:

1. **Client sends Firebase ID token:**
   ```javascript
   const idToken = await auth.currentUser.getIdToken();
   fetch(API_URL, {
     method: 'POST',
     body: JSON.stringify({ action: 'getUsers', idToken })
   });
   ```

2. **Apps Script verifies token:**
   ```javascript
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);

     // Verify Firebase ID token
     const tokenInfo = verifyFirebaseToken(data.idToken);
     if (!tokenInfo || !tokenInfo.email) {
       return ContentService.createTextOutput(
         JSON.stringify({error: 'Unauthorized'})
       );
     }

     // Check if user is admin
     if (!ADMIN_EMAILS.includes(tokenInfo.email)) {
       return ContentService.createTextOutput(
         JSON.stringify({error: 'Forbidden'})
       );
     }

     // Process request...
   }

   function verifyFirebaseToken(idToken) {
     const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=YOUR_API_KEY`;
     const response = UrlFetchApp.fetch(url, {
       method: 'post',
       contentType: 'application/json',
       payload: JSON.stringify({ idToken })
     });
     return JSON.parse(response.getContentText());
   }
   ```

**Recommended Fix (Option 2 - Firebase Callable Functions):**
Replace Apps Script with Firebase Cloud Functions:
- Callable functions automatically validate auth
- Direct access to Firebase Database
- Better error handling and logging

---

### 🟡 MEDIUM PRIORITY

#### 4. CSP Allows `unsafe-inline` Scripts/Styles

**Location:** `bendbsn-repo/index.html`, `bendbsn-repo/admin/index.html`
```html
<meta http-equiv="Content-Security-Policy" content="... script-src 'self' 'unsafe-inline' ...">
```

**Risk Level:** **MEDIUM**
**Impact:** Weakens XSS protection, allows injected scripts to run

**Why It Exists:**
- Entire app uses inline JavaScript (Firebase timing issues with external scripts)
- Static HTML site, can't generate nonces dynamically

**Recommended Fix (Nonce-Based CSP):**
Requires switching to a build system or dynamic HTML generation:

1. **Generate nonce at build time:**
   ```javascript
   const crypto = require('crypto');
   const nonce = crypto.randomBytes(16).toString('base64');
   ```

2. **Inject nonce into CSP header:**
   ```html
   <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'nonce-${nonce}'">
   ```

3. **Add nonce to all inline scripts:**
   ```html
   <script nonce="${nonce}">
     // Your code
   </script>
   ```

**Alternative (External Scripts + Webpack):**
- Move all inline JS to external `.js` files
- Use Webpack/Rollup to bundle
- Load Firebase SDK before app scripts
- Remove `unsafe-inline` from CSP

**Current Status:**
- Accepted risk for static site architecture
- Mitigated by:
  - Input sanitization (`escapeHtml()` function used everywhere)
  - No user-generated content rendered as HTML
  - Firebase Hosting security headers

---

### 🟢 LOW PRIORITY

#### 5. localStorage for Auth State

**Location:** `bendbsn-repo/index.html` (login redirect logic)
```javascript
localStorage.setItem('bsn9b_auth', 'true');
if (localStorage.getItem('bsn9b_auth')) {
    window.location.href = '/home/';
}
```

**Risk Level:** **LOW**
**Impact:** Auth state can be spoofed locally (but Firebase rules still protect data)

**Recommended Fix:**
Use Firebase Auth state instead of localStorage:

```javascript
// Instead of:
if (localStorage.getItem('bsn9b_auth')) {
    window.location.href = '/home/';
}

// Use:
auth.onAuthStateChanged((user) => {
    if (user) {
        window.location.href = '/home/';
    }
});
```

**Implementation:**
- Replace all `localStorage.getItem('bsn9b_auth')` checks with `auth.currentUser`
- Remove `localStorage.setItem('bsn9b_auth')` calls
- Keep `bsn9b_user`, `bsn9b_displayName`, `bsn9b_uid` for convenience (not security)

---

## Firebase Database Rules (Current State)

**CRITICAL:** Verify your Firebase Database Rules enforce access control:

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "chat": {
      "messages": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "presence": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },

    "userProfiles": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },

    "directMessages": {
      "$conversationId": {
        ".read": "auth != null && (
          data.child('participants/user1_uid').val() == auth.uid ||
          data.child('participants/user2_uid').val() == auth.uid
        )",
        ".write": "auth != null"
      }
    },

    "bannedUsers": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('adminUsers').child(auth.uid).exists()"
    }
  }
}
```

**To Check:** Go to Firebase Console → Realtime Database → Rules tab

---

## Immediate Actions (Priority Order)

### Phase 1: Critical Security (This Week)
1. ✅ **Remove hard-coded password** - Replace with UID-based admin list
2. ✅ **Secure Apps Script** - Add Firebase ID token validation
3. ✅ **Update Firebase Database Rules** - Enforce admin-only writes

### Phase 2: Auth Improvements (Next Week)
4. ⏳ **Replace localStorage auth** - Use Firebase Auth state
5. ⏳ **Set up Cloud Function** - Assign admin custom claims (requires Blaze plan)

### Phase 3: Infrastructure (Long-term)
6. ⏳ **Move to Firebase Functions** - Replace Apps Script entirely
7. ⏳ **Build system for nonces** - Eliminate `unsafe-inline` CSP
8. ⏳ **Add Firebase App Check** - Prevent API abuse

---

## Testing Security Changes

After implementing fixes:

1. **Test admin access:**
   - Try accessing `/admin/` without auth → should redirect
   - Try accessing with non-admin account → should show "Unauthorized"
   - Verify admin functions (ban user, clear messages) work with proper auth

2. **Test Firebase Rules:**
   - Use Firebase Console → Realtime Database → Rules Simulator
   - Test read/write with different user scenarios
   - Verify non-admins can't modify restricted data

3. **Test Apps Script protection:**
   - Call API without token → should return error
   - Call API with invalid token → should return error
   - Call API with valid non-admin token → should return error

---

## Resources

- [Firebase Auth Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Security Rules](https://firebase.google.com/docs/database/security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Firebase App Check](https://firebase.google.com/docs/app-check)

---

## Support

For questions about implementing these recommendations:
- Firebase Support: https://firebase.google.com/support
- GitHub Issues: https://github.com/ckholden/bendbsn/issues
