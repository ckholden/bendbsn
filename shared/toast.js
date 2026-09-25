/* =============================================
   BendBSN Shared Toast Notification System
   ============================================= */
(function () {
    'use strict';

    function getContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            c.setAttribute('aria-live', 'polite');
            c.setAttribute('aria-atomic', 'false');
            document.body.appendChild(c);
        }
        return c;
    }

    // Toast text is plain text: callers concatenate user-entered values
    // (patient names, usernames), so escape before the \n → <br> step.
    // Some callers still pre-escape with escapeHtml(); undo those entities
    // first (single pass, so "&amp;lt;" -> "&lt;") so text isn't shown
    // double-escaped. Output is always fully re-escaped, so this is safe.
    var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'", '#x27': "'" };
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&(amp|lt|gt|quot|#39|#039|#x27);/g, function (m, e) { return ENT[e]; })
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function dismiss(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        toast.classList.add('hiding');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }

    // True while a modal, dialog or popover is showing: Escape belongs to it,
    // so it must not also dismiss a toast (e.g. 'Draft found → Restore').
    function overlayOpen() {
        var els = document.querySelectorAll(
            '[aria-modal="true"], [role="dialog"], [role="alertdialog"], .modal, ' +
            '.modal-overlay, .bsn-modal-overlay, .rt-popover, #bsnThemePicker');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.closest && el.closest('#toastContainer')) continue;
            if (!el.getClientRects().length) continue; // display:none or detached
            var cs = window.getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
            return true;
        }
        return false;
    }

    // One document-level listener for every toast: a single Escape dismisses
    // only the newest toast (a listener per toast used to clear them all).
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const toasts = c.querySelectorAll('.toast:not(.hiding)');
        if (!toasts.length || overlayOpen()) return;
        dismiss(toasts[toasts.length - 1]);
    });

    /**
     * Show a simple toast notification.
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} type
     * @param {number} duration  ms before auto-dismiss (0 = no auto-dismiss)
     * @returns {HTMLElement}
     */
    window.showToast = function (message, type, duration) {
        type = type || 'info';
        if (duration === undefined) duration = 6000;

        const container = getContainer();
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'status');

        toast.innerHTML =
            '<span class="toast-title">' + esc(message).replace(/\n/g, '<br>') + '</span>' +
            '<button class="toast-close" aria-label="Dismiss">\u00d7</button>';

        toast.querySelector('.toast-close').addEventListener('click', function () { dismiss(toast); });
        toast._dismiss = function () { dismiss(toast); };

        container.appendChild(toast);

        if (duration > 0) setTimeout(function () { dismiss(toast); }, duration);

        return toast;
    };

    /**
     * Show a toast with a title, optional body message, and action buttons.
     * @param {Object} opts
     * @param {'info'|'success'|'warning'|'error'} opts.type
     * @param {string} opts.title
     * @param {string} [opts.message]
     * @param {Array<{label:string, onClick:function}>} [opts.actions]
     * @param {number} [opts.duration]
     * @returns {HTMLElement}
     */
    window.showToastAction = function (opts) {
        opts = opts || {};
        var type = opts.type || 'info';
        var duration = (opts.duration !== undefined) ? opts.duration : 12000;

        const container = getContainer();
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'status');

        var msgHtml = opts.message
            ? '<div class="toast-message">' + esc(opts.message).replace(/\n/g, '<br>') + '</div>'
            : '';

        var actionsHtml = '';
        if (opts.actions && opts.actions.length) {
            actionsHtml = '<div class="toast-actions">';
            opts.actions.forEach(function (a) {
                actionsHtml += '<button class="toast-action-btn">' + esc(a.label) + '</button>';
            });
            actionsHtml += '</div>';
        }

        toast.innerHTML =
            '<span class="toast-title">' + esc(opts.title).replace(/\n/g, '<br>') + '</span>' +
            msgHtml +
            actionsHtml +
            '<button class="toast-close" aria-label="Dismiss">\u00d7</button>';

        if (opts.actions && opts.actions.length) {
            var btns = toast.querySelectorAll('.toast-action-btn');
            btns.forEach(function (btn, i) {
                btn.addEventListener('click', function () {
                    dismiss(toast);
                    if (opts.actions[i] && opts.actions[i].onClick) opts.actions[i].onClick();
                });
            });
        }

        toast.querySelector('.toast-close').addEventListener('click', function () { dismiss(toast); });
        toast._dismiss = function () { dismiss(toast); };

        container.appendChild(toast);

        if (duration > 0) setTimeout(function () { dismiss(toast); }, duration);

        return toast;
    };

}());
