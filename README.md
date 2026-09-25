# BENDBSN - Nursing Documentation Platform

**Created by Christian Holden**

A comprehensive web-based nursing documentation tool designed for nursing students.

**Live URL:** [bendbsn.com](https://bendbsn.com)

---

## Features

### Documentation Formats
- **DAR** - Data, Action, Response/Recommendations
- **DARP** - Data, Action, Response/Recommendations, Plan
- **SOAP** - Subjective, Objective, Assessment, Plan
- **SOAPIE** - SOAP + Intervention, Evaluation
- **SBAR** - Situation, Background, Assessment, Recommendation
- **PIE** - Problem, Intervention, Evaluation
- **Narrative** - Free-form narrative notes
- **Head-to-Toe (H2T)** - Comprehensive assessment with quick-fill buttons

### Quick Vitals Entry Panel
- Individual input fields for BP, HR, RR, Temp, O2%, Pain
- Expanded O2 delivery options:
  - Room Air (RA)
  - Nasal Cannula (1-6L)
  - Masks (Simple, Venturi, Non-Rebreather, Partial Rebreather)
  - Advanced (HFNC, CPAP, BiPAP, Trach Collar, T-Piece, Ventilator)
- One-click insert into any text field

### Medication Administration Panel
- Drug name autocomplete via RxNav API
- Shows Generic (Brand) or Brand (Generic) labels
- Dose, route, frequency, and time fields
- One-click insert into documentation

### Smart Phrases
Type a shortcut followed by space to auto-expand text. Examples:
- `.vs` - Vital signs template
- `.neuro` - Neurological assessment
- `.resp` - Respiratory assessment
- `.cv` - Cardiovascular assessment
- `.gi` - GI assessment
- `.gu` - GU assessment
- `.skin` - Skin assessment
- `.pain` - Pain template
- `.aox4` - Alert and oriented x4
- `.perrla` - Pupil assessment
- `.mae` - Moving all extremities
- `.cta` - Clear to auscultation
- `.rrr` - Regular rate and rhythm
- And 40+ more...

### NANDA Nursing Diagnoses Database
- Searchable database with 60+ nursing diagnoses
- Categories: Activity/Rest, Circulation, Ego Integrity, Elimination, Food/Fluid, Neurosensory, Pain/Discomfort, Respiration, Safety, Hygiene, Health Promotion
- Click to add diagnoses to documentation

### Head-to-Toe Assessment Quick-Fill Buttons
Pre-built phrases for rapid documentation:
- **Neuro:** A&Ox4, PERRLA, GCS 15, MAE x4
- **Cardio:** S1S2 RRR, Pulses 2+, Cap refill <3s, No edema
- **Resp:** CTA bilat, Unlabored, No SOB
- **GI:** BS active x4, Soft NT ND
- **GU:** Voiding, Foley patent
- **Skin:** WDI (Warm, Dry, Intact), No breakdown
- **MSK:** ROM intact, Gait steady
- **Pain:** Pain scales, Denies pain

### Export Options
- **PDF Export** - Professional formatted document
- **Word Export** - .docx file with same formatting
- **File Naming:** `date_time_noteType_lastName.pdf/docx`

---

## Site Structure (Clean URLs)

| URL | Description |
|-----|-------------|
| bendbsn.com | Login page |
| bendbsn.com/app/ | Main documentation app |
| bendbsn.com/admin/ | Admin control panel |
| bendbsn.com/resources/ | Study resources (redirects) |

---

## Admin Panel

Access at [bendbsn.com/admin/](https://bendbsn.com/admin/)

**Access:** there is no shared password — sign in with a Firebase account that holds the `isAdmin` custom claim (granted by the `setAdminClaim` Cloud Function) or has `isAdmin: true` or the instructor role in `userProfiles/{uid}`, and the database rules enforce the same `userProfiles` check server-side.

### Features
- **Login History** - View all login attempts (success/failed) with CSV export
- **Registered Users** - User list with ban controls (link to Firebase Console for full deletion)
- **Banned Users** - Manage bans with unban capability
- **Manage Smart Phrases** - Add global smart phrases for all users

**Note:** "Add User" removed - users self-register via Firebase Auth

### Quick Actions
- Refresh All Data
- Export Login History to CSV

### Site-Wide Announcement Banners (Admin only)
The alert/FYI banners are driven by two Realtime Database values:

| Path | Effect |
|------|--------|
| `announcements/alert/message` | Shows flashing red banner at top of all pages |
| `announcements/fyi/message` | Shows yellow info banner at top of all pages |

Set a message to show a banner and delete the value to clear it, using the admin panel's Firebase explorer or the Firebase Console. The old `alert/`, `fyi/`, and `chat/clear` chat-box commands were retired with the chat in September 2026.

**Notes:**
- Banners sync in real-time across all logged-in users
- Both banners can be active simultaneously (alert stacks above fyi)

---

## User Accounts & Authentication

### Firebase Authentication (Implemented January 2025)
- **Login:** Email + Password (Firebase Auth)
- **Registration:** Self-service via registration form
- **Password Reset:** Automated via Firebase email
- **Security:** Bcrypt password hashing (industry standard)

### Admin Account
| Name | Email | Notes |
|------|-------|-------|
| Christian Holden | christiankholden@gmail.com | Full admin access |

### User Management
- Users register themselves via the login page
- Admin receives email notification for each new registration
- Ban/unban users from Admin Dashboard
- Full account deletion via [Firebase Console](https://console.firebase.google.com/project/bendbsn-17377/authentication/users)

### Legacy Note
Previous username/password system (Google Sheets) has been replaced. Old accounts no longer work - users must re-register with their email.

---

## Technical Stack

### Frontend
- HTML5, CSS3, JavaScript (vanilla)
- **jsPDF** - PDF generation
- **docx.js** - Word document generation
- **FileSaver.js** - File download handling

### Backend Services
- **Firebase Authentication** - Secure email/password login with bcrypt hashing
- **Firebase Realtime Database** - Saved documents, user profiles, bans, login history, global phrases, announcements
- **Google Apps Script** - User profile storage
- **Google Sheets** - User directory (name, email only - passwords handled by Firebase)
- **RxNav API** - Drug name autocomplete
- **FormSubmit** - Email notifications for new registrations
- **GitHub Pages** - Static hosting with custom domain

### Update Log
- See `UPDATES.md` for recent changes and security updates.

### Realtime Database Rules
- Rules file: `database.rules.json` (apply in Firebase Console or via Firebase CLI)
- `userDocuments` is keyed by UID for privacy
- First login writes `userProfiles/{uid}`, used for role lookups and admin tooling

### File Structure
```
bendbsn/
├── index.html              # Login page
├── app/
│   └── index.html          # Main application
├── admin/
│   └── index.html          # Admin control panel
├── resources/
│   └── index.html          # Resources redirect
├── complete-apps-script.js # Google Apps Script code (gitignored)
├── approved-contacts.csv   # Authorized users list
├── CNAME                   # Custom domain config
├── robots.txt              # Search engine config
└── README.md               # This documentation
```

### Data Storage
- **Firebase:** Saved documents, user profiles, banned users, login history, global smart phrases, announcements
- **Google Sheets:** User accounts (name, email, username, password, status, date)
- **Session:** Login state (sessionStorage)
- **Local:** Custom smart phrases (localStorage)

---

## Security Features

- **Firebase Authentication** - Industry-standard bcrypt password hashing
- **Automatic password reset** - Secure email-based reset (no admin access to passwords)
- **Auto-logout on tab close** - Session cleared when browser tab/window closes
- **HTTPS enforcement** - GitHub Pages SSL on all pages
- **Failed login attempt tracking** - Logged to Firebase
- **Real-time ban enforcement** - Immediate effect across all sessions
- **HIPAA notice** - Reminder to not enter real patient data
- **Rate limiting** - Firebase Auth blocks brute force attempts

---

## Development Notes

### API Endpoints
- **Apps Script:** `https://script.google.com/macros/s/AKfycbwJZ_2LLB4omX9sGWy1HA_GZx71L_evx1UbKnnq0e4Hg4_-lHTN90iAcf0voB-lCbLd/exec`
- **Firebase:** `bendbsn-17377-default-rtdb.firebaseio.com`

### Deployment
1. Push to `main` branch on GitHub
2. GitHub Pages auto-deploys to bendbsn.com
3. For user management changes, redeploy Google Apps Script:
   - Deploy > Manage deployments > Edit > New version > Deploy

### DNS Configuration (Porkbun)
| Type | Host | Answer |
|------|------|--------|
| A | bendbsn.com | 185.199.108.153 |
| A | bendbsn.com | 185.199.109.153 |
| A | bendbsn.com | 185.199.110.153 |
| A | bendbsn.com | 185.199.111.153 |
| CNAME | www | ckholden.github.io |

**Note:** Do not use wildcard CNAME (`*.bendbsn.com`) - it interferes with GitHub SSL certificate issuance.

### Google Apps Script Functions
- `doGet(e)` - Handle GET requests (getUsers)
- `doPost(e)` - Handle POST requests (addUser, updateStatus, updatePassword)
- `getUsers()` - Fetch all users from sheet
- `addUser(params)` - Add new user profile to sheet (passwords now in Firebase)
- `updateStatus(params)` - Update user status
- `updatePassword(params)` - Update password field (legacy support)
- `setupUsersSheet()` - One-time setup to create Users tab

**Retired:** the `handleAIRequest` Groq proxy that served the AI assistant is dead code as of September 2026. Remove it from the deployed script when it is next touched and revoke the Groq API key.

---

## Changelog

### September 24, 2026 - Retired Chat, Community Hub, and AI Assistant
- `/chat/`, `/community/`, and `/ai/` replaced with redirect stubs to `/home/`
- Navigation links, service worker precache entries, and shared header chat/presence code removed
- Cloud Functions `cleanupStalePresence`, `onDMSent`, `onChatMention` deleted (remove from Firebase with `firebase deploy --only functions`)
- Database rules for `chat`, `directMessages`, `community`, `groupChats`, `userFCMTokens`, `userDMs`, `userLastSeen` removed; leftover data can be purged from the Firebase Console
- Push notifications (FCM) retired with the chat; the Apps Script AI proxy is dead code and the Groq key should be revoked

### January 30, 2025 - Firebase Authentication Upgrade
- **MAJOR:** Migrated from Google Sheets passwords to Firebase Authentication
- Email/password login with bcrypt hashing (secure)
- Self-service password reset via Firebase email
- Auto-logout when user closes tab/window
- Logout button moved to sidebar (always visible)
- Removed "Add User" from admin panel (users self-register)
- Admin commands now work with email-based usernames
- Alert/FYI banners with soft flash animation
- Registration notification emails to admin
- Better error messages for login/registration issues

### January 2025 - Initial Release
- All documentation formats (DAR, DARP, SOAP, SOAPIE, SBAR, PIE, Narrative, H2T)
- AI Nursing Companion integration (Groq/Llama 3.3)
- Real-time chat system with Firebase
- Admin panel with user management
- Clean URLs (removed .html extensions)
- HTTPS redirect on all pages
- Login history tracking with failed attempts
- Medication administration panel with RxNav autocomplete
- Global smart phrases (admin-managed via Firebase)
- Alert/FYI banner system with chat commands
- CSV export for login history

---

## Future Upgrade Ideas

### High Priority
- [ ] **Google Sign-In** - One-click login for users with Google accounts
- [ ] **Email verification** - Require email confirmation before account activation
- [ ] **Profile page** - Let users update their display name and preferences

### Medium Priority
- [ ] **Role-based permissions** - Instructor vs Student roles with different capabilities
- [ ] **Document history** - Save and retrieve previous documentation sessions
- [ ] **Export to EHR format** - HL7 FHIR or CDA export options
- [ ] **Mobile app** - Progressive Web App (PWA) for offline access

### Nice to Have
- [ ] **Dark mode** - Toggle for night shift documentation
- [ ] **Voice dictation** - Speech-to-text for hands-free documentation
- [ ] **Collaborative editing** - Multiple users editing same document
- [ ] **NCLEX practice mode** - Timed quizzes with AI-generated questions
- [ ] **Clinical rotation tracker** - Log hours and experiences

---

## Claude CLI Development

**Project Location:** `C:\Users\chris\Desktop\projects\projects\`

To continue development:
```bash
cd C:\Users\chris\Desktop\projects\projects
claude
```

Or double-click: `BENDBSN-Claude.bat` on Desktop

---

## Support

If you find this tool helpful, consider supporting its development:

**[Donate via Venmo](https://venmo.com/ChristianKSHolden)** to help keep it running.

---

*Last Updated: September 24, 2026*
