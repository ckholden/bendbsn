# BENDBSN Project - Nursing Documentation App

## Project Overview
- **Repository**: https://github.com/ckholden/bendbsn.git
- **Live Site**: https://bendbsn.com
- **Main App**: /app/index.html
- **Login Page**: /index.html
- **Deployed via**: GitHub Pages

## Tech Stack
- Firebase Realtime Database & Auth
- Vanilla JavaScript (no frameworks)
- Static HTML hosted on GitHub Pages
- Google Apps Script API for user management

## Key Features Implemented (Jan 2025)

### 1. Dark Mode
- CSS variables in `:root` and `[data-theme="dark"]`
- Toggle button on right sidebar (sun/moon icons)
- Persists in localStorage (`bsn9b_theme`)

### 2. Document History
- Firebase path: `/userDocuments/{sanitizedEmail}/`
- Save/load/delete nursing notes
- Search/filter by patient name or note type
- Modal UI with `historyModal`

### 3. Direct Messages
- Firebase path: `/directMessages/{conversationId}/`
- Tabbed interface (Group/Direct) in chat widget
- Purple badge for DM notifications
- Real-time updates with `setupDMListener()`
- Conversation ID: sorted emails with special chars replaced

### 4. Lock Screen Button
- Blue button (LOCK) at right side, top: 29%
- Quick session clear without full logout
- Function: `lockScreen()`

### 5. Terms Agreement
- Moved from login to registration only
- Checkbox ID: `regTermsAgree` (required)

## Floating Button Positions (right side)
- LOGOUT: 20%
- LOCK: 29%
- PHRASES: 40%
- FEEDBACK: 51%
- DARK MODE: 62%

## Session Storage Keys
- `bsn9b_auth`: Authentication flag
- `bsn9b_user`: User email
- `bsn9b_displayName`: Display name
- `bsn9b_uid`: Firebase UID
- `bsn9b_theme`: Theme preference (localStorage)

## Firebase References
- `database.ref('chat/messages')` - Group chat
- `database.ref('directMessages')` - DMs
- `database.ref('userDocuments')` - Saved docs
- `database.ref('chat/presence')` - Online users

## Key Functions

### Dark Mode
- `initTheme()` - Initialize theme on page load
- `toggleDarkMode()` - Switch themes
- `updateThemeIcon()` - Update button icon

### Document History
- `saveToHistory()` - Save current form to Firebase
- `loadDocumentHistory()` - Fetch saved documents
- `loadDocument(docId)` - Load doc into form
- `deleteDocument(docId)` - Remove document
- `sanitizeEmail(email)` - Convert email to Firebase-safe path

### Direct Messages
- `getConversationId(email1, email2)` - Generate sorted conversation ID
- `switchChatMode(mode)` - Toggle group/dm view
- `startDMConversation(partnerName)` - Open DM with user
- `sendDM(event)` - Send direct message
- `loadDMConversations()` - Fetch DM list
- `setupDMListener()` - Real-time DM notifications

### Session
- `logout()` - Full logout with Firebase signOut
- `lockScreen()` - Quick lock (session clear only)

## Error Handling
- All async functions have try-catch blocks
- Null checks on DOM elements and Firebase data
- Optional chaining for nested properties
- XSS protection via HTML escaping in messages
