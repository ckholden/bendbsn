/* =========================================================
   BendBSN shared navigation: behaviour
   Markup: shared/nav.template.html (copied into pages by
   scripts/sync-nav.mjs). Styles: shared/nav.css.
   Load with defer, so it runs after header.js and the page's own
   inline scripts.

   - Both More buttons (top bar and bottom bar) are disclosures for the
     one #clxMore panel: aria-expanded + aria-controls, not role=menu.
     Opening moves focus to the first item; Esc closes and returns focus
     to the button; a click outside, or focus leaving, closes it.
     Below 64em the sheet sits just above the bottom-bar More button but
     earlier in the DOM (inside the header), so Tab past the last item,
     or Shift+Tab before the first, goes back to that button.
   - The breakpoint is 64em, as in nav.css (1024px at 16px text). If it
     flips while focus is in the nav (zoom, rotation, a resized window),
     the panel closes and focus goes to the More button now showing.
   - Items with data-action call the existing page/header functions:
     openTicketModal, lockScreen (or bsnShowLockOverlay), logout. Focus
     goes back to the More button first, so the lock overlay and the
     Feedback dialog hand it back there when they close.
   - The theme item is wired in header.js; this file only toggles the
     theme itself when an older cached header.js does not (the first
     load after a deploy).
   - Install (#installPwaBtn) shows only when the browser offers it.
   - The Admin item ([data-admin]) shows only after the same admin check
     the admin page uses.
   ========================================================= */
(function () {
    'use strict';

    var panel = document.getElementById('clxMore');
    if (!panel) return;
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.clx-more-btn[aria-controls="clxMore"]'));
    var backdrop = document.querySelector('.clx-more-backdrop');
    var header = panel.closest('.clx-topbar') || panel.parentElement;
    var desktop = window.matchMedia ? window.matchMedia('(min-width: 64em)') : null;
    var opener = null;

    function isOpen() { return !panel.hidden; }
    function isDesktop() { return !!(desktop && desktop.matches); }
    function visible(el) { return !!(el && el.getClientRects().length); }

    function place() {
        if (!isDesktop() || !opener) { panel.style.removeProperty('--clx-more-x'); return; }
        var hr = header.getBoundingClientRect();
        var br = opener.getBoundingClientRect();
        var w = panel.offsetWidth;
        var x = br.left - hr.left;
        x = Math.min(x, hr.width - w - 8);
        x = Math.max(8, x);
        panel.style.setProperty('--clx-more-x', Math.round(x) + 'px');
    }

    function open(btn) {
        opener = btn;
        panel.hidden = false;
        if (backdrop) backdrop.hidden = false;
        if (header) header.classList.add('clx-more-open');
        buttons.forEach(function (b) { b.setAttribute('aria-expanded', b === btn ? 'true' : 'false'); });
        place();
        var items = panel.querySelectorAll('.clx-more-item');
        for (var i = 0; i < items.length; i++) {
            if (visible(items[i])) { items[i].focus(); break; }
        }
    }

    function close(returnFocus) {
        if (!isOpen()) return;
        panel.hidden = true;
        if (backdrop) backdrop.hidden = true;
        if (header) header.classList.remove('clx-more-open');
        buttons.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        var back = opener;
        opener = null;
        if (returnFocus && back && visible(back)) back.focus();
    }

    function inNav(node) {
        if (!node || !node.nodeType) return false;
        if (panel.contains(node)) return true;
        for (var i = 0; i < buttons.length; i++) if (buttons[i].contains(node)) return true;
        return false;
    }
    function inChrome(node) {
        return !!(node && node.closest && node.closest('.clx-topbar, .clx-botnav'));
    }

    buttons.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (isOpen() && opener === btn) close(false);
            else open(btn);
        });
    });

    if (backdrop) backdrop.addEventListener('click', function () { close(true); });

    document.addEventListener('click', function (e) {
        if (isOpen() && !inNav(e.target)) close(false);
    });

    document.addEventListener('keydown', function (e) {
        if (isOpen() && (e.key === 'Escape' || e.key === 'Esc')) {
            e.preventDefault();
            close(true);
        }
    });

    // Tabbing out of the panel closes it (focus moving to the More button
    // itself is left to that button's click).
    function onFocusOut(e) {
        if (isOpen() && e.relatedTarget && !inNav(e.relatedTarget)) close(false);
    }
    panel.addEventListener('focusout', onFocusOut);
    buttons.forEach(function (b) { b.addEventListener('focusout', onFocusOut); });

    // Sheet (below 64em): Tab from the last item, or Shift+Tab from the
    // first, returns to the More button that opened it. Tab from that
    // button then leaves the nav and closes the sheet.
    panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || isDesktop() || !opener || !visible(opener)) return;
        var items = Array.prototype.filter.call(panel.querySelectorAll('a[href], button:not([disabled])'), visible);
        if (!items.length) return;
        var edge = e.shiftKey ? items[0] : items[items.length - 1];
        if (document.activeElement === edge) {
            e.preventDefault();
            opener.focus();
        }
    });

    // Where focus was last: in the nav chrome or not. A focused item that
    // the breakpoint hides drops focus to the body, so this is read
    // instead of document.activeElement when the breakpoint flips.
    var chromeHadFocus = false;
    document.addEventListener('focusin', function (e) { chromeHadFocus = inChrome(e.target); });

    window.addEventListener('resize', function () { if (isOpen()) place(); });
    if (desktop) {
        var onBreakpoint = function () {
            var restore = chromeHadFocus;
            close(false);
            if (!restore) return;
            var a = document.activeElement;
            if (a && a !== document.body && visible(a) && !panel.contains(a)) return;
            var shown = buttons.filter(visible)[0];
            if (shown) shown.focus();
        };
        if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
        else if (desktop.addListener) desktop.addListener(onBreakpoint);
    }

    // ---------- Actions ----------
    var deferredInstall = null;

    function themeFallback() {
        if (window.__bsnThemeItemWired) return; // header.js handles it
        var cur = (typeof window.getTheme === 'function') ? window.getTheme()
            : (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        var next = cur === 'dark' ? 'light' : 'dark';
        if (typeof window.setTheme === 'function') window.setTheme(next);
        else {
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('bendbsn_theme', next); } catch (err) {}
        }
    }

    function install() {
        if (typeof window.showInstallPrompt === 'function') { window.showInstallPrompt(); return; }
        if (!deferredInstall) return;
        var ev = deferredInstall;
        deferredInstall = null;
        try {
            ev.prompt();
            if (ev.userChoice && ev.userChoice.then) {
                ev.userChoice.then(function (r) {
                    if (r && r.outcome === 'accepted') hideInstall();
                }).catch(function () {});
            }
        } catch (err) {}
    }

    panel.addEventListener('click', function (e) {
        var el = e.target.closest ? e.target.closest('[data-action]') : null;
        if (!el || !panel.contains(el)) return;
        var action = el.getAttribute('data-action');
        if (action === 'theme') { themeFallback(); return; }
        // Focus back on More first: the lock overlay and the Feedback
        // dialog return focus to whatever had it when they opened.
        close(true);
        if (action === 'close') return;
        if (action === 'feedback' && typeof window.openTicketModal === 'function') window.openTicketModal();
        else if (action === 'lock') {
            var lock = window.lockScreen || window.bsnShowLockOverlay;
            if (typeof lock === 'function') lock();
        } else if (action === 'logout' && typeof window.logout === 'function') window.logout();
        else if (action === 'install') install();
    });

    // Theme state for an older cached header.js that does not sync the item
    if (!window.__bsnThemeItemWired) {
        var syncTheme = function () {
            var dark = document.documentElement.getAttribute('data-theme') === 'dark';
            panel.querySelectorAll('[data-action="theme"]').forEach(function (b) {
                b.setAttribute('aria-pressed', dark ? 'true' : 'false');
            });
        };
        syncTheme();
        if (window.MutationObserver) {
            new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
    }

    // ---------- Install ----------
    var installBtn = document.getElementById('installPwaBtn');
    function hideInstall() { if (installBtn) { installBtn.hidden = true; installBtn.style.removeProperty('display'); } }
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;
    if (installBtn && !standalone) {
        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredInstall = e;
            installBtn.hidden = false;
        });
        window.addEventListener('appinstalled', function () { deferredInstall = null; hideInstall(); });
    }

    // ---------- Avatar initials ----------
    function initials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length || name === 'User') return '';
        var a = parts[0].charAt(0);
        var b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
        return (a + b).toUpperCase();
    }
    function paintAvatar() {
        var name = null;
        try { name = localStorage.getItem('bendbsn_displayName'); } catch (err) {}
        var txt = initials(name);
        if (!txt) return;
        document.querySelectorAll('.clx-avatar').forEach(function (av) { av.textContent = txt; });
    }
    paintAvatar();
    window.addEventListener('storage', function (e) { if (e.key === 'bendbsn_displayName') paintAvatar(); });

    // ---------- Admin item ----------
    // Same rule as admin/index.html verifyAdminAccess: the isAdmin claim, or
    // the profile's isAdmin, or the instructor role. Without the claim it
    // reads just those three fields of the profile, not the whole node.
    var adminItems = panel.querySelectorAll('[data-admin]');
    function showAdmin() { adminItems.forEach(function (el) { el.hidden = false; }); }
    if (adminItems.length && window.firebase && firebase.apps && firebase.apps.length &&
        typeof firebase.auth === 'function') {
        try {
            var stopAuth = firebase.auth().onAuthStateChanged(function (user) {
                if (!user) return;
                if (typeof stopAuth === 'function') stopAuth();
                var claim = (typeof user.getIdTokenResult === 'function')
                    ? user.getIdTokenResult().then(function (r) { return !!(r && r.claims && r.claims.isAdmin === true); })
                    : Promise.resolve(false);
                claim.catch(function () { return false; }).then(function (isAdmin) {
                    if (isAdmin) { showAdmin(); return; }
                    if (typeof firebase.database !== 'function') return;
                    var db = firebase.database();
                    return Promise.all(['isAdmin', 'role_id', 'role'].map(function (k) {
                        return db.ref('userProfiles/' + user.uid + '/' + k).once('value')
                            .then(function (snap) { return snap ? snap.val() : null; }, function () { return null; });
                    })).then(function (v) {
                        if (v[0] === true || v[1] === 'instructor' || v[2] === 'Instructor') showAdmin();
                    });
                }).catch(function () {});
            });
        } catch (err) {}
    }
})();
