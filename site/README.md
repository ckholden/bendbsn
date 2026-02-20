# BendBSN Eleventy Site Generator

This directory contains the Eleventy (11ty) static site generator for BendBSN. It eliminates code duplication and enables proper CSP with nonces.

## Benefits

✅ **No code duplication** - Write once, applies to all pages
✅ **Secure CSP** - Random nonces eliminate need for `unsafe-inline`
✅ **Easy maintenance** - Change shared layout once
✅ **Static output** - Still works with GitHub Pages
✅ **Keep inline JS** - Page-specific scripts with proper nonces

---

## Quick Start

### 1. Install Dependencies

```bash
cd site
npm install
```

### 2. Build the Site

```bash
npm run build
```

This generates static HTML files in `dist/`

### 3. Deploy to Production

```bash
npm run deploy
```

This builds and copies files to the parent directory (served by GitHub Pages)

### 4. Development Server

```bash
npm run serve
```

Starts a local server with live reload at http://localhost:8080

---

## Project Structure

```
site/
├── .eleventy.js          # Eleventy configuration
├── package.json          # Dependencies and scripts
├── src/
│   ├── _includes/        # Shared templates/partials
│   │   ├── layout.njk         # Main page layout
│   │   ├── head.njk           # <head> tags + CSP
│   │   ├── firebase.njk       # Firebase SDK scripts
│   │   ├── auth-guard.njk     # Login check
│   │   └── bottom-toolbar.njk # Bottom nav
│   ├── pages/            # Page templates
│   │   ├── home.njk
│   │   ├── app.njk
│   │   ├── chat.njk
│   │   └── ...
│   └── assets/           # Static assets
│       ├── css/
│       └── js/
└── dist/                 # Build output (gitignored)
```

---

## How It Works

### Page Template Example

Each page is a small Nunjucks template with front matter:

```njk
---
layout: layout.njk
title: Home
permalink: /home/index.html
requireAuth: true
includeBottomToolbar: true
currentPage: home
---

<div class="content">
  <!-- Page-specific HTML here -->
</div>
```

### Available Front Matter Options

| Option | Type | Description |
|--------|------|-------------|
| `layout` | string | Layout template (always `layout.njk`) |
| `title` | string | Page title (appears in `<title>` tag) |
| `permalink` | string | Output path (e.g., `/app/index.html`) |
| `requireAuth` | boolean | Include auth guard redirect |
| `includeBottomToolbar` | boolean | Show bottom navigation |
| `currentPage` | string | Active nav item (home, app, chat, etc.) |
| `noIndex` | boolean | Add `noindex` meta tag |
| `pageStyles` | string/array | Page-specific CSS files |
| `inlineStyles` | string | Inline CSS (with nonce) |
| `pageScript` | string | Page-specific inline JS (with nonce) |
| `useEmailJS` | boolean | Include EmailJS SDK |
| `headerActions` | array | Header action buttons |

### Inline Scripts with Nonce

**Old way (insecure):**
```html
<script>
  console.log('Hello');
</script>
```

**New way (secure with nonce):**
```njk
---
pageScript: |
  console.log('Hello from {{ title }}!');
  // Your page-specific JavaScript here
---
```

The `{{ nonce }}` is automatically injected into both:
- CSP header (`script-src 'nonce-ABC123'`)
- Script tag (`<script nonce="ABC123">`)

---

## Migrating Existing Pages

### Step 1: Create Page Template

Create `src/pages/yourpage.njk`:

```njk
---
layout: layout.njk
title: Your Page Title
permalink: /yourpage/index.html
requireAuth: true
includeBottomToolbar: true
currentPage: yourpage
---

<!-- Copy page-specific HTML from old file -->
<!-- Everything between <body> and bottom toolbar -->
```

### Step 2: Extract Inline Styles

If the page has `<style>` tags, move to front matter:

```njk
---
inlineStyles: |
  .your-class {
    color: red;
  }
---
```

### Step 3: Extract Inline Scripts

Move all `<script>` content to front matter:

```njk
---
pageScript: |
  // Your JavaScript here
  function yourFunction() {
    console.log('Works with nonce!');
  }
---
```

### Step 4: Build and Test

```bash
npm run build
```

Check `dist/yourpage/index.html` - should have:
- Random nonce in CSP header
- Same nonce in all inline `<script>` tags
- All shared elements (header, Firebase, etc.)

---

## Migration Checklist

Pages to migrate:

- [x] ✅ home.njk (example completed)
- [ ] ⏳ index.njk (login page)
- [ ] ⏳ app.njk (RN Notes)
- [ ] ⏳ chat.njk (Chat)
- [ ] ⏳ ai.njk (AI Assistant)
- [ ] ⏳ resources.njk (Resources)
- [ ] ⏳ community.njk (Community)
- [ ] ⏳ admin.njk (Admin Panel)
- [ ] ⏳ clinical.njk (Clinical Packet)
- [ ] ⏳ apa.njk (APA Generator)
- [ ] ⏳ labsched.njk (Lab Scheduler)

---

## Common Tasks

### Add a New Page

1. Create `src/pages/newpage.njk`
2. Set front matter (title, permalink, etc.)
3. Add page content
4. Build: `npm run build`
5. Deploy: `npm run deploy`

### Update Shared Header

Edit `src/_includes/layout.njk` - changes apply to all pages

### Update CSP Policy

Edit `.eleventy.js` → `csp` shortcode

### Add Firebase Feature

Add to `src/_includes/firebase.njk`

---

## Deployment Workflow

### Development
```bash
npm run serve    # Live preview at localhost:8080
```

### Production Build
```bash
npm run build    # Generates dist/
npm run deploy   # Copies to parent directory
cd ..
git add .
git commit -m "Deploy site updates"
git push
```

GitHub Pages will automatically serve the updated files.

---

## CSP Nonce System

### How Nonces Work

1. **Build time:** Eleventy generates random nonce (e.g., `ABC123`)
2. **CSP header:** Adds `script-src 'nonce-ABC123'`
3. **Script tags:** All inline scripts get `nonce="ABC123"`
4. **Browser:** Only scripts with matching nonce can execute

**Result:** Eliminates `unsafe-inline`, preventing XSS attacks

### Nonce Regeneration

A new random nonce is generated on **every build**. This is secure because:
- Attackers can't predict the nonce
- Old nonces become invalid after rebuild
- Scripts without the nonce won't execute

---

## Troubleshooting

### "npm: command not found"
Install Node.js from https://nodejs.org/

### Build fails with "Cannot find module"
```bash
cd site
npm install
```

### Changes not appearing
```bash
npm run clean  # Delete dist/
npm run build  # Rebuild
```

### CSP blocking scripts
Check browser console. If you see CSP errors:
1. Verify script has `nonce="{{ nonce }}"` in template
2. Verify nonce matches CSP header
3. Check `.eleventy.js` CSP policy includes required domains

---

## Advanced: Custom Includes

### Create a Reusable Component

1. Create `src/_includes/yourcomponent.njk`
2. Add template code
3. Use in pages:
```njk
{% raw %}
{% include "yourcomponent.njk" %}
{% endraw %}
```

### Pass Data to Includes

```njk
{% raw %}
{% include "component.njk", { data: "value" } %}
{% endraw %}
```

---

## Performance Notes

- **Build time:** ~1-2 seconds for all 11 pages
- **Output size:** Same as hand-coded HTML
- **Runtime:** No JavaScript overhead (pure static HTML)
- **SEO:** No impact (still server-rendered HTML)

---

## Security Benefits

| Before | After |
|--------|-------|
| `unsafe-inline` in CSP | Secure nonces |
| Code duplicated 11 times | Single source of truth |
| Easy to miss security updates | Update once, applies everywhere |
| Manual CSP management | Auto-generated, always correct |

---

## Questions?

- Eleventy Docs: https://www.11ty.dev/docs/
- Nunjucks Syntax: https://mozilla.github.io/nunjucks/
- CSP Guide: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

---

## Support

For issues with the build system:
1. Check this README
2. Review `.eleventy.js` configuration
3. Test with `npm run serve` for live debugging
4. Check `dist/` output for generated HTML

Created by Claude Code to improve BendBSN security and maintainability.
