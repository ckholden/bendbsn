/* =========================================================
   BendBSN Shared Header Logic
   Auto-injects canonical header if not already present.
   Ensures logo href is correct on every page.
   Include this script before </body> on every page.

   Also provides:
   - showConfirmModal(title, message, onConfirm, options)
   - showPromptModal(title, message, onSubmit, options)
   - Offline detection banner
   ========================================================= */

(function () {
    'use strict';

    // ── Header injection ──────────────────────────────────
    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    var logoHref = isLoginPage ? '/' : '/home/';

    var existing = document.querySelector('header.site-header');

    if (existing) {
        var link = existing.querySelector('.logo-link');
        if (link) link.setAttribute('href', logoHref);
    } else {
        var header = document.createElement('header');
        header.className = 'site-header';
        header.innerHTML =
            '<a href="' + logoHref + '" class="logo-link">' +
                '<img src="/logo-dark.svg" alt="BendBSN" class="site-logo">' +
            '</a>';

        var root = document.getElementById('header-root');
        if (root) {
            root.appendChild(header);
        } else {
            document.body.insertBefore(header, document.body.firstChild);
        }
    }

    // ── Hamburger Sidebar Toggle (tablet <900px) ─────────
    if (!isLoginPage) {
        var sidebar = document.querySelector('.clx-sidebar');
        if (sidebar) {
            // Create backdrop
            var backdrop = document.createElement('div');
            backdrop.className = 'clx-sidebar-backdrop';
            document.body.appendChild(backdrop);

            // Create hamburger button
            var hamburger = document.createElement('button');
            hamburger.className = 'clx-hamburger';
            hamburger.setAttribute('aria-label', 'Open navigation');
            hamburger.innerHTML = '&#9776;'; // ☰
            var hdr = document.querySelector('.site-header');
            if (hdr) {
                // Insert after logo, before other elements
                var logoLink = hdr.querySelector('.logo-link');
                if (logoLink && logoLink.nextSibling) {
                    hdr.insertBefore(hamburger, logoLink);
                } else {
                    hdr.appendChild(hamburger);
                }
            }

            function openMobileSidebar() {
                sidebar.classList.add('mobile-open');
                backdrop.classList.add('visible');
                hamburger.innerHTML = '&times;'; // ×
                hamburger.setAttribute('aria-label', 'Close navigation');
            }

            function closeMobileSidebar() {
                sidebar.classList.remove('mobile-open');
                backdrop.classList.remove('visible');
                hamburger.innerHTML = '&#9776;'; // ☰
                hamburger.setAttribute('aria-label', 'Open navigation');
            }

            hamburger.addEventListener('click', function() {
                if (sidebar.classList.contains('mobile-open')) {
                    closeMobileSidebar();
                } else {
                    openMobileSidebar();
                }
            });

            backdrop.addEventListener('click', closeMobileSidebar);

            // Close sidebar when a nav item is clicked
            sidebar.addEventListener('click', function(e) {
                if (e.target.closest('.clx-sidebar-item') && window.innerWidth < 900) {
                    closeMobileSidebar();
                }
            });

            // Expose globally for other scripts
            window.toggleMobileSidebar = function() {
                if (sidebar.classList.contains('mobile-open')) {
                    closeMobileSidebar();
                } else {
                    openMobileSidebar();
                }
            };
            window.closeMobileSidebar = closeMobileSidebar;
        }
    }

    // ── Confirm Modal ─────────────────────────────────────
    // Usage: showConfirmModal('Delete?', 'This cannot be undone.', () => { doDelete(); })
    // Options: { confirmText, cancelText, danger }
    window.showConfirmModal = function (title, message, onConfirm, options) {
        options = options || {};
        var confirmText = options.confirmText || 'Confirm';
        var cancelText = options.cancelText || 'Cancel';
        var danger = options.danger || false;

        // Remove any existing modal
        var old = document.getElementById('bsnConfirmModal');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id = 'bsnConfirmModal';
        overlay.className = 'bsn-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', title);
        overlay.innerHTML =
            '<div class="bsn-confirm-modal">' +
                '<h3>' + escapeModalHtml(title) + '</h3>' +
                '<p>' + escapeModalHtml(message) + '</p>' +
                '<div class="bsn-modal-btns">' +
                    '<button class="bsn-btn-cancel" id="bsnModalCancel">' + escapeModalHtml(cancelText) + '</button>' +
                    '<button class="' + (danger ? 'bsn-btn-danger' : 'bsn-btn-confirm') + '" id="bsnModalConfirm">' + escapeModalHtml(confirmText) + '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var confirmBtn = document.getElementById('bsnModalConfirm');
        var cancelBtn = document.getElementById('bsnModalCancel');

        function close() {
            overlay.remove();
        }

        confirmBtn.addEventListener('click', function () {
            close();
            if (onConfirm) onConfirm();
        });

        cancelBtn.addEventListener('click', close);

        // Close on overlay click
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // Close on Escape
        function onKey(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', onKey);
            }
        }
        document.addEventListener('keydown', onKey);

        // Focus confirm button
        confirmBtn.focus();
    };

    // ── Prompt Modal ──────────────────────────────────────
    // Usage: showPromptModal('Ban User', 'Enter reason:', (value) => { ban(value); }, { defaultValue: 'Rule violation' })
    window.showPromptModal = function (title, message, onSubmit, options) {
        options = options || {};
        var submitText = options.submitText || 'Submit';
        var cancelText = options.cancelText || 'Cancel';
        var defaultValue = options.defaultValue || '';
        var placeholder = options.placeholder || '';

        var old = document.getElementById('bsnConfirmModal');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id = 'bsnConfirmModal';
        overlay.className = 'bsn-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', title);
        overlay.innerHTML =
            '<div class="bsn-confirm-modal">' +
                '<h3>' + escapeModalHtml(title) + '</h3>' +
                '<p>' + escapeModalHtml(message) + '</p>' +
                '<input type="text" class="bsn-modal-input" id="bsnModalInput" value="' + escapeModalAttr(defaultValue) + '"' +
                    (placeholder ? ' placeholder="' + escapeModalAttr(placeholder) + '"' : '') + '>' +
                '<div class="bsn-modal-btns">' +
                    '<button class="bsn-btn-cancel" id="bsnModalCancel">' + escapeModalHtml(cancelText) + '</button>' +
                    '<button class="bsn-btn-confirm" id="bsnModalConfirm">' + escapeModalHtml(submitText) + '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var input = document.getElementById('bsnModalInput');
        var confirmBtn = document.getElementById('bsnModalConfirm');
        var cancelBtn = document.getElementById('bsnModalCancel');

        function close() {
            overlay.remove();
        }

        confirmBtn.addEventListener('click', function () {
            var val = input.value;
            close();
            if (onSubmit) onSubmit(val);
        });

        cancelBtn.addEventListener('click', close);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // Enter key submits
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var val = input.value;
                close();
                if (onSubmit) onSubmit(val);
            }
        });

        function onKey(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', onKey);
            }
        }
        document.addEventListener('keydown', onKey);

        // Focus and select input
        input.focus();
        input.select();
    };

    // ── HTML escaping helpers ─────────────────────────────
    function escapeModalHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function escapeModalAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Offline Detection Banner ──────────────────────────
    var offlineBanner = document.createElement('div');
    offlineBanner.className = 'bsn-offline-banner';
    offlineBanner.id = 'bsnOfflineBanner';
    offlineBanner.textContent = "You're offline — changes may not save";
    document.body.insertBefore(offlineBanner, document.body.firstChild);

    function updateOnlineStatus() {
        if (!navigator.onLine) {
            offlineBanner.classList.add('visible');
        } else {
            if (offlineBanner.classList.contains('visible')) {
                offlineBanner.classList.remove('visible');
                // Show "back online" toast if showToast exists on the page
                if (typeof showToast === 'function') {
                    showToast('Back online', 'success', 3000);
                }
            }
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check initial state
    if (!navigator.onLine) {
        offlineBanner.classList.add('visible');
    }

    // ========== ONLINE USER COUNT ==========
    // Reuse existing #onlineCount element (home/chat pages) or inject a new chip
    var siteHeader = document.querySelector('.site-header');
    var targetCountEl = document.getElementById('onlineCount');

    if (siteHeader && !targetCountEl && !isLoginPage) {
        targetCountEl = document.createElement('div');
        targetCountEl.className = 'online-count';
        targetCountEl.id = 'bsnOnlineCount';
        targetCountEl.title = 'Click to see who\'s online';
        targetCountEl.innerHTML = '<span class="online-dot"></span><span class="online-count-text">0 online</span>';
        targetCountEl.style.display = 'none';

        var headerActions = siteHeader.querySelector('.header-actions');
        if (headerActions) {
            siteHeader.insertBefore(targetCountEl, headerActions);
        } else {
            siteHeader.appendChild(targetCountEl);
        }

        targetCountEl.addEventListener('click', function() {
            if (typeof toggleUserListPanel === 'function') {
                toggleUserListPanel();
            } else if (typeof toggleUserList === 'function') {
                toggleUserList();
            } else if (window.location.pathname !== '/chat/' && window.location.pathname !== '/chat/index.html') {
                window.open('/chat/', '_blank');
            }
        });
    }

    window.updateOnlineCount = function(count, users) {
        var el = document.getElementById('bsnOnlineCount') || document.getElementById('onlineCount');
        if (!el) return;
        if (count > 0) {
            el.style.display = 'flex';
            var countText = el.querySelector('.online-count-text') || el.querySelector('#onlineCountText');
            if (countText) countText.textContent = count === 1 ? '1 online' : count + ' online';
            if (users && users.length > 0) {
                var names = users.slice(0, 10).join(', ');
                if (users.length > 10) names += ', +' + (users.length - 10) + ' more';
                el.title = 'Online: ' + names;
            }
        } else {
            el.style.display = 'none';
        }
    };

    // ── Versioned Onboarding Modal ────────────────────────
    var CURRENT_ONBOARDING_VERSION = '3.0-sim-emr';

    function initOnboarding() {
        // Skip on login page
        if (isLoginPage) return;
        // Skip if user has already seen this version
        if (localStorage.getItem('bendbsn_onboarding_version') === CURRENT_ONBOARDING_VERSION) return;
        // Skip if user is already on the EMR page (they've discovered it)
        if (location.pathname.indexOf('/emr') === 0) {
            localStorage.setItem('bendbsn_onboarding_version', CURRENT_ONBOARDING_VERSION);
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'bsnOnboardingOverlay';
        overlay.className = 'bsn-onboarding-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bsnOnboardTitle');

        overlay.innerHTML =
            '<div class="bsn-onboarding-modal">' +
                '<h2 class="bsn-onboarding-title" id="bsnOnboardTitle">🏥 New in BendBSN: Sim EMR</h2>' +
                '<p style="font-size:14px;color:var(--clx-text-secondary,#4a5568);margin:0 0 12px;">A full simulation EMR for practicing realistic clinical workflows \u2014 you can do everything you would on a real shift, with fictional patients.</p>' +
                '<ul class="bsn-onboarding-list">' +
                    '<li><strong>Place &amp; acknowledge orders</strong> \u2014 medications, consults, labs, diet, activity, and more (with allergy checking).</li>' +
                    '<li><strong>Practice the full lifecycle</strong> \u2014 ED arrivals, triage, admits, transfers (with charge-nurse acceptance), and discharge.</li>' +
                    '<li><strong>Document realistically</strong> \u2014 SOAP / SBAR / Narrative notes with role tagging, embedded screening tools (PHQ-9, GAD-7, Morse, Braden).</li>' +
                    '<li><strong>5 Rights med admin</strong> with allergy cross-reactivity checking (PCN \u2192 cephalosporins, ASA \u2192 NSAIDs, etc.).</li>' +
                    '<li><strong>Care team &amp; LDAs</strong> \u2014 assign yourself as Primary RN, track lines/drains/airways with site checks.</li>' +
                    '<li><strong>5 scenarios to load</strong> \u2014 Quiet Day, ED Surge, Night Shift, Med-Surg Steady, Empty Hospital.</li>' +
                '</ul>' +
                '<div class="bsn-onboarding-btns">' +
                    '<button class="bsn-onboarding-dismiss" id="bsnOnboardDismiss">Maybe later</button>' +
                    '<button class="bsn-onboarding-primary" id="bsnOnboardExplore">Open Sim EMR →</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        function dismiss() {
            localStorage.setItem('bendbsn_onboarding_version', CURRENT_ONBOARDING_VERSION);
            overlay.remove();
            document.removeEventListener('keydown', onKey);
        }

        document.getElementById('bsnOnboardDismiss').addEventListener('click', dismiss);

        document.getElementById('bsnOnboardExplore').addEventListener('click', function () {
            dismiss();
            window.location.href = '/emr/';
        });

        // Close on backdrop click
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) dismiss();
        });

        // Close on Escape
        function onKey(e) {
            if (e.key === 'Escape') dismiss();
        }
        document.addEventListener('keydown', onKey);

        // Focus primary button
        document.getElementById('bsnOnboardExplore').focus();
    }

    // Phase 3B.1.6: re-enabled to announce the new Sim EMR feature
    // 2026-04-17: disabled per user request — was showing repeatedly for some
    // users (likely browser localStorage being cleared). Leave function defined
    // above so it can be re-enabled later if we wire up Firebase-profile
    // persistence instead of localStorage for the dismissal flag.
    // initOnboarding();

})();

/* =========================================================
   THEME SYSTEM (7 themes)
   ========================================================= */
window._bsnDb  = null;
window._bsnUid = null;

window.getTheme = function() {
    return document.documentElement.getAttribute('data-theme') || 'light';
};

window.setTheme = function(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('bendbsn_theme', name);
    // Sync to Firebase if available
    if (window._bsnDb && window._bsnUid) {
        try { window._bsnDb.ref('userProfiles/' + window._bsnUid + '/theme').set(name); } catch(e) {}
    }
    // Close picker + backdrop
    var picker = document.getElementById('bsnThemePicker');
    var backdrop = document.getElementById('bsnThemeBackdrop');
    if (picker)   picker.style.display   = 'none';
    if (backdrop) backdrop.style.display = 'none';
    // Update sidebar icon (sidebar-style pages)
    var sidebarIcon = document.getElementById('sidebarThemeIcon');
    if (sidebarIcon) sidebarIcon.textContent = name === 'dark' ? '🌙' : '🎨';
    // Update header icon (chat/ai-style pages)
    var hIcon = document.getElementById('themeMenuIcon');
    var hText = document.getElementById('themeMenuText');
    if (hIcon) hIcon.textContent = name === 'dark' ? '🌙' : '🎨';
    if (hText) hText.textContent = name === 'dark' ? 'Dark Mode' : 'Theme';
    // Sync active state in picker
    document.querySelectorAll('.bsn-theme-opt').forEach(function(opt) {
        opt.classList.toggle('active', opt.dataset.theme === name);
    });
};

// Called by each page after Firebase auth resolves — syncs theme across devices
window.initThemeSync = function(db, uid) {
    if (!db || !uid) return;
    window._bsnDb  = db;
    window._bsnUid = uid;
    db.ref('userProfiles/' + uid + '/theme').once('value', function(snap) {
        var fbTheme = snap.val();
        if (fbTheme) {
            // Firebase wins — apply saved theme
            window.setTheme(fbTheme);
        } else {
            // First time: push current local theme to Firebase (if non-default)
            var cur = window.getTheme();
            if (cur !== 'light') db.ref('userProfiles/' + uid + '/theme').set(cur);
        }
    });
};

window.toggleThemePicker = function() {
    var picker   = document.getElementById('bsnThemePicker');
    var backdrop = document.getElementById('bsnThemeBackdrop');
    if (!picker) return;
    var open = picker.style.display === 'block';
    picker.style.display   = open ? 'none' : 'block';
    if (backdrop) backdrop.style.display = open ? 'none' : 'block';
    if (!open) {
        document.querySelectorAll('.bsn-theme-opt').forEach(function(opt) {
            opt.classList.toggle('active', opt.dataset.theme === window.getTheme());
        });
    }
};

// Override per-page binary toggle — now opens picker
window.toggleDarkMode = function() { window.toggleThemePicker(); };

(function injectThemePicker() {
    // Support both sidebar-style (.clx-sidebar-item) and header-style (.header-btn) pages
    var themeBtn = document.querySelector('.clx-sidebar-item[onclick*="toggleDarkMode"]') ||
                   document.querySelector('.header-actions button[onclick*="toggleDarkMode"]');
    if (!themeBtn) return;

    themeBtn.id = 'bsnThemeBtn';

    // Sidebar pages: update the label text ("Dark Mode" → "Theme")
    var sidebarLabel = themeBtn.querySelector('.clx-sidebar-label');
    if (sidebarLabel) sidebarLabel.textContent = 'Theme';

    // Backdrop (click-outside-to-close)
    var backdrop = document.createElement('div');
    backdrop.id = 'bsnThemeBackdrop';
    backdrop.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2400;background:rgba(0,0,0,0.3);';
    backdrop.onclick = function() { window.toggleThemePicker(); };
    document.body.appendChild(backdrop);

    // Picker overlay
    var picker = document.createElement('div');
    picker.id = 'bsnThemePicker';
    picker.innerHTML =
        '<div class="bsn-theme-picker-label">Neutral</div>' +
        '<div class="bsn-theme-grid bsn-theme-grid-3">' +
        '<button class="bsn-theme-opt" data-theme="light"  onclick="window.setTheme(\'light\')"><span class="bsn-swatch" style="background:#e8edf2;"></span>Light</button>' +
        '<button class="bsn-theme-opt" data-theme="warm"   onclick="window.setTheme(\'warm\')"><span class="bsn-swatch" style="background:#f2ece0;"></span>Warm</button>' +
        '<button class="bsn-theme-opt" data-theme="dark"   onclick="window.setTheme(\'dark\')"><span class="bsn-swatch" style="background:#161b22;border-color:rgba(255,255,255,0.2);"></span>Dark</button>' +
        '</div>' +
        '<div class="bsn-theme-divider"></div>' +
        '<div class="bsn-theme-picker-label">Colored</div>' +
        '<div class="bsn-theme-grid">' +
        '<button class="bsn-theme-opt" data-theme="forest" onclick="window.setTheme(\'forest\')"><span class="bsn-swatch" style="background:#e8f0e8;"></span>Forest</button>' +
        '<button class="bsn-theme-opt" data-theme="ocean"  onclick="window.setTheme(\'ocean\')"><span class="bsn-swatch" style="background:#e8f0f5;"></span>Ocean</button>' +
        '<button class="bsn-theme-opt" data-theme="sunset" onclick="window.setTheme(\'sunset\')"><span class="bsn-swatch" style="background:#ece8f5;"></span>Sunset</button>' +
        '<button class="bsn-theme-opt" data-theme="rose"   onclick="window.setTheme(\'rose\')"><span class="bsn-swatch" style="background:#f5e8eb;"></span>Rose</button>' +
        '</div>';
    document.body.appendChild(picker);

    // Sync icon + active state to current theme
    window.setTheme(window.getTheme());
})();

// ── Chat Unread Badge (sidebar + hamburger + mobile-nav) ──────────────────
// Three placements for the same chat-unread count, each scoped to its
// viewport via CSS:
//   • Sidebar Chat icon — visible >=900px (desktop sidebar always shown)
//   • Hamburger button   — visible 481-899px (sidebar collapsed to drawer)
//   • Mobile-nav Chat    — visible <=480px (bottom-nav phone layout)
// All three read the same localStorage key (bendbsn_chat_unread) and update
// in real time via the storage event when the chat tab updates the count.
(function initChatUnreadBadges() {
    // Don't show any badge when the user is already on the chat page
    if (location.pathname.startsWith('/chat')) return;

    var badges = []; // collected (badgeEl, anchorEl) pairs we'll keep in sync

    // 1. Sidebar Chat icon (desktop)
    var chatLink = document.querySelector('a[data-page="chat"]');
    if (chatLink) {
        var sidebarIcon = chatLink.querySelector('.clx-sidebar-icon');
        if (sidebarIcon) {
            sidebarIcon.style.position = 'relative';
            var sb = makeBadge('bsnChatSidebarBadge', 'bsn-chat-sidebar-badge');
            sidebarIcon.appendChild(sb);
            badges.push(sb);
        }
    }

    // 2. Hamburger button (tablet) — appended to the button itself
    var hamburger = document.getElementById('hamburgerBtn') || document.querySelector('.clx-hamburger');
    if (hamburger) {
        var hb = makeBadge('bsnChatHamburgerBadge', 'bsn-chat-hamburger-badge');
        hamburger.appendChild(hb);
        badges.push(hb);
    }

    // 3. Mobile-nav Chat link (phone) — appended to the bottom-nav anchor
    var mobChat = document.querySelector('.clx-mobile-nav a[href^="/chat"], .clx-mobile-nav-item[href^="/chat"]');
    if (mobChat) {
        var mb = makeBadge('bsnChatMobnavBadge', 'bsn-chat-mobnav-badge');
        mobChat.appendChild(mb);
        badges.push(mb);
    }

    function makeBadge(id, cls) {
        var b = document.createElement('span');
        b.id = id;
        b.className = cls;
        return b;
    }

    function updateAll() {
        var val = parseInt(localStorage.getItem('bendbsn_chat_unread') || '0', 10);
        var text = val > 99 ? '99+' : String(val);
        for (var i = 0; i < badges.length; i++) {
            badges[i].textContent = text;
            badges[i].style.display = val > 0 ? 'flex' : 'none';
        }
    }

    updateAll();
    // Real-time cross-tab updates from /chat/ writing to the same key
    window.addEventListener('storage', function (e) {
        if (e.key === 'bendbsn_chat_unread') updateAll();
    });
})();

// ===== IT TICKET / FEEDBACK MODAL =====
(function () {
    'use strict';

    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    if (isLoginPage) return;

    // ── Inject EmailJS if not already loaded ──────────────
    if (!window.emailjs) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        document.head.appendChild(s);
    }

    // ── Inject modal HTML ─────────────────────────────────
    var modalHtml = '<div id="itTicketModal" class="bsn-modal-overlay" style="display:none;z-index:9500;" onclick="if(event.target===this)closeTicketModal()">'
        + '<div class="bsn-confirm-modal" style="max-width:480px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
        + '<h2 style="font-size:16px;font-weight:700;margin:0;">Submit Feedback / Report</h2>'
        + '<button onclick="closeTicketModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--clx-text-muted,#718096);line-height:1;">&times;</button>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">'
        + '<div>'
        + '<label style="font-size:11px;font-weight:700;color:var(--clx-text-secondary,#a0aec0);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Category</label>'
        + '<select id="itTicketCategory" style="width:100%;padding:8px 10px;border:1px solid var(--clx-border,rgba(255,255,255,0.12));border-radius:6px;font-size:13px;background:var(--clx-bg-surface,#1a2744);color:var(--clx-text-primary,#fff);font-family:inherit;">'
        + '<option value="Bug Report">Bug Report</option>'
        + '<option value="Feature Request">Feature Request</option>'
        + '<option value="General Feedback">General Feedback</option>'
        + '</select>'
        + '</div>'
        + '<div>'
        + '<label style="font-size:11px;font-weight:700;color:var(--clx-text-secondary,#a0aec0);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Priority</label>'
        + '<select id="itTicketPriority" style="width:100%;padding:8px 10px;border:1px solid var(--clx-border,rgba(255,255,255,0.12));border-radius:6px;font-size:13px;background:var(--clx-bg-surface,#1a2744);color:var(--clx-text-primary,#fff);font-family:inherit;">'
        + '<option value="Low">Low</option>'
        + '<option value="Medium" selected>Medium</option>'
        + '<option value="High">High</option>'
        + '</select>'
        + '</div>'
        + '</div>'
        + '<div style="margin-bottom:16px;">'
        + '<label style="font-size:11px;font-weight:700;color:var(--clx-text-secondary,#a0aec0);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Message</label>'
        + '<textarea id="itTicketMessage" rows="5" placeholder="Describe the issue or idea in detail..." style="width:100%;padding:8px 10px;border:1px solid var(--clx-border,rgba(255,255,255,0.12));border-radius:6px;font-size:13px;background:var(--clx-bg-surface,#1a2744);color:var(--clx-text-primary,#fff);resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>'
        + '</div>'
        + '<div class="bsn-modal-btns">'
        + '<button class="bsn-btn-cancel" onclick="closeTicketModal()">Cancel</button>'
        + '<button class="bsn-btn-confirm" onclick="submitTicket()" style="background:#3b82f6;border-color:#3b82f6;">Submit</button>'
        + '</div>'
        + '</div>'
        + '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    document.body.appendChild(wrapper.firstChild);

    // ── ESC key closes modal ──────────────────────────────
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var modal = document.getElementById('itTicketModal');
            if (modal && modal.style.display !== 'none') closeTicketModal();
        }
    });

    // ── Global functions ──────────────────────────────────
    window.openTicketModal = function () {
        var modal = document.getElementById('itTicketModal');
        if (!modal) return;
        var cat = document.getElementById('itTicketCategory');
        var pri = document.getElementById('itTicketPriority');
        var msg = document.getElementById('itTicketMessage');
        if (cat) cat.value = 'Bug Report';
        if (pri) pri.value = 'Medium';
        if (msg) msg.value = '';
        modal.style.display = 'flex';
        if (msg) setTimeout(function () { msg.focus(); }, 50);
    };

    window.closeTicketModal = function () {
        var modal = document.getElementById('itTicketModal');
        if (modal) modal.style.display = 'none';
    };

    window.submitTicket = async function () {
        var category = (document.getElementById('itTicketCategory') || {}).value || '';
        var priority = (document.getElementById('itTicketPriority') || {}).value || '';
        var message = ((document.getElementById('itTicketMessage') || {}).value || '').trim();

        if (!message) {
            if (typeof showToast === 'function') {
                showToast('Please describe the issue or idea before submitting.', 'warning');
            }
            return;
        }

        var ticket = {
            uid: localStorage.getItem('bendbsn_uid') || '',
            name: localStorage.getItem('bendbsn_displayName') || '',
            email: localStorage.getItem('bendbsn_user') || '',
            category: category,
            priority: priority,
            message: message,
            timestamp: Date.now(),
            status: 'open',
            phase: 1,
            adminNotes: '',
            emailNotified: false
        };

        try {
            var ref = firebase.database().ref('appTickets').push();
            await ref.set(ticket);
            var ticketKey = ref.key;

            // Try EmailJS notification — graceful failure
            try {
                if (window.emailjs) {
                    var emailParams = {
                        to_email: 'christiankholden@gmail.com',
                        subject: '[BendBSN Ticket] ' + category + ' \u2014 ' + priority + ' priority',
                        message: ticket.name + ' submitted a ' + category + ':\n\n' + message + '\n\nPriority: ' + priority
                    };
                    await window.emailjs.send('service_2dw80zz', 'template_ty32lyw', emailParams, 'Paf-N3lByYsImp0af');
                    firebase.database().ref('appTickets/' + ticketKey).update({ emailNotified: true });
                }
            } catch (emailErr) {
                console.warn('EmailJS notification failed (non-fatal):', emailErr);
            }

            window.closeTicketModal();
            if (typeof showToast === 'function') {
                showToast('Feedback submitted. Thank you!', 'success');
            }
        } catch (err) {
            console.error('submitTicket error:', err);
            if (typeof showToast === 'function') {
                showToast('Failed to submit ticket. Please try again.', 'error');
            }
        }
    };
})();
// ===== END IT TICKET / FEEDBACK MODAL =====
