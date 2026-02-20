# Updates Log

## 2026-02-20

### Chat + Admin Reliability
- Fixed chat "Disconnected..." / "Loading users..." behavior caused by restricted `userProfiles` reads for non-admin users.
- Chat now degrades gracefully when full profile reads are denied, using cached/Sheet user data instead of blocking DM/mention user lists.
- Stale local chat sessions now clear and redirect to login when Firebase Auth is no longer active.
- Admin Registered Users loader now accepts multiple API response shapes and falls back to Firebase `userProfiles` if Google Sheets is empty/unavailable.

### Registration Emails
- Restored welcome email sending for the "Create Account" flow (it previously only sent admin notification on that path).
- Added welcome-email fallback via FormSubmit when EmailJS fails.
- Added JSON accept header on FormSubmit email fallback requests for more reliable responses.

### Security Hardening
- Locked `directMessages` rules to prevent participant-takeover on existing conversations.
- Hardened chat rendering sinks against stored XSS by escaping user-controlled names in message headers, typing indicator, DM lists, mention dropdown, and online user list.
- Added `https://api.emailjs.com` to CSP `connect-src` for login/registration email delivery.

### Admin + Rules
- Admin now has explicit read access to `/chat/messages` at the root level (prevents permission_denied in admin chat view).
- Published rules update includes admin role/claim checks for sensitive paths.

### Login Reliability
- Login page now waits for Firebase Auth state before redirecting to `/home/` to avoid stale-session redirect loops.
- Added a user-facing toast on stale local sessions: “Session expired. Please sign in again.”

### Home Page
- Removed duplicate navigation card grid on `/home/` to reduce redundancy (Quick Start remains).

### Repo Hygiene
- Removed unused files `ai-proxy-script.js` and `nul` from the repo.
- Added `.gitignore` patterns to prevent committing Firebase admin keys.

## 2026-02-01

### Latest Session Summary (Admin/Profiles)
- Added per-user role editor in Admin (role dropdown + Save Role) backed by `userProfiles/{uid}`.
- Admin role updates require Firebase Sign-In; if profile missing, user must log in once to create it.
- Login now auto-creates/updates `userProfiles/{uid}` for existing users on every sign-in.
- Firebase rules updated to allow admin read/write at `userProfiles` root for normalization/role edits.
- Chat/AI widgets intermittently not opening; console errors still being investigated (reported after rules changes and cache refresh).

### Security Hardening
- Added strict Firebase Realtime Database rules in `database.rules.json`.
- Default database access is now denied; access is scoped to authenticated users and admin-only paths.
- `userDocuments` is now keyed by `auth.uid` for privacy.
- `directMessages` now uses UID-based participants for access control.
- Added `userProfiles/{uid}` write on login to support secure DM lookups.
- Admin-only read/write added at `userProfiles` root to allow role normalization.

### App Changes
- Updated chat/DM logic across `app/index.html`, `home/index.html`, `community/index.html`, `resources/index.html` to use UID-based identity.
- Presence payload now includes `uid` and `email`.
- DM participant data now stores `{uid: {displayName, email}}`.
- Added DM self-test button + function to verify DM read/write permissions.
- App auto-attempts legacy document migration from email-keyed docs to UID-keyed docs on login.
- Login page now auto-creates/updates `userProfiles/{uid}` for existing users on every sign-in.
- Admin panel now supports per-user role updates (Role dropdown + Save Role).
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
