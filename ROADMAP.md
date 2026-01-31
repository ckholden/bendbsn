# BENDBSN Development Roadmap

## Current Status
- **Version:** 1.1
- **Last Updated:** January 2026
- **Live URL:** https://bendbsn.com

---

## Completed Features

### Core Features
- [x] User authentication (Firebase Auth)
- [x] Nursing documentation generator (DAR, SOAP, etc.)
- [x] Group chat with @mentions
- [x] Direct messages with read receipts
- [x] AI Nursing Assistant
- [x] Dark mode
- [x] Lock screen (privacy)
- [x] Document history (save/load notes)
- [x] Phrase library
- [x] Resources page (drug lookup, lab values, calculators)
- [x] Welcome emails for new users (EmailJS)
- [x] Persistent login sessions
- [x] Homepage with navigation
- [x] Community hub with posts

### Performance Optimizations (Jan 2026)
- [x] Script loading with `defer` attribute
- [x] Preconnect hints for CDN domains
- [x] Lazy loading for export libraries (jsPDF, docx, FileSaver)
- [x] Firebase listener cleanup on page unload
- [x] User list caching (10-minute localStorage)
- [x] Chat message limiting (50 messages max in DOM)
- [x] Debounced NANDA search (300ms)
- [x] Service worker with versioned caching

### UI/UX Improvements (Jan 2026)
- [x] Bottom toolbar navigation (replaced side buttons)
- [x] Toast notifications (replaced alert())
- [x] Loading states for async buttons
- [x] Dark mode fixes for chat widget
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
- [x] Swipe gestures for panels (swipe right/down to close chat, swipe left/down for AI)
- [x] Improved form inputs for mobile (44px touch targets, 16px font for iOS)
- [x] Safe area insets for notched phones
- [ ] Full-screen mode option

### Phase 4: Community Enhancements (Priority: MEDIUM)
- [x] Comment threads on posts (reply functionality with Firebase)
- [x] All categories available (Announcements, Study Tips, Career, NCLEX, Questions, General)
- [x] Post editing/deletion (author only, with confirmation)
- [x] Search bar for filtering posts by title/content/author
- [ ] User profiles

### Phase 5: Clinical Toolkit Expansion (Priority: MEDIUM)
- [x] SBAR shift handoff generator (interactive form with copy to clipboard)
- [x] Procedure checklists (Foley, IV, Wound Care, Med Admin, Trach Care)
- [ ] Timer/reminders for med passes

### Phase 6: PWA Enhancement (Priority: MEDIUM)
- [ ] Push notifications
- [ ] Offline document editing
- [ ] Background sync for messages

---

## Future Phases (Backlog)

### Phase 3: Multi-Cohort Support (Priority: FUTURE)
**Goal:** Support multiple nursing cohorts with separate chat channels

**Database Structure:**
```
/cohorts/
  /bend-bsn-9b/
    - name: "Bend BSN Cohort 9B"
    - startDate: "2024-01"
    - status: "active" | "graduated"
  /bend-bsn-10a/
    - name: "Bend BSN Cohort 10A"
    ...

/users/{userId}/
  - cohort: "bend-bsn-9b"
  - role: "student" | "instructor" | "alumni"

/chat/
  /cohort-{cohortId}/messages/...
  /global/messages/...  (cross-cohort announcements)
```

**Features:**
- [ ] Cohort selection on registration
- [ ] Cohort-specific group chat
- [ ] Cross-cohort DMs for networking
- [ ] Admin: create/manage cohorts
- [ ] Admin: graduate cohorts to alumni
- [ ] Cohort-specific announcements
- [ ] Analytics per cohort

**Naming Convention Options:**
- "Bend BSN 9B" (current)
- "Sumner-Bend-2024-Fall"
- User-defined by admin

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
- [ ] Extract shared components to separate JS file (deferred - inline JS preferred for reliability)
- [ ] Minify CSS/JS for production
- [ ] Improve Firebase security rules
- [ ] Add automated testing
- [ ] Set up CI/CD pipeline

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
- Firebase project: bendbsn-17377
- Domain: bendbsn.com (GitHub Pages)
- EmailJS configured for welcome emails
- AI powered by Google Apps Script proxy

---

*Last updated by development session - January 2026*
