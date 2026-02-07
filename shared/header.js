/* =========================================================
   BendBSN Shared Header Logic
   Auto-injects canonical header if not already present.
   Ensures logo href is correct on every page.
   Include this script before </body> on every page.
   ========================================================= */

(function () {
    'use strict';

    // Determine logo link destination
    var isLoginPage = location.pathname === '/' || location.pathname === '/index.html';
    var logoHref = isLoginPage ? '/' : '/home/';

    var existing = document.querySelector('header.site-header');

    if (existing) {
        // Header already exists in HTML (instant render path).
        // Ensure the logo link href is correct.
        var link = existing.querySelector('.logo-link');
        if (link) link.setAttribute('href', logoHref);
    } else {
        // No inline header found — auto-inject the canonical one.
        var header = document.createElement('header');
        header.className = 'site-header';
        header.innerHTML =
            '<a href="' + logoHref + '" class="logo-link">' +
                '<img src="/logo.png" alt="BendBSN" class="site-logo">' +
            '</a>';

        var root = document.getElementById('header-root');
        if (root) {
            root.appendChild(header);
        } else {
            document.body.insertBefore(header, document.body.firstChild);
        }
    }
})();
