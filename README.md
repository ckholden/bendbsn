# BENDBSN - Nursing Documentation & Collaboration Platform

**Created by Christian Holden**

A comprehensive web-based nursing documentation tool with real-time collaboration features designed for nursing students.

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

### AI Nursing Companion
- Intelligent chatbot for nursing education support
- Quick action buttons:
  - Drug Info lookup
  - Care Plan assistance
  - NCLEX-style questions
  - Lab values reference
- Powered by Groq API (Llama 3.3 70B model)
- Accessible via teal chat widget (bottom-left corner)

### Real-Time Chat & Collaboration
- Live chat with classmates and instructors
- Display names (first names) shown instead of usernames
- Online presence indicator
- 48-hour message retention with auto-cleanup
- Firebase Realtime Database backend

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

**Password:** `admin1374`

### Features
- **Login History** - View all login attempts (success/failed) with CSV export
- **Registered Users** - User list with ban controls (link to Firebase Console for full deletion)
- **Online Users** - Real-time presence monitoring with kick/ban options
- **Banned Users** - Manage bans with unban capability
- **Chat Messages** - View and delete recent messages
- **Manage Smart Phrases** - Add global smart phrases for all users

**Note:** "Add User" removed - users self-register via Firebase Auth

### Quick Actions
- Kick All from Chat
- Clear All Messages
- Refresh All Data
- Export Login History to CSV

### Chat Commands (Admin only - christiankholden@gmail.com)
Type these commands in the chat box to manage site-wide announcements:

| Command | Description |
|---------|-------------|
| `alert/Your message` | Shows flashing red banner at top of all pages |
| `fyi/Your message` | Shows yellow info banner at top of all pages |
| `alert/clear` | Removes the alert banner |
| `fyi/clear` | Removes the fyi banner |
| `chat/clear` | Clears all chat history |

**Notes:**
- Commands are intercepted and don't appear in chat
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
- **Firebase Realtime Database** - Chat, presence, bans, login history, global phrases, announcements
- **Google Apps Script** - User profile storage, AI proxy
- **Google Sheets** - User directory (name, email only - passwords handled by Firebase)
- **Groq API** - AI chat (free tier, Llama 3.3 70B)
- **RxNav API** - Drug name autocomplete
- **FormSubmit** - Email notifications for new registrations
- **GitHub Pages** - Static hosting with custom domain

### Update Log
- See `UPDATES.md` for recent changes and security updates.

### Realtime Database Rules
- Rules file: `database.rules.json` (apply in Firebase Console or via Firebase CLI)
- `userDocuments` and `directMessages` now key by UID for privacy
- First login after this update writes `userProfiles/{uid}` used for DM lookup

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
├── ai-proxy-script.js      # AI proxy reference
├── approved-contacts.csv   # Authorized users list
├── CNAME                   # Custom domain config
├── robots.txt              # Search engine config
└── README.md               # This documentation
```

### Data Storage
- **Firebase:** Chat messages, online presence, banned users, login history, global smart phrases
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
3. For AI/user management changes, redeploy Google Apps Script:
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
- `doPost(e)` - Handle POST requests (addUser, updateStatus, updatePassword, AI chat)
- `getUsers()` - Fetch all users from sheet
- `addUser(params)` - Add new user profile to sheet (passwords now in Firebase)
- `updateStatus(params)` - Update user status
- `updatePassword(params)` - Update password field (legacy support)
- `handleAIRequest(data)` - Proxy AI requests to Groq
- `setupUsersSheet()` - One-time setup to create Users tab

---

## Changelog

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

*Last Updated: January 2025*
