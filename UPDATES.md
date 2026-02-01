# Updates Log

## 2026-02-01

### Security Hardening
- Added strict Firebase Realtime Database rules in `database.rules.json`.
- Default database access is now denied; access is scoped to authenticated users and admin-only paths.
- `userDocuments` is now keyed by `auth.uid` for privacy.
- `directMessages` now uses UID-based participants for access control.
- Added `userProfiles/{uid}` write on login to support secure DM lookups.

### App Changes
- Updated chat/DM logic across `app/index.html`, `home/index.html`, `community/index.html`, `resources/index.html` to use UID-based identity.
- Presence payload now includes `uid` and `email`.
- DM participant data now stores `{uid: {displayName, email}}`.
- Added DM self-test button + function to verify DM read/write permissions.
- App auto-attempts legacy document migration from email-keyed docs to UID-keyed docs on login.
- Expanded H2T assessment with Mental Status, Safety/Risk, and Lines/Drains sections.
- Added PHQ-9/GAD-7 scoring with summary insertion into Psychosocial notes.
- Medication insert panel now supports frequency, PRN parameters, effect/response, and recent meds.
- Added session heartbeat and logout-based duration tracking for login history across app pages and admin.
- Registration now includes role selection (RN Student/Instructor/RN/Other), stored on profiles and admin emails.
- Notes page auto-fills the nurse name from the logged-in display name.
- Admin panel now includes a Normalize Roles action (sets all to RN Student, Ann to Instructor).

### Mobile UX + Community
- Added mobile action bar (Save / Copy / PDF / Word) on the app page.
- Added auto-save draft indicator and draft restore for the documentation form.
- Added mobile section jump drawer for long note types.
- Bulletin board now highlights announcements + pinned posts.
- Added optional tags on community posts with tag chips and search support.

### Chat
- Added multi-channel group chat with admin-only create/delete and channel picker on all pages.

### Resources Revamp
- Added Resource Navigator search + filter chips with dynamic counts.
- Added Clinical Prep & Sim Lab card with checklist and shift planner (save/copy/clear).
- Tagged resource cards for quick filtering by topic (drugs, labs, vitals, calculations, clinical skills, study).

### Operational Notes
- Old DMs (display-name keyed) will not appear under new UID-based conversations.
- New users must log in once to populate `userProfiles/{uid}` before they appear in DM lists.
