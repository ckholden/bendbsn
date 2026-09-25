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

    // ── Force-logout for stale sessions ────────────────────
    // Bump FORCE_LOGOUT_BEFORE to a current Unix-ms timestamp whenever a
    // sitewide forced re-login is needed (e.g. after a major data migration
    // so stale localStorage / profile snapshots get blown away). Any client
    // whose stored bendbsn_login_at is older — or missing entirely — gets
    // signed out and bounced to the login page.
    var FORCE_LOGOUT_BEFORE = 1714010000000;  // 2026-04-22 sitewide refresh
    try {
        var isAuthed = localStorage.getItem('bendbsn_auth') === 'true';
        var loginAt  = parseInt(localStorage.getItem('bendbsn_login_at') || '0', 10);
        var loginPath = location.pathname === '/' || location.pathname === '/index.html';
        if (isAuthed && !loginPath && loginAt < FORCE_LOGOUT_BEFORE) {
            // Clear auth + ephemeral caches (keep synced data like phrases —
            // those re-pull from Firebase on next login).
            ['bendbsn_auth', 'bendbsn_user', 'bendbsn_displayName', 'bendbsn_uid',
             'bendbsn_role_v2', 'bendbsn_login_at'].forEach(function (k) {
                try { localStorage.removeItem(k); } catch (e) {}
            });
            // Wipe per-note draft autosaves so stale role/year never resurrects.
            try {
                Object.keys(localStorage)
                    .filter(function (k) { return k.indexOf('bendbsn_draft_') === 0; })
                    .forEach(function (k) { localStorage.removeItem(k); });
            } catch (e) {}
            // Sign out of Firebase Auth too, if available.
            if (window.firebase && firebase.apps && firebase.apps.length) {
                try { firebase.auth().signOut(); } catch (e) {}
            }
            // Friendly notice on the login page.
            try { sessionStorage.setItem('bendbsn_force_logout', '1'); } catch (e) {}
            location.replace('/');
            return;
        }
    } catch (e) { /* never block page render on the check */ }

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

    // close() of the confirm/prompt modal that is currently open, if any.
    // Replacing a modal goes through it so the old Escape listener is removed.
    var _bsnModalClose = null;

    // Close any open confirm/prompt modal; returns the element that had focus
    // before it opened, so a replacement modal can hand focus back there.
    function replaceOpenModal() {
        var prev = document.activeElement;
        if (_bsnModalClose) prev = _bsnModalClose(true) || prev;
        var old = document.getElementById('bsnConfirmModal');
        if (old) old.remove();
        return prev;
    }

    function restoreFocus(el) {
        if (el && el !== document.body && el.focus && document.contains(el)) {
            try { el.focus({ preventScroll: true }); } catch (e) {}
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
        var prev = replaceOpenModal();

        var overlay = document.createElement('div');
        overlay.id = 'bsnConfirmModal';
        overlay.className = 'bsn-modal-overlay';
        overlay.setAttribute('role', danger ? 'alertdialog' : 'dialog');
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

        // replacing = another modal is taking over; it restores focus itself
        function close(replacing) {
            if (_bsnModalClose === close) _bsnModalClose = null;
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            if (replacing !== true) restoreFocus(prev);
            return prev;
        }
        _bsnModalClose = close;

        confirmBtn.addEventListener('click', function () {
            close();
            if (onConfirm) onConfirm();
        });

        cancelBtn.addEventListener('click', function () { close(); });

        // Close on overlay click
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // Close on Escape
        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', onKey);

        // Destructive dialogs focus Cancel so a reflexive Enter doesn't delete
        (danger ? cancelBtn : confirmBtn).focus();
    };

    // ── Prompt Modal ──────────────────────────────────────
    // Usage: showPromptModal('Ban User', 'Enter reason:', (value) => { ban(value); }, { defaultValue: 'Rule violation' })
    window.showPromptModal = function (title, message, onSubmit, options) {
        options = options || {};
        var submitText = options.submitText || 'Submit';
        var cancelText = options.cancelText || 'Cancel';
        var defaultValue = options.defaultValue || '';
        var placeholder = options.placeholder || '';

        var prev = replaceOpenModal();

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

        function close(replacing) {
            if (_bsnModalClose === close) _bsnModalClose = null;
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            if (replacing !== true) restoreFocus(prev);
            return prev;
        }
        _bsnModalClose = close;

        confirmBtn.addEventListener('click', function () {
            var val = input.value;
            close();
            if (onSubmit) onSubmit(val);
        });

        cancelBtn.addEventListener('click', function () { close(); });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // Enter key submits
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                // Swallow the keypress: focus returns to the opener in close(),
                // and an Enter keypress landing on that button would click it
                // and reopen this prompt.
                e.preventDefault();
                var val = input.value;
                close();
                if (onSubmit) onSubmit(val);
            }
        });

        function onKey(e) {
            if (e.key === 'Escape') close();
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
    // Fall back to the stored preference: on pages that load header.js before
    // their own initTheme(), data-theme is not set yet.
    var t = document.documentElement.getAttribute('data-theme');
    if (!t) { try { t = localStorage.getItem('bendbsn_theme'); } catch (e) {} }
    return t || 'light';
};

window.setTheme = function(name) {
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem('bendbsn_theme', name); } catch (e) {}
    // Sync to Firebase. Pages that never call initThemeSync still save, so
    // the next synced page doesn't revert the change.
    var db = window._bsnDb, uid = window._bsnUid;
    if ((!db || !uid) && window.firebase && firebase.apps && firebase.apps.length &&
        typeof firebase.auth === 'function' && typeof firebase.database === 'function') {
        try {
            var u = firebase.auth().currentUser;
            if (u) { uid = u.uid; db = firebase.database(); }
        } catch (e) {}
    }
    if (db && uid) {
        try { db.ref('userProfiles/' + uid + '/theme').set(name); } catch(e) {}
    }
    // Close picker + backdrop
    var picker = document.getElementById('bsnThemePicker');
    var backdrop = document.getElementById('bsnThemeBackdrop');
    if (picker)   picker.style.display   = 'none';
    if (backdrop) backdrop.style.display = 'none';
    // Update sidebar icon (sidebar-style pages)
    var sidebarIcon = document.getElementById('sidebarThemeIcon');
    if (sidebarIcon) sidebarIcon.textContent = name === 'dark' ? '🌙' : '🎨';
    // Update header icon (header-style pages)
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
    // A page-level `function toggleDarkMode()` declared in a later script
    // replaces the window.toggleDarkMode override above, which left the
    // button as a binary dark/light toggle. Bind the picker directly.
    themeBtn.removeAttribute('onclick');
    themeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.toggleThemePicker();
    });

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

    // Sync icon + active state to the current theme WITHOUT saving it:
    // setTheme() here wrote 'light' over the stored preference on pages
    // whose initTheme() runs after header.js.
    var cur = window.getTheme();
    document.documentElement.setAttribute('data-theme', cur);
    var si = document.getElementById('sidebarThemeIcon');
    if (si) si.textContent = cur === 'dark' ? '🌙' : '🎨';
    var hIcon = document.getElementById('themeMenuIcon');
    var hText = document.getElementById('themeMenuText');
    if (hIcon) hIcon.textContent = cur === 'dark' ? '🌙' : '🎨';
    if (hText) hText.textContent = cur === 'dark' ? 'Dark Mode' : 'Theme';
    document.querySelectorAll('.bsn-theme-opt').forEach(function(o) {
        o.classList.toggle('active', o.dataset.theme === cur);
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
        + '<button class="bsn-btn-confirm" onclick="submitTicket()">Submit</button>'
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

    var _ticketSubmitting = false;
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

        // A second click during the round-trip must not file a duplicate.
        if (_ticketSubmitting) return;

        // The appTickets rule requires uid === auth.uid; localStorage can be
        // stale, so prefer the signed-in Firebase user.
        var authUid = '';
        try {
            var cu = (window.firebase && firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
            if (cu) authUid = cu.uid;
        } catch (e) {}

        var ticket = {
            uid: authUid || localStorage.getItem('bendbsn_uid') || '',
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

        // Set inside the try: every path below reaches the reset after catch.
        var submitBtn = document.querySelector('#itTicketModal .bsn-btn-confirm');
        try {
            _ticketSubmitting = true;
            if (submitBtn) submitBtn.disabled = true;
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
        _ticketSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
    };
})();

// ── Daily login affirmation ──────────────────────────────────────────────
// PAUSED — see ROADMAP.md "Daily login affirmation". Banner display is
// gated by AFFIRMATION_ENABLED so the existing scaffolding (catalog,
// css, login flag set in /index.html) stays in place. Flip back to
// true to re-enable; no other changes needed.
//
// On first authed page-load after a fresh sign-in, /index.html sets
// sessionStorage.bendbsn_show_affirmation = '1'. We read + clear it and
// show ONE soft top-of-screen banner with a random encouragement line.
// Auto-dismisses after 7s; ESC or ✕ dismisses early. Honors prefers-
// reduced-motion. Multi-tab spam suppressed by a login-fingerprint check.
(function () {
    'use strict';
    var AFFIRMATION_ENABLED = false;  // ← roadmap'd; flip to true to re-enable
    function maybeShowAffirmation() {
        if (!AFFIRMATION_ENABLED) {
            // Still consume the one-shot flag so it doesn't pile up across
            // future page loads if/when we re-enable.
            try { sessionStorage.removeItem('bendbsn_show_affirmation'); } catch (e) {}
            return;
        }
        try {
            // Don't show on the login page itself.
            if (location.pathname === '/' || location.pathname === '/index.html') return;
            // One-shot flag set by the login page after successful auth.
            if (sessionStorage.getItem('bendbsn_show_affirmation') !== '1') return;

            // De-dup by login fingerprint, NOT wall-clock time. Each unique
            // login (different bendbsn_login_at) earns one banner; opening
            // multiple tabs within the same login session shares that one.
            // Logging out and back in immediately produces a NEW login_at,
            // so a fresh affirmation fires — even seconds later.
            var loginAt = parseInt(localStorage.getItem('bendbsn_login_at') || '0', 10);
            var lastFor = parseInt(localStorage.getItem('bendbsn_affirmation_for_login') || '0', 10);
            if (loginAt && lastFor === loginAt) {
                sessionStorage.removeItem('bendbsn_show_affirmation');
                return;
            }

            // Lazy-load the catalog so pages that never trigger an
            // affirmation don't pay the parse cost.
            ensureAffirmationsLoaded(function () {
                if (typeof window.pickAffirmation !== 'function') return;
                var pick = window.pickAffirmation();
                if (!pick || !pick.text) return;
                sessionStorage.removeItem('bendbsn_show_affirmation');
                if (loginAt) {
                    try { localStorage.setItem('bendbsn_affirmation_for_login', String(loginAt)); } catch (e) {}
                }
                renderAffirmationBanner(pick);
            });
        } catch (e) { /* never block on the affirmation */ }
    }

    // Console testing: window.testAffirmation() force-shows a random one.
    // Useful for debugging "did it actually appear?" reports.
    window.testAffirmation = function () {
        ensureAffirmationsLoaded(function () {
            if (typeof window.pickAffirmation !== 'function') {
                console.warn('[affirmation] catalog failed to load');
                return;
            }
            renderAffirmationBanner(window.pickAffirmation());
        });
    };

    // Load /shared/affirmations.js on demand. Idempotent — a second call
    // while the first is still loading queues a callback rather than
    // injecting a second <script>. Silent on network failure.
    var _affLoadingCallbacks = null;
    function ensureAffirmationsLoaded(cb) {
        if (typeof window.pickAffirmation === 'function') { cb(); return; }
        if (_affLoadingCallbacks) { _affLoadingCallbacks.push(cb); return; }
        _affLoadingCallbacks = [cb];
        var s = document.createElement('script');
        s.src = '/shared/affirmations.js';
        s.async = true;
        s.onload = function () {
            var queue = _affLoadingCallbacks; _affLoadingCallbacks = null;
            queue.forEach(function (fn) { try { fn(); } catch (e) {} });
        };
        s.onerror = function () { _affLoadingCallbacks = null; /* silent */ };
        document.head.appendChild(s);
    }

    function renderAffirmationBanner(pick) {
        // Build banner element
        var banner = document.createElement('div');
        banner.className = 'bsn-affirmation-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');

        var firstName = '';
        try {
            var dn = localStorage.getItem('bendbsn_displayName') || '';
            firstName = (dn.split(/\s+/)[0] || '').trim();
        } catch (e) {}
        var welcome = firstName ? 'Welcome back, ' + escapeHtml(firstName) + '.' : 'Welcome back.';

        banner.innerHTML =
            '<span class="bsn-aff-icon" aria-hidden="true">' + escapeHtml(pick.icon || '\u2728') + '</span>' +
            '<div class="bsn-aff-text">' +
                '<div class="bsn-aff-line">' + escapeHtml(pick.text) + '</div>' +
                '<div class="bsn-aff-sub">' + welcome + '</div>' +
            '</div>' +
            '<button type="button" class="bsn-aff-close" aria-label="Dismiss affirmation">\u2715</button>';

        document.body.appendChild(banner);
        // Trigger CSS slide-in on next frame
        requestAnimationFrame(function () { banner.classList.add('visible'); });

        var closeTimer = null;
        function dismiss() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            banner.classList.remove('visible');
            banner.classList.add('leaving');
            setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 350);
            document.removeEventListener('keydown', onEsc);
        }
        function onEsc(e) { if (e.key === 'Escape') dismiss(); }

        banner.querySelector('.bsn-aff-close').addEventListener('click', dismiss);
        document.addEventListener('keydown', onEsc);
        closeTimer = setTimeout(dismiss, 7000);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Wait for body to be available (header.js can load before parser
    // finishes the body in some pages).
    if (document.body) {
        maybeShowAffirmation();
    } else {
        document.addEventListener('DOMContentLoaded', maybeShowAffirmation);
    }
})();
// ===== END IT TICKET / FEEDBACK MODAL =====


// ===== LOCAL USER-DATA PURGE =====
// Per-user caches that must not survive a sign-out on a shared lab computer.
// The smart-phrase keys match shared/smart-phrases.js (STORAGE_KEY, SEED_FLAG,
// OWNER_KEY, SYNCED_KEY); dropping the owner key together with the cache keeps
// that file's owner check consistent (no cache + no owner = fresh start).
// Clinical packet backups (bendbsn_cap_local_*) are deliberately NOT purged:
// /clinical/packet/ only keeps one while edits have not reached the server
// (it is removed after every successful save), so at sign-out it is the only
// copy of those edits. The packet page restores it on its owner's next load.
window.bsnPurgeLocalUserData = function () {
    try {
        ['bendbsn_custom_phrases', 'bendbsn_phrases_seeded_v1',
         'bendbsn_custom_phrases_uid', 'bendbsn_phrases_synced'].forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) {}
        });
    } catch (e) {}
};
// ===== END LOCAL USER-DATA PURGE =====


// ===== PRIVACY LOCK OVERLAY =====
// For pages without lock markup of their own. Same idea as /app/'s
// lockScreen()/unlockScreen(): covers the page until Unlock is clicked and
// does NOT sign the user out (idle auto-logout keeps running). Esc does not
// dismiss it; Tab stays on the Unlock button.
(function () {
    'use strict';
    var OVERLAY_ID = 'bsnLockOverlay';
    var prevFocus = null;

    function onKey(e) {
        var o = document.getElementById(OVERLAY_ID);
        if (!o || o.style.display === 'none') return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            e.stopPropagation();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            var b = o.querySelector('button');
            if (b) b.focus();
        }
    }

    function hide() {
        var o = document.getElementById(OVERLAY_ID);
        if (o) o.style.display = 'none';
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && typeof prevFocus.focus === 'function') {
            try { prevFocus.focus(); } catch (e) {}
        }
        prevFocus = null;
    }

    function build() {
        var o = document.createElement('div');
        o.id = OVERLAY_ID;
        o.setAttribute('role', 'dialog');
        o.setAttribute('aria-modal', 'true');
        o.setAttribute('aria-labelledby', OVERLAY_ID + 'Title');
        o.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;' +
            'background:var(--clx-bg-canvas);color:var(--clx-text-primary);' +
            'align-items:center;justify-content:center;flex-direction:column;padding:16px;';

        var box = document.createElement('div');
        box.style.cssText = 'text-align:center;max-width:360px;';

        var icon = document.createElement('div');
        icon.setAttribute('aria-hidden', 'true');
        icon.style.cssText = 'font-size:56px;margin-bottom:16px;';
        icon.textContent = '🔒';

        var h = document.createElement('h1');
        h.id = OVERLAY_ID + 'Title';
        h.style.cssText = 'font-size:28px;margin:0 0 8px;color:var(--clx-text-primary);';
        h.textContent = 'BendBSN';

        var p = document.createElement('p');
        p.style.cssText = 'font-size:15px;margin:0 0 32px;color:var(--clx-text-secondary);';
        p.textContent = 'Portal Locked';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'background:var(--clx-accent);color:var(--clx-accent-text);border:none;' +
            'padding:14px 40px;min-height:44px;border-radius:8px;font-size:15px;font-weight:700;' +
            'cursor:pointer;font-family:inherit;';
        btn.textContent = '🔓 Unlock';
        btn.addEventListener('click', hide);

        var hint = document.createElement('p');
        hint.style.cssText = 'margin:24px 0 0;font-size:12px;color:var(--clx-text-muted);';
        hint.textContent = 'Click unlock to return to your session';

        box.appendChild(icon);
        box.appendChild(h);
        box.appendChild(p);
        box.appendChild(btn);
        box.appendChild(hint);
        o.appendChild(box);
        document.body.appendChild(o);
        return o;
    }

    window.bsnShowLockOverlay = function () {
        if (!document.body) return;
        var o = document.getElementById(OVERLAY_ID) || build();
        if (o.style.display !== 'flex') {
            prevFocus = document.activeElement;
            document.removeEventListener('keydown', onKey, true);
            document.addEventListener('keydown', onKey, true);
        }
        o.style.display = 'flex';
        var b = o.querySelector('button');
        if (b) b.focus();
    };
})();
// ===== END PRIVACY LOCK OVERLAY =====


// ===== ADMIN PER-USER ACTIONS LISTENER =====
// Listens for admin-set flags at userActions/{uid}/{forceLogout|clearCache}.
// When a flag fires, the client takes the action and immediately deletes
// the flag (so it's one-shot). Used by admin panel's User Diagnostics
// pane to remotely sign a user out or wipe their localStorage cache.
(function () {
    'use strict';

    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    if (isLoginPage) return; // never run on the login page

    // Ban enforcement for pages without their own watch. /app/, /home/ and
    // /resources/ run startBanWatch() inline, so skip them to avoid doubling up.
    // Mirrors their isBanMatch(): admin entries carry uid + email; username
    // (email local part) is compared only for legacy entries that lack both.
    var path = location.pathname;
    var hasInlineBanWatch = ['/app', '/home', '/resources'].some(function (base) {
        return path === base || path === base + '/' || path.indexOf(base + '/') === 0;
    });
    var banWatchStarted = false, banHandled = false;
    function isBanMatch(b, u) {
        if (!b || !u) return false;
        if (b.uid || b.email) {
            return !!((b.uid && b.uid === u.uid) ||
                (b.email && u.email && String(b.email).toLowerCase() === u.email.toLowerCase()));
        }
        var uname = u.email || localStorage.getItem('bendbsn_user') || '';
        var dname = localStorage.getItem('bendbsn_displayName') || uname;
        return !!b.username && (b.username === uname || b.username === dname);
    }
    function handleBanned(b) {
        if (banHandled) return;
        banHandled = true;
        if (typeof showToast === 'function') {
            showToast('Your account has been suspended: ' + (b.reason || 'Rule violation'), 'error', 5000);
        }
        setTimeout(function () {
            ['bendbsn_auth', 'bendbsn_user', 'bendbsn_displayName', 'bendbsn_uid',
             'bendbsn_role_v2', 'bendbsn_login_at', 'bendbsn_last_activity'].forEach(function (k) {
                try { localStorage.removeItem(k); } catch (e) {}
            });
            try { window.bsnPurgeLocalUserData(); } catch (e) {}
            // Sign out before leaving, or the login page sees the live session
            // and sends the user straight back.
            var go = function () { location.replace('/'); };
            try { firebase.auth().signOut().then(go, go); } catch (e) { go(); }
        }, 2000);
    }
    function startBanWatch() {
        if (banWatchStarted || hasInlineBanWatch) return;
        banWatchStarted = true;
        // child_added fires for every existing entry first, then for new bans.
        firebase.database().ref('banned').on('child_added', function (snap) {
            var b = snap && snap.val();
            if (isBanMatch(b, firebase.auth().currentUser)) handleBanned(b);
        });
    }

    var attempts = 0;
    function tryInit() {
        attempts++;
        if (!window.firebase || !firebase.apps || !firebase.apps.length) {
            if (attempts < 15) setTimeout(tryInit, 700); // up to ~10s wait
            return;
        }
        try {
            firebase.auth().onAuthStateChanged(function (user) {
                if (!user || !user.uid) return;
                try { startBanWatch(); } catch (e) {}
                var ref = firebase.database().ref('userActions/' + user.uid);
                ref.on('value', function (snap) {
                    var actions = snap && snap.val();
                    if (!actions) return;

                    if (actions.forceLogout) {
                        ref.child('forceLogout').remove().catch(function () {});
                        ['bendbsn_auth', 'bendbsn_user', 'bendbsn_displayName', 'bendbsn_uid',
                         'bendbsn_role_v2', 'bendbsn_login_at'].forEach(function (k) {
                            try { localStorage.removeItem(k); } catch (e) {}
                        });
                        try {
                            Object.keys(localStorage)
                                .filter(function (k) { return k.indexOf('bendbsn_draft_') === 0; })
                                .forEach(function (k) { localStorage.removeItem(k); });
                        } catch (e) {}
                        try { window.bsnPurgeLocalUserData(); } catch (e) {}
                        try { firebase.auth().signOut(); } catch (e) {}
                        try { sessionStorage.setItem('bendbsn_force_logout', '1'); } catch (e) {}
                        location.replace('/');
                        return;
                    }

                    if (actions.clearCache) {
                        ref.child('clearCache').remove().catch(function () {});
                        // Wipe all bendbsn_* localStorage EXCEPT auth keys
                        // (so user stays logged in but cached state is reset)
                        var preserve = { 'bendbsn_auth': 1, 'bendbsn_user': 1,
                                         'bendbsn_displayName': 1, 'bendbsn_uid': 1,
                                         'bendbsn_login_at': 1 };
                        try {
                            var toRemove = [];
                            for (var i = 0; i < localStorage.length; i++) {
                                var k = localStorage.key(i);
                                if (k && k.indexOf('bendbsn_') === 0 && !preserve[k]) toRemove.push(k);
                            }
                            toRemove.forEach(function (k) { localStorage.removeItem(k); });
                        } catch (e) {}
                        try { sessionStorage.setItem('bendbsn_cache_cleared', '1'); } catch (e) {}
                        location.reload();
                        return;
                    }
                });
            });
        } catch (e) { /* never block render */ }
    }
    tryInit();

    // Show a one-time toast after admin-triggered cache clear (next page load)
    function showCacheClearedToast() {
        try {
            if (sessionStorage.getItem('bendbsn_cache_cleared') === '1') {
                sessionStorage.removeItem('bendbsn_cache_cleared');
                if (typeof showToast === 'function') {
                    showToast('Local cache was reset by an admin. You\'re still signed in.', 'info');
                }
            }
        } catch (e) {}
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showCacheClearedToast);
    } else {
        showCacheClearedToast();
    }
})();
// ===== END ADMIN PER-USER ACTIONS LISTENER =====


// ===== CLIENT ERROR CAPTURE =====
// Captures unhandled JS errors and unhandled promise rejections, writing
// them to clientErrors/{pushId} in Firebase. Admin can view these in the
// Logs section to see when users hit bugs without them reporting.
// Errors are throttled (max 1/sec, max 20/page-load) to prevent runaway
// loops from hammering Firebase.
(function () {
    'use strict';

    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    if (isLoginPage) return;

    var errorCount = 0;
    var lastErrorTs = 0;
    var MAX_ERRORS_PER_PAGE = 20;
    var THROTTLE_MS = 1000;

    function logClientError(payload) {
        try {
            var now = Date.now();
            if (errorCount >= MAX_ERRORS_PER_PAGE) return;
            if (now - lastErrorTs < THROTTLE_MS) return;
            errorCount++;
            lastErrorTs = now;

            // Add common context
            payload.timestamp = now;
            payload.url = location.href;
            payload.userAgent = navigator.userAgent;
            payload.uid = (window.firebase && firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : null;
            payload.email = localStorage.getItem('bendbsn_user') || null;
            payload.displayName = localStorage.getItem('bendbsn_displayName') || null;

            if (window.firebase && firebase.apps && firebase.apps.length) {
                firebase.database().ref('clientErrors').push(payload).catch(function () {});
            }
        } catch (e) { /* never throw from error handler */ }
    }

    window.addEventListener('error', function (e) {
        logClientError({
            type: 'error',
            message: (e.message || 'Unknown error').substring(0, 500),
            source: (e.filename || '').substring(0, 200),
            line: e.lineno || null,
            col: e.colno || null,
            stack: (e.error && e.error.stack ? String(e.error.stack) : '').substring(0, 2000)
        });
    });

    window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason;
        var message = reason && reason.message ? reason.message : String(reason).substring(0, 500);
        var stack = reason && reason.stack ? String(reason.stack).substring(0, 2000) : '';
        logClientError({
            type: 'unhandledrejection',
            message: message.substring(0, 500),
            stack: stack
        });
    });
})();

// ── Idle auto-logout (fallback for pages without their own timers) ─────────
// The 30-minute inactivity logout security policy was originally implemented
// inline on app, home and resources. This block gives every OTHER
// authenticated page (emr, careplan, sbar, rotationlog, profile, clinical,
// apa, ...) the same timeout. It self-disables on the three pages that still
// carry their own timers so they never double up.
(function () {
    'use strict';

    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    if (isLoginPage) return;
    // Only arm for authenticated sessions.
    if (localStorage.getItem('bendbsn_auth') !== 'true') return;

    // Activity is shared across tabs through this wall-clock timestamp, so an
    // idle background tab never signs out a tab that is in active use.
    var LAST_KEY = 'bendbsn_last_activity';
    function readShared() {
        try { return parseInt(localStorage.getItem(LAST_KEY) || '0', 10) || 0; } catch (e) { return 0; }
    }
    function writeShared(t) {
        try { localStorage.setItem(LAST_KEY, String(t)); } catch (e) {}
    }
    var ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    var DEBOUNCE_MS     = 30 * 1000;

    // These pages ship their own inline idle/logout timers (their top-level
    // `const LOGOUT_TIMEOUT` is NOT a window property, so we can't feature-detect
    // it — skip by path so timers never double up). They still report their
    // activity so fallback-timer tabs (emr, sbar, ...) see it.
    var p = location.pathname;
    var INLINE_TIMER_PAGES = ['/app', '/home', '/resources'];
    if (INLINE_TIMER_PAGES.some(function (base) { return p === base || p === base + '/' || p.indexOf(base + '/') === 0; })) {
        var lastReport = 0;
        var report = function () {
            var now = Date.now();
            if (now - lastReport < DEBOUNCE_MS) return;
            lastReport = now;
            writeShared(now);
        };
        ACTIVITY_EVENTS.forEach(function (ev) {
            document.addEventListener(ev, report, { passive: true });
        });
        report();
        return;
    }

    var IDLE_WARNING_MS = 25 * 60 * 1000; // warn at 25 min
    var LOGOUT_MS       = 30 * 60 * 1000; // sign out at 30 min

    var warnTimer = null, logoutTimer = null, debounceTimer = null;
    // Wall-clock time of this tab's last activity. Timers alone don't advance
    // during system sleep or a frozen tab, so every check compares real time.
    var lastLocal = Date.now();
    writeShared(lastLocal);

    function idleMs() {
        // Ignore a shared timestamp from the future (clock change), as /app/ does.
        return Date.now() - Math.max(lastLocal, Math.min(readShared(), Date.now()));
    }

    function doIdleLogout() {
        try {
            ['bendbsn_auth', 'bendbsn_user', 'bendbsn_displayName', 'bendbsn_uid',
             'bendbsn_role_v2', 'bendbsn_login_at', LAST_KEY].forEach(function (k) {
                try { localStorage.removeItem(k); } catch (e) {}
            });
            // Smart-phrase cache: the next person on this device must not
            // inherit it (phrases re-pull on login). Unsynced packet backups
            // are kept (see bsnPurgeLocalUserData).
            try { window.bsnPurgeLocalUserData(); } catch (e) {}
            if (window.firebase && firebase.apps && firebase.apps.length) {
                try { firebase.auth().signOut(); } catch (e) {}
            }
            try { sessionStorage.setItem('bendbsn_idle_logout', '1'); } catch (e) {}
        } catch (e) {}
        location.replace('/');
    }

    // (Re)arm both timers for the time remaining. Does NOT count as activity.
    function resetTimers() {
        clearTimeout(warnTimer);
        clearTimeout(logoutTimer);
        var idle = idleMs();
        if (idle < IDLE_WARNING_MS) {
            warnTimer = setTimeout(function () {
                var i = idleMs();
                if (i < IDLE_WARNING_MS) { resetTimers(); return; } // another tab was active
                if (i < LOGOUT_MS && typeof showToast === 'function') {
                    showToast('You will be logged out in 5 minutes due to inactivity.', 'warning', 10000);
                }
            }, IDLE_WARNING_MS - idle);
        }
        logoutTimer = setTimeout(function () {
            if (idleMs() >= LOGOUT_MS) { doIdleLogout(); return; }
            resetTimers(); // activity elsewhere: wait out the remainder
        }, Math.max(0, LOGOUT_MS - idle));
    }

    function onActivity() {
        // Check real elapsed time before this event counts: after sleep the
        // 30-minute timer may not have fired yet, and the first mousemove
        // must not grant a fresh 30 minutes.
        if (idleMs() >= LOGOUT_MS) { doIdleLogout(); return; }
        lastLocal = Date.now();
        if (debounceTimer) return;
        debounceTimer = setTimeout(function () { debounceTimer = null; }, DEBOUNCE_MS);
        writeShared(lastLocal);
        resetTimers();
    }

    ACTIVITY_EVENTS.forEach(function (ev) {
        document.addEventListener(ev, onActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        if (idleMs() >= LOGOUT_MS) { doIdleLogout(); return; }
        resetTimers();
    });
    resetTimers();
})();
// ===== END CLIENT ERROR CAPTURE =====
