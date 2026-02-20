# Security Implementation Plan

## Immediate Fixes Implemented

### 0. Admin Access via Custom Claims (Implemented)

**STATUS:** ✅ Implemented in `/admin/index.html`

**What changed:**
- Admin page now requires Firebase Auth + ID token claims (`admin=true` or `role=admin|instructor`)
- Removed the hard-coded admin password gate

**How to set custom claims (recommended):**

Use Firebase Admin SDK (Cloud Functions or a trusted server) to set claims:

```js
// Node.js (Admin SDK)
await admin.auth().setCustomUserClaims(uid, { admin: true, role: 'admin' });
```

**Minimal Cloud Function example (call once to promote a user):**
```js
exports.makeAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.email !== 'christiankholden@gmail.com') {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed');
  }
  const uid = data.uid;
  await admin.auth().setCustomUserClaims(uid, { admin: true, role: 'admin' });
  return { success: true };
});
```

**After setting claims:**
- User must re-login or refresh token to pick up new claims.

**Rules update:**
- `database.rules.json` now checks `auth.token.admin == true` or `auth.token.role == "admin"|"instructor"`.

### 1. Remove Hard-Coded Admin Password

**STATUS:** ✅ Implemented

**What was done:**
1. Removed `ADMIN_PASSWORD` from `/admin/index.html`
2. Admin access now enforced via Firebase Auth + custom claims
3. Admin UI only renders after claim validation

**Note:** Use custom claims (recommended) instead of DB-based admin lists.

---

### 2. Replace localStorage Auth with Firebase Auth State

**STATUS:** ⏳ Ready to implement

**What needs to be done:**
Replace all `localStorage.getItem('bsn9b_auth')` checks with proper Firebase Auth state:

**Files to Update:**
- `index.html` - Login redirect logic
- All pages with auth checks

**Old Code (Insecure):**
```javascript
if (localStorage.getItem('bsn9b_auth')) {
    window.location.href = '/home/';
}
```

**New Code (Secure):**
```javascript
auth.onAuthStateChanged((user) => {
    if (user) {
        window.location.href = '/home/';
    } else {
        // Show login form
    }
});
```

**Note:** Keep `bsn9b_user`, `bsn9b_displayName`, `bsn9b_uid` in localStorage for convenience (not for security decisions)

---

### 3. Secure Apps Script API

**STATUS:** ⏳ Requires Google Apps Script changes

**Option A: Add Firebase ID Token Validation to Apps Script**

This requires modifying your Google Apps Script. Here's the code:

```javascript
// Google Apps Script code
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Verify Firebase ID token
    if (!data.idToken) {
      return jsonResponse({error: 'Missing authentication token'}, 401);
    }

    const tokenInfo = verifyFirebaseToken(data.idToken);
    if (!tokenInfo || !tokenInfo.email) {
      return jsonResponse({error: 'Invalid authentication token'}, 401);
    }

    // Check if user is admin (update these emails)
    const ADMIN_EMAILS = [
      'christiankholden@gmail.com',
      'holdenc@cocc.edu'
    ];

    if (!ADMIN_EMAILS.includes(tokenInfo.email)) {
      return jsonResponse({error: 'Forbidden - admin access required'}, 403);
    }

    // Process the actual request
    const action = data.action;
    switch(action) {
      case 'getUsers':
        return getUsersFromSheet();
      case 'updateRole':
        return updateUserRole(data.email, data.role);
      case 'deleteUser':
        return deleteUserFromSheet(data.email);
      default:
        return jsonResponse({error: 'Unknown action'}, 400);
    }

  } catch (error) {
    Logger.log('Error: ' + error);
    return jsonResponse({error: error.toString()}, 500);
  }
}

function verifyFirebaseToken(idToken) {
  try {
    const projectId = 'bendbsn-17377'; // Your Firebase project ID
    const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=AIzaSyAmr2W8mekSPJ2pXM3gz1FvarfSBddpfLM`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.users && result.users.length > 0) {
      return {
        uid: result.users[0].localId,
        email: result.users[0].email,
        emailVerified: result.users[0].emailVerified
      };
    }

    return null;
  } catch (error) {
    Logger.log('Token verification error: ' + error);
    return null;
  }
}

function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getUsersFromSheet() {
  // Your existing code to get users
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  // ... return user data
}

// etc. for other functions
```

**Client-Side Changes:**
```javascript
// Update all API calls to include Firebase ID token
async function fetchUsers() {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'getUsers',
            idToken: idToken
        })
    });
    return response.json();
}
```

**Option B: Migrate to Firebase Cloud Functions (Recommended)**

Replace Apps Script entirely with Firebase Cloud Functions:
- Better security
- Direct Firebase integration
- Automatic auth handling
- Better performance

Requires:
- Firebase Blaze plan (pay-as-you-go)
- Node.js project setup
- Deployment via Firebase CLI

---

## Firebase Database Rules (Critical)

**MUST UPDATE YOUR RULES TO:**

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "adminUsers": {
      ".read": "auth != null",
      ".write": false
    },

    "chat": {
      "messages": {
        "$channelId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "presence": {
        ".read": "auth != null",
        ".write": "auth != null && $uid == auth.uid",
        "$uid": {
          ".validate": "newData.hasChild('user') && newData.hasChild('uid')"
        }
      },
      "typing": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },

    "directMessages": {
      "$conversationId": {
        ".read": "auth != null && (
          data.child('participants/user1_uid').val() == auth.uid ||
          data.child('participants/user2_uid').val() == auth.uid ||
          data.child('participants/user1').val() == root.child('userProfiles').child(auth.uid).child('displayName').val() ||
          data.child('participants/user2').val() == root.child('userProfiles').child(auth.uid).child('displayName').val()
        )",
        ".write": "auth != null"
      }
    },

    "userProfiles": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.uid == $uid || root.child('adminUsers').child(auth.uid).exists())"
      }
    },

    "userDocuments": {
      "$userEmail": {
        ".read": "auth != null && auth.token.email.replace('.', '_') == $userEmail",
        ".write": "auth != null && auth.token.email.replace('.', '_') == $userEmail"
      }
    },

    "community": {
      "posts": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },

    "bannedUsers": {
      ".read": "auth != null",
      ".write": "root.child('adminUsers').child(auth.uid).exists()"
    },

    "loginHistory": {
      ".read": "root.child('adminUsers').child(auth.uid).exists()",
      ".write": "auth != null"
    },

    "announcements": {
      ".read": "auth != null",
      ".write": "root.child('adminUsers').child(auth.uid).exists()"
    },

    "exportHistory": {
      ".read": "root.child('adminUsers').child(auth.uid).exists()",
      ".write": "auth != null"
    },

    "notificationLog": {
      ".read": "root.child('adminUsers').child(auth.uid).exists()",
      ".write": "auth != null"
    }
  }
}
```

**How to Update Rules:**
1. Go to Firebase Console → Realtime Database
2. Click "Rules" tab
3. Paste the above rules
4. Click "Publish"
5. Test with Rules Simulator

---

## Testing After Implementation

### Test Admin Access
1. ✅ Log in with admin UID → should access admin panel
2. ✅ Log in with non-admin UID → should show "Access denied"
3. ✅ Try accessing `/admin/` without login → should redirect to login
4. ✅ Try modifying `adminUsers` in console → should fail (write: false)

### Test DM Security
1. ✅ Alice can read her own DMs
2. ❌ Alice cannot read Bob's DMs with Charlie
3. ✅ Bob can read DMs with Alice
4. ❌ Guest (not logged in) cannot read any DMs

### Test Apps Script Security (if implemented)
1. ❌ Call API without token → 401 Unauthorized
2. ❌ Call API with invalid token → 401 Unauthorized
3. ❌ Call API with valid non-admin token → 403 Forbidden
4. ✅ Call API with valid admin token → Success

---

## Next Steps (Priority Order)

1. **THIS WEEK:**
   - ✅ Add your UID to `/adminUsers` in Firebase
   - ✅ Update Firebase Database Rules
   - ✅ Test rules with simulator
   - ⏳ Replace password check with UID check (code below)
   - ⏳ Replace localStorage auth checks

2. **NEXT WEEK:**
   - ⏳ Secure Apps Script with token validation
   - ⏳ Test all admin functions
   - ⏳ Document admin management process

3. **LONG TERM:**
   - ⏳ Set up Firebase Cloud Functions (replace Apps Script)
   - ⏳ Add Firebase App Check (prevent API abuse)
   - ⏳ Implement CSP nonces (requires build system)

---

## Rollback Plan

If anything breaks:
1. Revert Firebase Database Rules to previous version (History tab)
2. Keep old password check as fallback (comment it out, don't delete)
3. Test incrementally - one security fix at a time

---

## Questions?

- Firebase Rules: https://firebase.google.com/docs/database/security
- Cloud Functions: https://firebase.google.com/docs/functions
- Apps Script: https://developers.google.com/apps-script
