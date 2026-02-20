/* =============================================
   BendBSN Shared Toast Notification System
   ============================================= */
(function () {
    'use strict';

    const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

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

    function dismiss(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        toast.classList.add('hiding');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }

    function bindEsc(toast) {
        function handler(e) {
            if (e.key === 'Escape') {
                // Dismiss the topmost (last) toast
                const container = getContainer();
                const toasts = container.querySelectorAll('.toast:not(.hiding)');
                if (toasts.length) dismiss(toasts[toasts.length - 1]);
                document.removeEventListener('keydown', handler);
            }
        }
        document.addEventListener('keydown', handler);
        // Clean up listener when toast is gone
        const obs = new MutationObserver(() => {
            if (!document.body.contains(toast)) {
                document.removeEventListener('keydown', handler);
                obs.disconnect();
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Show a simple toast notification.
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} type
     * @param {number} duration  ms before auto-dismiss (0 = no auto-dismiss)
     * @returns {HTMLElement}  toast element with ._dismiss() method
     */
    window.showToast = function (message, type, duration) {
        type = type || 'info';
        if (duration === undefined) duration = 6000;

        const container = getContainer();
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'status');

        toast.innerHTML =
            '<div class="toast-header">' +
                '<span class="toast-icon">' + (ICONS[type] || ICONS.info) + '</span>' +
                '<span class="toast-title">' + message.replace(/\n/g, '<br>') + '</span>' +
            '</div>' +
            '<button class="toast-close" aria-label="Dismiss">\u00d7</button>';

        toast.querySelector('.toast-close').addEventListener('click', function () { dismiss(toast); });
        toast._dismiss = function () { dismiss(toast); };

        container.appendChild(toast);
        bindEsc(toast);

        if (duration > 0) {
            setTimeout(function () { dismiss(toast); }, duration);
        }

        return toast;
    };

    /**
     * Show a toast with a title, body message, and action buttons.
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
            ? '<div class="toast-message">' + opts.message.replace(/\n/g, '<br>') + '</div>'
            : '';

        var actionsHtml = '';
        if (opts.actions && opts.actions.length) {
            actionsHtml = '<div class="toast-actions">';
            opts.actions.forEach(function (a) {
                actionsHtml += '<button class="toast-action-btn">' + a.label + '</button>';
            });
            actionsHtml += '</div>';
        }

        toast.innerHTML =
            '<div class="toast-header">' +
                '<span class="toast-icon">' + (ICONS[type] || ICONS.info) + '</span>' +
                '<span class="toast-title">' + (opts.title || '').replace(/\n/g, '<br>') + '</span>' +
            '</div>' +
            msgHtml +
            actionsHtml +
            '<button class="toast-close" aria-label="Dismiss">\u00d7</button>';

        // Bind action button clicks
        if (opts.actions && opts.actions.length) {
            var btns = toast.querySelectorAll('.toast-action-btn');
            btns.forEach(function (btn, i) {
                btn.addEventListener('click', function () {
                    dismiss(toast);
                    if (opts.actions[i] && opts.actions[i].onClick) {
                        opts.actions[i].onClick();
                    }
                });
            });
        }

        toast.querySelector('.toast-close').addEventListener('click', function () { dismiss(toast); });
        toast._dismiss = function () { dismiss(toast); };

        container.appendChild(toast);
        bindEsc(toast);

        if (duration > 0) {
            setTimeout(function () { dismiss(toast); }, duration);
        }

        return toast;
    };

}());
