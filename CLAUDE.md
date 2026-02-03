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

## Performance & Accessibility Improvements (Jan 2026)

### Script Loading Optimization
- **IMPORTANT**: Firebase SDK scripts must NOT use `defer` - they must load synchronously before inline scripts that use Firebase
- Preconnect hints for Firebase, CDN domains (gstatic.com, jsdelivr.net, cdnjs.cloudflare.com)
- Export libraries (jsPDF, docx, FileSaver) lazy-loaded on demand (~170KB saved)

### Firebase Optimizations
- Listener cleanup on page unload (`cleanupFirebaseListeners()`)
- User list caching in localStorage with 10-minute expiry (`USER_CACHE_KEY`)
- Chat messages limited to last 50 for DOM performance

### Accessibility (WCAG)
- ARIA labels on all interactive elements
- `role="navigation"`, `role="dialog"`, `role="tablist"`, `role="tab"` attributes
- `aria-expanded` for expandable menus
- `aria-live="polite"` for dynamic content (badges, chat messages)
- Keyboard navigation (ESC to close modals)
- Focus management with `:focus-visible` styles

### UI/UX Improvements
- Toast notifications replace all `alert()` calls (`showToast()` function)
- Dark mode CSS for chat widget elements
- Loading states on export buttons (`btn-loading` class)
- Debounced NANDA search (300ms)

### Service Worker (sw.js)
- Versioned cache (`CACHE_VERSION = 'v2'`)
- Stale-while-revalidate for HTML pages
- Automatic old cache cleanup on activation
- Support for `SKIP_WAITING` and `CLEAR_CACHE` messages

---

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

---

## Admin Panel - Community Moderation (Jan 2026)

### Overview
The admin panel (`/admin/index.html`) includes comprehensive community post moderation controls, allowing administrators to manage posts and replies from the Community Hub.

### Firebase Reference
```javascript
const communityPostsRef = database.ref('community/posts');
```

### State Variables
```javascript
let allCommunityPosts = [];  // Cached posts array
let currentPostId = null;     // Currently viewed post in modal
```

### UI Components

#### Quick Stats
- Added "Community Posts" stat box showing total post count (`#statPosts`)

#### Action Bar Buttons
- **Community Stats** (purple) - Opens statistics modal
- **Clear All Posts** (red) - Deletes all posts with double confirmation

#### Community Posts Card
- Spans 2 columns in the grid layout
- Category filter dropdown: All, Announcements, Study Tips, Career, NCLEX, General
- Table columns: Title, Author, Category, Stats (likes/replies), Actions
- Actions per post: View, Pin/Unpin, Delete
- Pinned posts show 📌 icon and appear first

#### Post Detail Modal (`#postDetailModal`)
- Full post content with category badge
- Pin status indicator
- Author name and timestamp
- Pin/Unpin button
- Delete Post button
- Replies list with individual delete buttons

#### Community Stats Modal (`#communityStatsModal`)
- Total posts, replies, likes, pinned count
- Top contributor (name + post count)
- Posts by category with progress bars

### Admin Functions

| Function | Purpose |
|----------|---------|
| `loadCommunityPosts()` | Fetch all posts, apply filter, render table |
| `viewPostDetail(postId)` | Open modal with full post content |
| `loadPostReplies(postId, replies)` | Render replies in modal |
| `deleteReply(postId, replyId)` | Delete specific reply, refresh view |
| `togglePostPin()` | Pin/unpin post from modal |
| `quickTogglePin(postId, pinned)` | Pin/unpin from list view |
| `deletePostAdmin()` | Delete post from modal |
| `quickDeletePost(postId, title)` | Delete post from list view |
| `clearAllPosts()` | Delete ALL posts (double confirm) |
| `showCommunityStats()` | Open statistics modal |
| `closeCommunityStats()` | Close statistics modal |
| `renderCommunityStats()` | Calculate and display analytics |
| `closePostDetail()` | Close post detail modal |

### Helper Functions

| Function | Purpose |
|----------|---------|
| `getCategoryLabel(cat)` | Get display name for category |
| `getCategoryColor(cat)` | Get color for category badge |
| `formatTimeAgo(timestamp)` | Format relative time (e.g., "2h ago") |
| `escapeHtml(text)` | XSS protection for user content |

### Category Colors
```javascript
{
  'announcements': '#e94560',  // Red/pink
  'study-tips': '#28a745',     // Green
  'career': '#007bff',         // Blue
  'nclex': '#ff9800',          // Orange
  'general': '#6c757d'         // Gray
}
```

### Real-time Updates
```javascript
// In initAdmin()
communityPostsRef.on('value', () => loadCommunityPosts());
```

### Post Sorting Logic
1. Pinned posts first
2. Then by timestamp (newest first)

### Security
- All user content escaped via `escapeHtml()` before rendering
- Delete operations require confirmation
- Clear All requires double confirmation
- Admin password required to access panel

---

## Session Notes (Feb 2026)

### Completed This Session

#### 1. Chat Channels Redesign (Slack-style)
- Replaced dropdown channel selector with sidebar list
- Added per-channel unread badges
- Collapsible "CHANNELS" and "DIRECT MESSAGES" sections
- Visual channel/DM switching
- Files modified: `/app/index.html`

#### 2. Admin Login History Management
- Added "Clear All" button to delete all login history
- Added 🗑️ delete button for individual entries
- Checkbox selection for bulk delete
- Files modified: `/admin/index.html`

#### 3. Login History Bug Fixes
- Fixed race condition: login history write now completes before redirect
- Made `logLoginEvent` async and awaited in login handler
- Added session validation on all pages to prevent corrupted entries from heartbeat
- Files modified: `/index.html`, `/app/index.html`, `/home/index.html`, `/community/index.html`, `/resources/index.html`, `/admin/index.html`

#### 4. PDF/Word Export Date Fix
- Fixed date parsing in `getFormData()` - now correctly parses MM/DD/YYYY format
- Added `noteDateForFilename` for safe filenames (no slashes)
- Fixed `clearForm()` to use `formatDateDisplay()` instead of broken `valueAsDate`
- Files modified: `/app/index.html`

#### 5. Delete User Feature
- Added 🗑️ delete button next to each user in Registered Users
- Deletes from Firebase userProfiles, Google Sheet, and banned list
- Opens Firebase Console link for Auth account deletion
- Files modified: `/admin/index.html`

#### 6. Role Update Without Login
- Modified `updateUserRole()` to work even if user hasn't logged in
- Updates both Firebase profile (if exists) AND Google Sheet
- Files modified: `/admin/index.html`

### Pending / To Test Tomorrow

#### 1. Test Role Update for Ann
- Change Ann's role from "RN Student" to "Instructor"
- Verify toast shows "Role updated to Instructor"

#### 2. Google Apps Script Actions Needed
Add these actions to your Google Apps Script:

**deleteUser action:**
```javascript
if (action === 'deleteUser') {
  var username = e.parameter.username;
  var email = e.parameter.email;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === username || data[i][4] === email) {
      sheet.deleteRow(i + 1);
      return ContentService.createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({success: false, error: 'User not found'}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**updateRole action:**
```javascript
if (action === 'updateRole') {
  var email = e.parameter.email;
  var role = e.parameter.role;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  var data = sheet.getDataRange().getValues();

  var roleColIndex = 6;  // Adjust to your role column (0-indexed)

  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === email) {  // Adjust email column index
      sheet.getRange(i + 1, roleColIndex + 1).setValue(role);
      return ContentService.createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({success: false, error: 'User not found'}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

#### 3. Service Worker Cache
- Current version: `v13`
- If seeing stale code, hard refresh (`Ctrl+Shift+R`) or clear site data

### Key Files Modified This Session
| File | Changes |
|------|---------|
| `/index.html` | Async login event, awaited before redirect |
| `/app/index.html` | Chat sidebar redesign, date fix, session validation |
| `/home/index.html` | Session validation fix |
| `/community/index.html` | Session validation fix |
| `/resources/index.html` | Session validation fix |
| `/admin/index.html` | Login history delete, user delete, role update |
| `/sw.js` | Cache version v13, added login/admin to stale-while-revalidate |

---

## Session Notes (Feb 2, 2026 - Evening)

### Completed Tonight

#### Resources Page Accordion Layout Fix
**Problem:** Resource cards were displaying incorrectly - horizontal layout instead of vertical stacking.

**Root Cause:** CSS class conflict between generic `.collapsible` rule (line ~500) and `.resource-card.collapsible`. The generic rule applied `display: flex`, `justify-content: space-between`, and `:after` chevron to all collapsible elements, including the resource cards.

**Fix Applied:**
1. Added `display: block` to override inherited flex layout
2. Added `cursor: default` so card itself doesn't look clickable
3. Added `.resource-card.collapsible:after { content: none }` to hide duplicate chevron

#### Resources Page UI/UX Improvements
Enhanced the accordion card styling:
- **Spacing:** Added 12px margin between cards
- **Hover effect:** Subtle lift (translateY -2px) with stronger shadow
- **Expanded indicator:** Blue left border when card is open
- **Chevron button:** Pill-shaped background with hover highlight
- **Smooth animations:** max-height transition instead of display:none
- **Tactile feedback:** Scale-down on header click
- **Dark mode:** Matching styles with lighter blue accent
- **Mobile:** Adjusted padding for better touch targets

### Files Modified
| File | Changes |
|------|---------|
| `/resources/index.html` | Accordion CSS fix + UI/UX enhancements |

### Future Improvements to Consider
The accordion looks better but could be refined further:
- Category color-coding (different header gradients per card type?)
- Search/filter highlight animation
- Keyboard navigation (arrow keys to move between cards)
- "Expand all / Collapse all" button
- Remember expanded state in localStorage
- Subtle entry animation when page loads
- Icon variations instead of just emoji
