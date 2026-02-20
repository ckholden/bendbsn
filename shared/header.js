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
    // Reuse existing #onlineCount element (home page) or inject a new chip
    var siteHeader = document.querySelector('.site-header');
    var targetCountEl = siteHeader ? siteHeader.querySelector('#onlineCount') : null;

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
    var CURRENT_ONBOARDING_VERSION = '2.0';

    function initOnboarding() {
        // Skip on login page
        if (isLoginPage) return;
        // Skip if user has already seen this version
        if (localStorage.getItem('bendbsn_onboarding_version') === CURRENT_ONBOARDING_VERSION) return;

        var overlay = document.createElement('div');
        overlay.id = 'bsnOnboardingOverlay';
        overlay.className = 'bsn-onboarding-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bsnOnboardTitle');

        overlay.innerHTML =
            '<div class="bsn-onboarding-modal">' +
                '<h2 class="bsn-onboarding-title" id="bsnOnboardTitle">BendBSN Has Been Updated</h2>' +
                '<ul class="bsn-onboarding-list">' +
                    '<li>Profile settings now apply across the site</li>' +
                    '<li>Role &amp; Year must be saved from the Notes Generator</li>' +
                    '<li>Instructor name is no longer required</li>' +
                    '<li>Improved documentation flow</li>' +
                '</ul>' +
                '<div class="bsn-onboarding-btns">' +
                    '<button class="bsn-onboarding-dismiss" id="bsnOnboardDismiss">Dismiss</button>' +
                    '<button class="bsn-onboarding-primary" id="bsnOnboardExplore">Explore Updates</button>' +
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
            window.location.href = '/app/';
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

    initOnboarding();

})();

/* =========================================================
   THEME SYSTEM (7 themes)
   ========================================================= */
window.getTheme = function() {
    return document.documentElement.getAttribute('data-theme') || 'light';
};

window.setTheme = function(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('bsn9b_theme', name);
    // Update button label
    var labels = {
        light: '☀️ Light', warm: '🌅 Warm', forest: '🌿 Forest',
        ocean: '🌊 Ocean', sunset: '🌆 Sunset', rose: '🌸 Rose', dark: '🌙 Dark'
    };
    var btn = document.getElementById('bsnThemeBtn');
    if (btn) {
        var lbl = btn.querySelector('.bsn-theme-btn-label');
        if (lbl) lbl.textContent = labels[name] || '🎨 Theme';
    }
    // Sync active state in picker
    document.querySelectorAll('.bsn-theme-opt').forEach(function(opt) {
        opt.classList.toggle('active', opt.dataset.theme === name);
    });
    // Keep per-page sidebar icons in sync
    var isDark = name === 'dark';
    var icon = document.getElementById('themeMenuIcon');
    var text = document.getElementById('themeMenuText');
    if (icon) icon.textContent = isDark ? '☀️' : '🎨';
    if (text) text.textContent = isDark ? 'Light Mode' : 'Theme';
};

window.toggleThemePicker = function() {
    var picker = document.getElementById('bsnThemePicker');
    if (!picker) return;
    var open = picker.style.display === 'block';
    picker.style.display = open ? 'none' : 'block';
    if (!open) {
        document.querySelectorAll('.bsn-theme-opt').forEach(function(opt) {
            opt.classList.toggle('active', opt.dataset.theme === window.getTheme());
        });
    }
};

// Override binary toggle — now opens picker
window.toggleDarkMode = function() {
    window.toggleThemePicker();
};

(function injectThemePicker() {
    var themeBtn = document.querySelector('.header-actions button[onclick*="toggleDarkMode"]');
    if (!themeBtn) return;
    themeBtn.id = 'bsnThemeBtn';
    // Wrap in position:relative container
    var wrap = document.createElement('div');
    wrap.className = 'bsn-theme-btn-wrap';
    themeBtn.parentNode.insertBefore(wrap, themeBtn);
    wrap.appendChild(themeBtn);
    // Update button content to show current theme
    themeBtn.innerHTML = '<span class="bsn-theme-btn-label">🎨 Theme</span>';
    window.setTheme(window.getTheme());
    // Build picker HTML
    var pickerHTML = '<div id="bsnThemePicker">' +
        '<div class="bsn-theme-picker-label">Neutral</div>' +
        '<div class="bsn-theme-grid bsn-theme-grid-3">' +
        '<button class="bsn-theme-opt" data-theme="light" onclick="window.setTheme(\'light\')"><span class="bsn-swatch" style="background:#e8edf2;"></span>Light</button>' +
        '<button class="bsn-theme-opt" data-theme="warm"  onclick="window.setTheme(\'warm\')"><span class="bsn-swatch" style="background:#f2ece0;"></span>Warm</button>' +
        '<button class="bsn-theme-opt" data-theme="dark"  onclick="window.setTheme(\'dark\')"><span class="bsn-swatch" style="background:#161b22;border-color:rgba(255,255,255,0.2);"></span>Dark</button>' +
        '</div>' +
        '<div class="bsn-theme-divider"></div>' +
        '<div class="bsn-theme-picker-label">Colored</div>' +
        '<div class="bsn-theme-grid">' +
        '<button class="bsn-theme-opt" data-theme="forest" onclick="window.setTheme(\'forest\')"><span class="bsn-swatch" style="background:#e8f0e8;"></span>Forest</button>' +
        '<button class="bsn-theme-opt" data-theme="ocean"  onclick="window.setTheme(\'ocean\')"><span class="bsn-swatch" style="background:#e8f0f5;"></span>Ocean</button>' +
        '<button class="bsn-theme-opt" data-theme="sunset" onclick="window.setTheme(\'sunset\')"><span class="bsn-swatch" style="background:#ece8f5;"></span>Sunset</button>' +
        '<button class="bsn-theme-opt" data-theme="rose"   onclick="window.setTheme(\'rose\')"><span class="bsn-swatch" style="background:#f5e8eb;"></span>Rose</button>' +
        '</div>' +
        '</div>';
    wrap.insertAdjacentHTML('beforeend', pickerHTML);
    // Outside click closes picker
    document.addEventListener('click', function(e) {
        var picker = document.getElementById('bsnThemePicker');
        if (picker && picker.style.display === 'block') {
            if (!wrap.contains(e.target)) picker.style.display = 'none';
        }
    });
})();
