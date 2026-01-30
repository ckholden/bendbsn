# BENDBSN - Nursing Documentation & Collaboration Platform

**Created by Christian Holden for Sumner College BSN9B**

A comprehensive web-based nursing documentation tool with real-time collaboration features designed for Sumner College nursing students.

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
- **Registered Users** - Full user list from Google Sheets with approve/ban controls
- **Online Users** - Real-time presence monitoring with kick/ban options
- **Banned Users** - Manage bans with unban capability
- **Chat Messages** - View and delete recent messages
- **Manage Smart Phrases** - Add global smart phrases for all users
- **Add User** - Directly add new users to the system

### Quick Actions
- Kick All from Chat
- Clear All Messages
- Refresh All Data
- Export Login History to CSV

---

## User Accounts

### Default Users (Sumner College BSN9B)
| Name | Username | Password |
|------|----------|----------|
| Holden C (Admin) | holdenc | admin |
| Ann Ottessen (Instructor) | anno | instructor2025 |
| All Students | firstnamelastinit | sumner2025 |

Example student logins: `ryleeb`, `nicoles`, `naomis`, etc.

---

## Technical Stack

### Frontend
- HTML5, CSS3, JavaScript (vanilla)
- **jsPDF** - PDF generation
- **docx.js** - Word document generation
- **FileSaver.js** - File download handling

### Backend Services
- **Firebase Realtime Database** - Chat, presence, bans, login history, global phrases
- **Google Apps Script** - User management API, AI proxy
- **Google Sheets** - User database (Sheet ID: `1q0zoGH8r4m6QbMvE3288d5jTf62t6IoKhtBKNRBMk2w`)
- **Groq API** - AI chat (free tier, Llama 3.3 70B)
- **RxNav API** - Drug name autocomplete
- **GitHub Pages** - Static hosting with custom domain

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

- HTTPS enforcement (GitHub Pages SSL)
- HTTPS redirect on all pages
- Failed login attempt tracking
- Real-time ban enforcement
- HIPAA notice (no real patient data)
- Session-based authentication

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
- `doPost(e)` - Handle POST requests (addUser, updateStatus, AI chat)
- `getUsers()` - Fetch all users from sheet
- `addUser(params)` - Add new user to sheet
- `updateStatus(params)` - Update user status
- `handleAIRequest(data)` - Proxy AI requests to Groq
- `setupUsersSheet()` - One-time setup to create Users tab

---

## Changelog

### January 2025
- Initial release with all documentation formats
- AI Nursing Companion integration
- Real-time chat system
- Admin panel with user management
- Clean URLs (removed .html extensions)
- HTTPS redirect on all pages
- Login history tracking with failed attempts
- Medication administration panel with RxNav autocomplete
- Global smart phrases (admin-managed via Firebase)
- Scrollable admin panel cards
- CSV export for login history

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
