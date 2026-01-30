# BENDBSN - Nursing Documentation & Collaboration Platform

**Created by Christian Holden for Sumner College BSN9B**

A comprehensive web-based nursing documentation tool with real-time collaboration features designed for Sumner College nursing students.

**Live URL:** [bendbsn.com](https://bendbsn.com)

---

## Features

### Documentation Formats
- **DAR** - Data, Action, Response
- **DARP** - Data, Action, Response, Plan
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

## Admin Panel

Access at [bendbsn.com/admin.html](https://bendbsn.com/admin.html)

### Moderator Controls
- **Kick Users** - Remove users from current session
- **Ban/Unban Users** - Permanent bans with real-time enforcement
- **Delete Messages** - Remove individual chat messages
- **View Online Users** - Real-time presence monitoring
- **View Registered Users** - Full user list from Google Sheets

---

## Technical Stack

### Frontend
- HTML5, CSS3, JavaScript (vanilla)
- **jsPDF** - PDF generation
- **docx.js** - Word document generation
- **FileSaver.js** - File download handling

### Backend Services
- **Firebase Realtime Database** - Chat, presence, bans
- **Google Apps Script** - User management API, AI proxy
- **Groq API** - AI chat (free tier)
- **GitHub Pages** - Static hosting

### File Structure
```
bendbsn/
├── index.html              # Login page
├── app.html                # Main application
├── admin.html              # Admin/moderator panel
├── resources.html          # Study resources
├── complete-apps-script.js # Google Apps Script code
├── ai-proxy-script.js      # AI proxy reference
├── approved-contacts.csv   # Authorized users list
├── CNAME                   # Custom domain config
└── README.md               # This documentation
```

### Data Storage
- **Firebase:** Chat messages, online presence, banned users
- **Google Sheets:** User accounts (via Apps Script)
- **Session:** Login state (sessionStorage)
- **Local:** Custom smart phrases (localStorage)

---

## Development Notes

### API Endpoints
- **Apps Script:** `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`
- **Firebase:** `bendbsn-c3da9-default-rtdb.firebaseio.com`

### Deployment
1. Push to `main` branch on GitHub
2. GitHub Pages auto-deploys to bendbsn.com
3. For AI/user management changes, redeploy Google Apps Script

---

## Claude CLI Development

To continue development, run from project directory:
```bash
claude
```

Or use the desktop shortcut: `BENDBSN-Claude.bat`

---

*Last Updated: January 2025*
