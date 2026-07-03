# BendBSN Security Guidelines

## Overview
This document outlines security best practices for the BendBSN nursing documentation app, addressing Google Cloud security recommendations and Firebase security guidelines.

---

## ✅ Current Security Status

### 2026-02-20 Security Notes
- ✅ Realtime Database DM rule hardened to block participant-overwrite takeover on existing conversations.
- ✅ Chat rendering hardened against stored XSS in user name surfaces (message headers, typing, DM list/sidebar, mentions, online panel).
- ✅ CSP updated to allow EmailJS API requests (`https://api.emailjs.com`) required for client-side registration notifications.

### What's Already Secure

#### 1. **Firebase API Key Exposure (Public & Secure)**
- ✅ The Firebase Web API key in `index.html` is **intentionally public**
- ✅ Firebase Web API keys only identify your project, not authenticate it
- ✅ Security is enforced server-side via Firebase Security Rules
- ✅ No service account keys are committed to the repository
- ✅ `.gitignore` excludes sensitive files (apps scripts and Firebase admin keys)

**Reference:** [Firebase: Is it safe to expose Firebase apiKey to the public?](https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public)

#### 2. **Firebase Security Rules (Properly Configured)**
- ✅ Authentication required for all data access (`auth != null`)
- ✅ Admin-only access for sensitive operations (`auth.token.email == "christiankholden@gmail.com"`)
- ✅ User-scoped data access (users can only access their own documents)
- ✅ Proper validation rules for chat messages and community posts

**Location:** `database.rules.json`

#### 3. **Credential Storage**
- ✅ No plaintext passwords in database (Firebase Auth handles hashing)
- ✅ Admin email encoded in client (`atob()` - obfuscation, not security)
- ✅ EmailJS API keys are public keys (intended for client-side use)
- ✅ Firebase admin service account keys are stored outside the repo and ignored by `.gitignore`

---

## 🔐 Recommended Security Enhancements

### Priority 1: Firebase App Check (Recommended)

**What it does:** Prevents unauthorized apps/scripts from accessing your Firebase backend, even with the public API key.

**Setup:**
1. Enable App Check in Firebase Console
2. Register your domain (`bendbsn.com`)
3. Add reCAPTCHA v3 for web verification

```javascript
// Add to index.html after Firebase initialization
const appCheck = firebase.appCheck();
appCheck.activate('YOUR_RECAPTCHA_SITE_KEY', true);
```

**Benefits:**
- Blocks automated bots from abusing your Firebase quota
- Prevents unauthorized API usage
- Adds zero friction for legitimate users

**Documentation:** https://firebase.google.com/docs/app-check

---

### Priority 2: API Quota Monitoring

**Set up billing alerts to detect anomalies:**

1. **Google Cloud Console → Billing → Budgets & Alerts**
   - Create budget: Set to your expected monthly Firebase usage
   - Alert threshold: 50%, 90%, 100%
   - Add notification email: `christiankholden@gmail.com`

2. **Firebase Console → Usage & Billing**
   - Monitor Realtime Database reads/writes
   - Monitor Authentication sign-ins
   - Monitor Storage bandwidth

**Why this matters:**
- Compromised credentials can cause unexpected billing spikes
- Early detection = faster response
- Anomaly detection (spike in reads/writes) = potential security incident

---

### Priority 3: Essential Contacts (Google Cloud)

Ensure Google can reach you during security incidents:

1. Go to: https://console.cloud.google.com/iam-admin/essential-contacts
2. Add contact email: `christiankholden@gmail.com`
3. Select notification categories:
   - ✅ Billing
   - ✅ Security
   - ✅ Technical

---

### Priority 4: Firebase Security Rules Audit

**Current rules are secure**, but consider these enhancements:

#### Option A: Rate Limiting (Prevent Abuse)
```json
{
  "rules": {
    "chat": {
      "messages": {
        "$channelId": {
          "$messageId": {
            ".write": "auth != null && (!root.child('rateLimits').child(auth.uid).exists() || root.child('rateLimits').child(auth.uid).val() < now - 1000)"
          }
        }
      }
    }
  }
}
```

#### Option B: Data Validation (Prevent Malformed Data)
```json
{
  "rules": {
    "chat": {
      "messages": {
        "$messageId": {
          ".validate": "newData.hasChildren(['user', 'text', 'timestamp']) && newData.child('text').isString() && newData.child('text').val().length < 5000"
        }
      }
    }
  }
}
```

---

## 🛡️ Google Cloud Security Best Practices

### 1. **Zero-Code Storage** ✅ IMPLEMENTED
- ✅ No API keys committed to version control
- ✅ `.gitignore` excludes sensitive files
- ✅ Server-side scripts stored locally only

**Action required:** None (already compliant)

---

### 2. **Disable Dormant Keys** ⚠️ ACTION NEEDED

**Review Firebase service accounts:**

1. Go to: https://console.firebase.google.com/project/bendbsn-17377/settings/serviceaccounts/adminsdk
2. Check "Service account keys" tab
3. If any keys exist:
   - Review last used date
   - Delete keys with no activity in 30+ days
   - Rotate active keys every 90 days

**Service Account Key Policy:**
- ❌ **Never** create user-managed service account keys unless absolutely necessary
- ✅ Use Firebase Admin SDK with Application Default Credentials instead
- ✅ Use Cloud Functions for server-side operations (no keys needed)

**Cloud Functions Example (replaces service account keys):**
```javascript
// Instead of downloading a service account key:
// ❌ const serviceAccount = require('./serviceAccountKey.json');

// Use Cloud Functions with automatic authentication:
// ✅
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(); // Auto-authenticates in Cloud Functions

exports.sendAdminNotification = functions.auth.user().onCreate((user) => {
  // Full admin access, no keys needed
});
```

---

### 3. **Enforce API Restrictions** ⚠️ ACTION NEEDED

**Restrict Firebase API key usage:**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your Firebase API key (`AIzaSyAmr2W8mekSPJ2pXM3gz1FvarfSBddpfLM`) — note: the original auto-created key was replaced Feb 2026 with an unrestricted key to fix Google Sign-In OAuth relay blocking
3. Click "Edit"
4. Set restrictions:

**Application Restrictions:**
- Select: **HTTP referrers (web sites)**
- Add allowed referrers:
  - `bendbsn.com/*`
  - `*.bendbsn.com/*`
  - `localhost/*` (for local development)
  - `127.0.0.1/*` (for local development)

**API Restrictions:**
- Select: **Restrict key**
- Enable only these APIs:
  - Identity Toolkit API (Firebase Auth)
  - Firebase Realtime Database API
  - Token Service API

**Why this matters:**
- Prevents unauthorized domains from using your Firebase API key
- Blocks stolen keys from working on attacker's domains
- Reduces risk of quota exhaustion attacks

---

### 4. **Apply Least Privilege** ✅ MOSTLY IMPLEMENTED

**Current status:**
- ✅ Firebase Security Rules enforce user-level permissions
- ✅ Admin operations restricted to `christiankholden@gmail.com`
- ✅ Service accounts follow principle of least privilege

**Action required:** None (already compliant)

---

### 5. **Mandatory Rotation** ⚠️ RECOMMENDED

**If you use service account keys (currently not used):**

1. Set up key expiration policy:
```bash
gcloud resource-manager org-policies set-policy policy.yaml \
  --project=bendbsn-17377
```

**policy.yaml:**
```yaml
constraint: iam.serviceAccountKeyExpiryHours
listPolicy:
  allowedValues:
    - "2160" # 90 days
```

2. Or disable service account key creation entirely:
```bash
gcloud resource-manager org-policies set-policy disable-keys.yaml \
  --project=bendbsn-17377
```

**disable-keys.yaml:**
```yaml
constraint: iam.disableServiceAccountKeyCreation
booleanPolicy:
  enforced: true
```

**Current status:** Not applicable (no service account keys in use)

---

## 📧 Email Notification System Security

### Updated Architecture (Feb 2026)

**Primary Method:** EmailJS (more reliable than FormSubmit)
- ✅ Automatic retry on failure
- ✅ Detailed error logging to Firebase
- ✅ Admin dashboard for notification monitoring

**Fallback Method:** FormSubmit (if EmailJS unavailable)

**Monitoring:**
- All notification attempts logged to `notificationLog` in Firebase
- Admin panel shows success/failure stats
- Failed notifications include error messages for debugging

**Admin Panel:** `/admin/` → "📧 Email Notifications" button

---

## 🔍 Security Monitoring

### What to Monitor

1. **Firebase Console → Authentication → Users**
   - Unusual spike in new user registrations
   - Users from unexpected geographic locations
   - Rapid account creation from same IP

2. **Firebase Console → Database → Usage**
   - Sudden increase in reads/writes
   - Bandwidth spikes
   - Connections from unknown IP ranges

3. **Google Cloud Console → IAM & Admin → Audit Logs**
   - Service account activity
   - Permission changes
   - Failed authentication attempts

4. **Admin Panel → Login History**
   - Failed login attempts
   - Unusual login times/patterns
   - Multiple accounts from same IP

---

## 🚨 Incident Response Plan

### If You Suspect a Security Breach

1. **Immediate Actions:**
   - Disable affected service account keys (if any)
   - Review Firebase Security Rules for unauthorized changes
   - Check Firebase Realtime Database for unexpected data modifications
   - Review recent authentication activity

2. **Investigation:**
   - Check Admin Panel → Login History for suspicious activity
   - Review Firebase Console → Database → Usage for anomalies
   - Check Google Cloud Billing for unexpected charges
   - Review notification log for failed/unusual registration attempts

3. **Recovery:**
   - Rotate compromised credentials
   - Update Firebase Security Rules if needed
   - Ban malicious users via Admin Panel
   - Clear unauthorized data from database

4. **Prevention:**
   - Enable Firebase App Check (if not already enabled)
   - Tighten Firebase Security Rules
   - Review and restrict API key usage
   - Set up additional monitoring alerts

---

## 📚 Additional Resources

### Firebase Security
- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Firebase Security Checklist](https://firebase.google.com/support/guides/security-checklist)

### Google Cloud Security
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [IAM Best Practices](https://cloud.google.com/iam/docs/using-iam-securely)
- [Service Account Key Management](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)

### Compliance
- [HIPAA Compliance Guide](https://firebase.google.com/support/privacy/hipaa)
- [FERPA Compliance (Education Records)](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html)

---

## ✅ Action Items Checklist

### High Priority (Do First)
- [ ] Set up Google Cloud billing alerts (30 min)
- [ ] Add Essential Contacts in Google Cloud Console (5 min)
- [ ] Restrict Firebase API key to `bendbsn.com` domain (10 min)
- [ ] Review notification log for failed emails (5 min)

### Medium Priority (This Month)
- [ ] Enable Firebase App Check with reCAPTCHA v3 (1 hour)
- [ ] Review Firebase Security Rules for rate limiting (30 min)
- [ ] Audit service account keys (if any exist) (15 min)
- [ ] Set up automated security monitoring alerts (1 hour)

### Low Priority (Nice to Have)
- [ ] Implement rate limiting in Firebase Security Rules
- [ ] Set up Cloud Functions for server-side operations
- [ ] Enable Firebase Performance Monitoring
- [ ] Set up automated Firebase Security Rules testing

---

## 🛠️ Tools & Commands

### Check Firebase Project Status
```bash
firebase projects:list
firebase use bendbsn-17377
firebase auth:export users.json  # Backup users
```

### Test Firebase Security Rules
```bash
firebase emulators:start --only database
# Use Firebase Emulator UI: http://localhost:4000
```

### Monitor Real-time Firebase Usage
```bash
firebase database:profile --duration 5m
```

### Deploy Updated Security Rules
```bash
firebase deploy --only database:rules
```

---

**Last Updated:** February 19, 2026
**Next Review:** May 19, 2026 (3 months)
