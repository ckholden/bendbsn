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
- PWA enabled (manifest.json, sw.js)

## Site Structure
- `/` - Login page (index.html)
- `/home/` - Home dashboard with navigation
- `/app/` - Main documentation generator
- `/resources/` - Clinical references, calculators, drug lookup
- `/community/` - Community hub with posts, announcements

## Key Features Implemented (Jan 2025)

### 1. Bottom Toolbar Navigation
- Fixed bottom navigation bar on all pages
- Items: Home, Docs, Community, More
- "More" menu expands upward with: Dark Mode, Lock, Feedback, Logout
- Smart Phrases in More menu (app page only)
- Mobile-first design with proper touch targets

### 2. Dark Mode
- CSS variables in `:root` and `[data-theme="dark"]`
- Toggle via More menu
- Persists in localStorage (`bsn9b_theme`)

### 3. Document History
- Firebase path: `/userDocuments/{sanitizedEmail}/`
- Save/load/delete nursing notes
- Search/filter by patient name or note type

### 4. Direct Messages
- Firebase path: `/directMessages/{conversationId}/`
- Tabbed interface (Group/Direct) in chat widget
- Purple badge for DM notifications
- Real-time updates

### 5. Community Hub
- Firebase path: `/community/posts/`
- Categories: Announcements, Study Tips, Career, NCLEX
- Create/view posts with likes
- Pinned posts support

### 6. Clinical Toolkit (Resources page)
- Pediatric vital signs reference
- Pain assessment scales (FLACC, NRS)
- Glasgow Coma Scale calculator
- APGAR Score calculator
- SBAR Communication template
- Head-to-Toe assessment checklist

### 7. PWA Support
- manifest.json for app installation
- Service Worker (sw.js) for offline caching
- Apple touch icon support
- Theme color meta tags

## UI Components

### Bottom Toolbar
```css
.bottom-toolbar - Fixed bottom nav
.toolbar-item - Nav item (link or button)
.more-menu - Expandable menu
.more-menu-item - Menu action button
```

### Chat/AI Widgets
- Position: `bottom: 80px` (above toolbar)
- z-index: 999 (below toolbar's 1000)
- Chat toggle: bottom-right
- AI toggle: bottom-left

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
- `database.ref('community/posts')` - Community posts
- `database.ref('announcements')` - Alert/FYI banners

## Key Functions

### Navigation
- `toggleMoreMenu()` - Show/hide More menu
- Close on outside click

### Dark Mode
- `initTheme()` - Initialize theme on page load
- `toggleDarkMode()` - Switch themes
- `updateThemeIcon()` - Update menu icon

### Document History
- `saveToHistory()` - Save current form to Firebase
- `loadDocumentHistory()` - Fetch saved documents
- `loadDocument(docId)` - Load doc into form
- `deleteDocument(docId)` - Remove document

### Direct Messages
- `getConversationId(email1, email2)` - Generate conversation ID
- `switchChatMode(mode)` - Toggle group/dm view
- `startDMConversation(partnerName)` - Open DM
- `sendDM(event)` - Send direct message

### Community
- `createPost(event)` - Create new post
- `filterCategory(category)` - Filter by category
- `likePost(postId)` - Like a post
- `renderPosts()` - Render post feed

### Clinical Tools
- `calculateAPGAR()` - Calculate APGAR score
- `calculateDripRate()` - IV drip calculator
- `calculateDosage()` - Medication dosage calculator
- `calculateWeightDose()` - Weight-based dosing

### Session
- `logout()` - Full logout with Firebase signOut
- `lockScreen()` - Quick lock (session clear only)

## Error Handling
- All async functions have try-catch blocks
- Null checks on DOM elements and Firebase data
- Optional chaining for nested properties
- XSS protection via HTML escaping in messages

## Chat System Architecture (Jan 2025 - IMPORTANT)

### Critical: Inline JavaScript Only
The chat system MUST use **inline JavaScript** on each page. External `chat.js` causes timing/initialization issues due to IIFE pattern and Firebase auth checks.

**Working Architecture:**
- `/app/index.html` - Has ~1,400 lines of inline chat JS (the reference implementation)
- `/home/index.html` - Copy of inline chat JS
- `/community/index.html` - Copy of inline chat JS
- `/resources/index.html` - Copy of inline chat JS (with prefixed variables)

### Required HTML Elements (must exist before script runs)
```html
<!-- Alert/FYI Banners -->
<div id="alertBanner">...<span id="alertText"></span></div>
<div id="fyiBanner">...<span id="fyiText"></span></div>

<!-- Chat Widget -->
<div id="chatWidget">
  <button id="chatToggle" onclick="toggleChat()">💬</button>
  <span id="chatBadge"></span>
  <span id="dmBadge"></span>
  <div id="chatBox">
    <div id="chatTitle"></div>
    <div id="onlineCount"></div>
    <div id="userList"><div id="userListNames"></div></div>
    <div id="groupChatView">
      <div id="chatMessages"></div>
      <div id="mentionDropdown"></div>
      <input id="chatInput">
    </div>
    <div id="dmView">...</div>
  </div>
</div>
```

### Variable Naming for /resources/
The resources page has existing `currentUsername` variable. Chat code uses:
- `chatCurrentUsername` instead of `currentUsername`
- `chatDisplayName` instead of `displayName`
- `fetchAllUsersForChat()` instead of `fetchAllUsers()`

### Chat Code Structure (in order)
1. Firebase refs: `chatRef`, `presenceRef`, `bannedRef`, `announcementsRef`
2. `setupAnnouncementListener()` - Alert/FYI banners
3. Auth state handler and ban checks
4. Chat state variables: `chatOpen`, `unreadCount`, `lastReadTimestamp`
5. Notification functions: `playNotificationSound()`, `toggleChatSound()`, etc.
6. `toggleChat()` - Open/close chat widget
7. `sendMessage(event)` - Send group chat message (includes admin commands)
8. Utility functions: `formatTime()`, `formatMessageWithMentions()`, `scrollToBottom()`
9. `setupChatListener()` - Main message rendering
10. Connection monitoring
11. DM functions (~480 lines): All direct message functionality
12. Presence tracking: Online users, `toggleUserList()`
13. @Mention autocomplete: `fetchAllUsers()`, `showMentionDropdown()`, event listeners

### Service Worker Caching Issue
After deploying updates, users may see old cached code. Solutions:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Unregister service worker: DevTools → Application → Service Workers → Unregister
3. Clear browser cache

### Debug Logging (removed Jan 2025)
Debug logs were removed from production. To re-add for troubleshooting, add these console.log statements with 🔥 emoji prefix:
- After `// ========== CHAT SYSTEM`: `console.log('🔥 CHAT SYSTEM INIT START');`
- In `toggleChat()`: `console.log('🔥 toggleChat called');` and `console.log('🔥 chatBox found:', !!chatBox);`
- After chatInput/mentionDropdown declarations: `console.log('🔥 chatInput found:', !!chatInput);`
- Before `// ========== END CHAT SYSTEM`: `console.log('🔥 CHAT SYSTEM INIT COMPLETE');`

**Note:** Null checks on `chatInput` event listeners were kept for safety.

### Admin Commands (in sendMessage)
Only for admin emails (`christiankholden@gmail.com`, `holdenc`):
- `alert/message` - Set red alert banner
- `alert/clear` - Clear alert banner
- `fyi/message` - Set yellow FYI banner
- `fyi/clear` - Clear FYI banner
- `chat/clear` - Clear all chat messages
