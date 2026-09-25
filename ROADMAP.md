# BENDBSN Development Roadmap

## Current Status
- **Version:** 1.1 (SaaS transformation in planning — Feb 2026)
- **Last Updated:** September 2026
- **Sept 24, 2026:** Chat, Community Hub, and AI assistant retired (see `UPDATES.md`). Struck-through items below belonged to those features.
- **Live URL:** https://bendbsn.com (COCC cohort 9B)
- **New Platform Domain:** rnotes.app (pending registration) — multi-tenant SaaS for nursing programs

## Recent Updates
- See `UPDATES.md` for the detailed change log.

---

## Completed Features

### Core Features
- [x] User authentication (Firebase Auth)
- [x] Nursing documentation generator (DAR, SOAP, etc.)
- ~~[x] Group chat with @mentions~~ (retired Sept 2026)
- ~~[x] Direct messages with read receipts~~ (retired Sept 2026)
- ~~[x] AI Nursing Assistant~~ (retired Sept 2026)
- [x] Dark mode
- [x] Lock screen (privacy)
- [x] Document history (save/load notes)
- [x] Phrase library
- [x] Resources page (drug lookup, lab values, calculators)
- [x] Welcome emails for new users (EmailJS)
- [x] Persistent login sessions
- [x] Homepage with navigation
- ~~[x] Community hub with posts~~ (retired Sept 2026)
- [x] UID-based private document storage
- ~~[x] UID-based direct messages with secure rules~~ (retired Sept 2026)

### Performance Optimizations (Jan 2026)
- [x] Script loading with `defer` attribute
- [x] Preconnect hints for CDN domains
- [x] Lazy loading for export libraries (jsPDF, docx, FileSaver)
- [x] Firebase listener cleanup on page unload
- [x] User list caching (10-minute localStorage)
- ~~[x] Chat message limiting (50 messages max in DOM)~~ (retired Sept 2026)
- [x] Debounced NANDA search (300ms)
- [x] Service worker with versioned caching

### UI/UX Improvements (Jan 2026)
- [x] Bottom toolbar navigation (replaced side buttons)
- [x] Toast notifications (replaced alert())
- [x] Loading states for async buttons
- ~~[x] Dark mode fixes for chat widget~~ (retired Sept 2026)
- [x] Keyboard navigation (ESC to close)

### Accessibility (Jan 2026)
- [x] ARIA labels on all interactive elements
- [x] Semantic HTML roles (navigation, dialog, tablist)
- [x] aria-expanded for menus
- [x] aria-live for dynamic content
- [x] Focus management

---

## In Progress

### Phase 2: Mobile Optimization (Priority: HIGH)
- [x] Responsive breakpoints refinement (tablet 768-1024px, phone breakpoints)
- ~~[x] Swipe gestures for panels (swipe right/down to close chat, swipe left/down for AI)~~ (retired Sept 2026)
- [x] Improved form inputs for mobile (44px touch targets, 16px font for iOS)
- [x] Safe area insets for notched phones
- [x] Full-screen mode option (in More menu on all pages)

### ~~Phase 4: Community Enhancements~~ (retired Sept 2026 — Community Hub removed)
- ~~[x] Comment threads on posts (reply functionality with Firebase)~~
- ~~[x] All categories available (Announcements, Study Tips, Career, NCLEX, Questions, General)~~
- ~~[x] Post editing/deletion (author only, with confirmation)~~
- ~~[x] Search bar for filtering posts by title/content/author~~
- ~~[ ] User profiles~~ (a standalone `/profile/` page exists independently of the hub)

### Phase 5: Clinical Toolkit Expansion (Priority: MEDIUM)
- [x] SBAR shift handoff generator (interactive form with copy to clipboard)
- [x] Procedure checklists (Foley, IV, Wound Care, Med Admin, Trach Care)
- [x] Med pass timer with browser notifications and sound alerts

### Phase 6: PWA Enhancement (Priority: MEDIUM)
- ~~[ ] Push notifications~~ (retired Sept 2026 with the chat)
- [ ] Offline document editing
- ~~[ ] Background sync for messages~~ (retired Sept 2026 with the chat)

---

## Future Phases (Backlog)

### Phase 3: SaaS Multi-Tenant Platform — ClinicalNotes (Priority: ACTIVE)
**Goal:** Transform BendBSN into a sellable multi-tenant SaaS platform for nursing programs nationally under the brand "ClinicalNotes" at rnotes.app.

**Approved Architecture:**
```
HOSTING: GitHub Actions → Firebase Hosting (replaces GitHub Pages)
DOMAIN:  rnotes.app (marketing) + {school}.rnotes.app per tenant

FIREBASE RTDB (new structure):
/tenants/{tenantId}/
  announcements, banned, globalPhrases, loginHistory

/userProfiles/{uid}           ← stays at root (rules lookups)
  tenantId: "cocc-9b"        ← NEW
  isSchoolAdmin: false        ← NEW

/tenantRegistry/{tenantId}    ← school metadata, plan, Stripe ID
/tenantConfig/{tenantId}      ← branding: logo, accent color, feature flags
/appConfig/roles/             ← stays global
```

**Pricing:**
- Pilot: $0 (free semester, get testimonial)
- Small (<40 students): $1,200/year
- Standard (40–100): $2,400/year
- Large (100+): $4,800/year
- Individual student: $7.99/month or $59/year

**Phase 1 — Foundation (before any paid school):**
- [ ] Register rnotes.app domain + Google Workspace (christian@rnotes.app)
- [ ] Add firebase.json hosting config + GitHub Actions deploy workflow
- [ ] Remove hardcoded admin email from database.rules.json → isAdmin flag only
- [ ] Add tenantId: "cocc-9b" to all existing userProfiles
- [ ] Rewrite database.rules.json with /tenants/{tenantId}/ isolation
- [ ] Add getTenantId() + loadTenantConfig() + applyTenantBranding() to shared/header.js
- [ ] Migrate storage keys: bsn9b_ → cnotes_ (with backwards-compat fallback)
- [ ] Update all Firebase DB refs in HTML files to use tenant path prefix
- [ ] ToS + Privacy Policy pages live on new domain
- [ ] Educational disclaimer on all PDF/Word exports
- [ ] Create Stripe Payment Links (3 tiers)

**Phase 2 — First Pilot School:**
- [ ] Provision first non-COCC school manually (~80 min)
- [ ] School admin panel (scoped to tenant)
- [ ] Subdomain DNS + Firebase Hosting per school
- [ ] Get testimonial → add to landing page

**Phase 3 — Self-Serve (at ~5 schools):**
- [ ] Stripe webhook → Cloud Function → auto-provision tenant
- [ ] Bulk student invite via CSV
- [ ] Self-serve signup at rnotes.app

**Agent Squad (in .claude/agents/):**
- `saas-director.md` — supervisor, invoke for any SaaS decisions
- `saas-tenant-architect.md` — Firebase rules/code implementation
- `saas-sales-growth.md` — outreach, Stripe, pricing, demo scripts
- `saas-onboarding.md` — new school provisioning
- `saas-marketing.md` — landing page, email sequences, positioning

### Phase 7: Study Tools
- [ ] Flashcard system (spaced repetition)
- [ ] Practice quizzes with explanations
- [ ] Drug calculation practice mode
- [ ] Care plan builder with NANDA templates
- [ ] Study group features

### Phase 8: Advanced Features
- [ ] Voice-to-text for documentation
- [ ] PDF export improvements
- [ ] Integration with clinical scheduling
- [ ] Instructor dashboard
- [ ] Grade tracking (if permitted)
- [ ] Skills checklist tracking

### Phase 9: Analytics & Insights
- [ ] Usage analytics dashboard
- [ ] Popular phrases/templates
- [ ] Study time tracking
- [ ] Progress indicators
- [ ] Cohort comparison stats (anonymized)

---

## Design Decisions

### Bottom Toolbar Design
Replace crowded side buttons with a clean bottom bar:
```
+--------------------------------------------------+
|  Home  |  Docs  |  Resources  |  Chat  |  More  |
+--------------------------------------------------+
         ^                         ^        ^
     Active tab              Badge for    Expands to:
     indicator               unread       - AI Bot
                                          - Dark Mode
                                          - Lock
                                          - Feedback
                                          - Logout
```
*Sept 2026: the Chat tab, its unread badge, and the AI Bot menu entry were retired with those features.*

### Color Palette
- Primary: #1f4e79 (Navy blue)
- Accent: #e94560 (Pink/red)
- Success: #4caf50 (Green)
- Warning: #ffc107 (Yellow)
- AI/Teal: #0d9488
- Purple: #8b5cf6

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## Technical Debt
- [x] Service worker cache versioning (implemented)
- [x] Firebase listener cleanup (implemented)
- [x] Error handling with toasts (implemented)
- [ ] **Remove hardcoded admin email from database.rules.json** (SaaS Phase 1 blocker)
- [ ] **Migrate GitHub Pages → Firebase Hosting** (SaaS Phase 1 blocker)
- [ ] **Rename bsn9b_ storage keys → cnotes_** (SaaS Phase 1)
- [ ] Extract shared components to separate JS file (deferred - inline JS preferred for reliability)
- [ ] Minify CSS/JS for production
- [ ] Add automated testing

---

## 🔕 Paused (code present, gated off)

### Daily login affirmation banner
**Shipped then paused 2026-04-22.** Code remains in place; flip the
feature flag to re-enable.

- **Files:**
  - `shared/affirmations.js` — 67 nursing-student-specific affirmations
    + `pickAffirmation()` with no-repeat-recent guard (last-5 picks
    tracked in `localStorage.bendbsn_recent_affirmations`).
  - `shared/header.js` — `maybeShowAffirmation()` IIFE; gated by
    `var AFFIRMATION_ENABLED = false;` constant near the top of the
    affirmation block.
  - `shared/header.css` — `.bsn-affirmation-banner` styles + dark
    mode + reduced-motion + mobile + print.
  - `index.html` — sets `sessionStorage.bendbsn_show_affirmation =
    '1'` at all 5 successful-auth sites. Flag is consumed silently
    while the feature is disabled (no banner, no orphan flag).
- **Re-enable:** edit `shared/header.js`, change
  `AFFIRMATION_ENABLED = false` → `true`, bump SW.
- **Console testing:** `window.testAffirmation()` force-shows one
  banner (also gated when disabled).
- **Why paused:** UX needs more thought. First-deploy testing showed
  (a) banner sometimes only appeared for ~0.5s if the landing page
  navigated/re-rendered during the 7s display window;
  (b) initial multi-tab spam suppression was blocking legitimate
  fast log-out/log-back-in cycles (later fixed via login-fingerprint
  check, but pause came before re-validation).
- **If re-enabled:** consider persisting the banner across the first
  navigation by injecting into `<header>` rather than `<body>`, or
  use a cross-page sessionStorage persist.

---

## Ideas Parking Lot
*Ideas to consider for future versions:*

1. **Integration with nursing apps** - Link to Epocrates, Medscape
2. **Virtual study rooms** - Video chat for study groups
3. **Mentorship matching** - Connect students with alumni
4. **Job board** - Post nursing job opportunities
5. **Certification tracking** - BLS, ACLS expiration reminders
6. **Shift swap board** - For clinical rotations
7. **Anonymous feedback** - To instructors
8. **Gamification** - Points, badges for engagement
9. **Calendar integration** - Sync with clinical schedules
10. **Multi-language support** - Spanish, etc.

---

## Notes
- Firebase project: bendbsn-17377 (Blaze plan)
- Current domain: bendbsn.com (GitHub Pages) — COCC cohort 9B stays here
- New product domain: rnotes.app (pending registration) → Firebase Hosting
- Google Workspace: christian@rnotes.app (pending setup)
- EmailJS configured for welcome emails (needs tenant-aware update)
- ~~AI powered by Google Apps Script proxy (Groq / Llama 3.3 70B)~~ (retired Sept 2026 — proxy is dead code; revoke the Groq key)
- Stripe: Payment Links for school licensing (not yet set up)
- FERPA: DPA template needed before first paid school (EDUCAUSE template)

---

*Last updated: September 24, 2026 — chat, community, and AI retirement (previous revision: February 2026 SaaS planning session)*
