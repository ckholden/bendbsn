/* BendBSN shared Rich Textarea module — WYSIWYG (contenteditable) version
   -----------------------------------------------------------------------
   Wraps a plain <textarea> with a Word-style formatting toolbar. The
   student sees actual bold text, real bullet points, etc. while typing —
   no markdown syntax. Under the hood:

     • A contentEditable <div class="rt-editor"> sits in place of the
       visible textarea (the textarea itself is hidden but kept in the
       DOM as the canonical form value).
     • On every edit, the editor's sanitized innerHTML is written to the
       hidden textarea's .value, so auto-save, Firebase saves, and form
       serialization keep working unchanged.
     • The textarea's .value setter is monkey-patched so programmatic
       writes (e.g., draft restore, Load Document) reflect back into the
       editor.
     • An allowlist sanitizer strips anything other than: strong, em, s,
       ul, ol, li, h1, h2, h3, br, p, div. All attributes are stripped —
       no inline styles, no classes, no scripts.

   Public API:
     richTextarea.attach(textareaEl)        Wrap a single textarea
     richTextarea.attachAll(selector|list)  Wrap matching textareas
     richTextarea.insertAtCursor(ta, text)  Insert plain text at current
                                            cursor (replaces the old
                                            lastActiveTextarea.value
                                            slice pattern — safe whether
                                            the textarea has been
                                            attached or not)
     richTextarea.setValue(ta, content)     Programmatic set (preferred
                                            over ta.value = ...)
     richTextarea.renderHtml(str)           Sanitize untrusted HTML
     richTextarea.stripToPlain(str)         Strip tags → plain text
*/
(function () {
    'use strict';
    if (window.richTextarea) return;

    // --- Sanitizer -------------------------------------------------------
    const ALLOWED_TAGS = new Set([
        'STRONG', 'B', 'EM', 'I', 'S', 'DEL', 'STRIKE',
        'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BR', 'P', 'DIV', 'SPAN', 'FONT'
    ]);
    // Some browsers emit <b> / <i> / <strike> via execCommand — normalize to the modern tags
    const TAG_NORMALIZE = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S' };

    // Named colors we accept from inline styles (kept short on purpose — students
    // get color via the swatch picker, this is just a tolerance for paste-from-Word).
    const NAMED_COLORS = {
        red: '#dc2626', orange: '#f97316', yellow: '#eab308',
        green: '#16a34a', blue: '#2563eb', cyan: '#06b6d4',
        pink: '#ec4899', purple: '#9333ea', black: '#111827',
        white: '#ffffff', gray: '#6b7280', grey: '#6b7280'
    };

    // Validate and normalize a color value to lowercase #RRGGBB. Accepts:
    //   #RRGGBB   #RGB   rgb(R, G, B)   <named>
    // Returns null for anything else (including url(), expression(), JS, escapes).
    function normalizeColor(raw) {
        if (!raw) return null;
        const v = String(raw).trim().toLowerCase();
        // Hex 6
        const h6 = v.match(/^#([0-9a-f]{6})$/);
        if (h6) return '#' + h6[1];
        // Hex 3 → expand
        const h3 = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
        if (h3) return '#' + h3[1] + h3[1] + h3[2] + h3[2] + h3[3] + h3[3];
        // rgb(r, g, b) — allow optional spaces, integer 0-255 each
        const rgb = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
        if (rgb) {
            const r = parseInt(rgb[1], 10), g = parseInt(rgb[2], 10), b = parseInt(rgb[3], 10);
            if (r > 255 || g > 255 || b > 255) return null;
            return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
        }
        // Named
        if (NAMED_COLORS[v]) return NAMED_COLORS[v];
        return null;
    }

    // Parse a `style` attribute string into a sanitized version containing ONLY
    // `color` and `background-color` declarations whose values are valid colors.
    // Real micro-parser: split on `;`, then on `:`, trim, validate per property.
    // Returns either a re-serialized style string (e.g. "color:#dc2626;background-color:#fef08a")
    // or empty string if nothing valid remains.
    function sanitizeStyle(raw) {
        if (!raw) return '';
        const decls = String(raw).split(';');
        const out = [];
        for (let i = 0; i < decls.length; i++) {
            const colon = decls[i].indexOf(':');
            if (colon === -1) continue;
            const prop = decls[i].slice(0, colon).trim().toLowerCase();
            const val = decls[i].slice(colon + 1).trim();
            if (prop !== 'color' && prop !== 'background-color') continue;
            const norm = normalizeColor(val);
            if (norm) out.push(prop + ':' + norm);
        }
        return out.join(';');
    }

    function renameEl(el, newTag) {
        const replacement = document.createElement(newTag);
        while (el.firstChild) replacement.appendChild(el.firstChild);
        el.parentNode.replaceChild(replacement, el);
        return replacement;
    }

    // Convert legacy <font color="..."> / <font style="..."> emitted by some
    // browsers into <span style="color:..."> so we have one normalized form.
    function normalizeFont(el) {
        const span = document.createElement('span');
        const styles = [];
        const colorAttr = el.getAttribute('color');
        if (colorAttr) {
            const c = normalizeColor(colorAttr);
            if (c) styles.push('color:' + c);
        }
        const inlineStyle = el.getAttribute('style');
        if (inlineStyle) {
            const s = sanitizeStyle(inlineStyle);
            if (s) styles.push(s);
        }
        if (styles.length) span.setAttribute('style', styles.join(';'));
        while (el.firstChild) span.appendChild(el.firstChild);
        el.parentNode.replaceChild(span, el);
        return span;
    }

    function walkClean(node) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
            let c = node.childNodes[i];
            if (c.nodeType === 1) {
                let tag = c.tagName;
                if (TAG_NORMALIZE[tag]) {
                    c = renameEl(c, TAG_NORMALIZE[tag]);
                    tag = c.tagName;
                }
                if (tag === 'FONT') {
                    c = normalizeFont(c);
                    tag = c.tagName; // SPAN now
                }
                if (!ALLOWED_TAGS.has(tag)) {
                    // Unwrap: replace element with its children
                    const frag = document.createDocumentFragment();
                    while (c.firstChild) frag.appendChild(c.firstChild);
                    c.parentNode.replaceChild(frag, c);
                    continue;
                }
                // Strip all attributes EXCEPT a sanitized `style` on <span>
                // for color / background-color (that's the only carrier we
                // permit for inline coloring).
                let kept = null;
                if (tag === 'SPAN') {
                    const styleAttr = c.getAttribute('style');
                    if (styleAttr) {
                        const safe = sanitizeStyle(styleAttr);
                        if (safe) kept = safe;
                    }
                }
                while (c.attributes && c.attributes.length) {
                    c.removeAttribute(c.attributes[0].name);
                }
                if (kept) c.setAttribute('style', kept);
                walkClean(c);
            } else if (c.nodeType !== 3) {
                // Strip comments, processing instructions, etc.
                node.removeChild(c);
            }
        }
    }

    function sanitizeHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        walkClean(tmp);
        return tmp.innerHTML;
    }

    // Plain-text extraction — used when a caller wants the un-formatted
    // string (e.g., for a clipboard-friendly copy). Bullets become "• ",
    // numbered lists get their indices re-emitted, paragraphs stay on their
    // own lines.
    function stripToPlain(html) {
        if (html == null || html === '') return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return extractText(tmp).replace(/\n{3,}/g, '\n\n').trim();
    }
    function extractText(node) {
        let out = '';
        node.childNodes.forEach(function (c) {
            if (c.nodeType === 3) {
                out += c.nodeValue;
            } else if (c.nodeType === 1) {
                const tag = c.tagName;
                if (tag === 'BR') out += '\n';
                else if (tag === 'LI') {
                    const parentTag = c.parentNode && c.parentNode.tagName;
                    if (parentTag === 'OL') {
                        const idx = Array.prototype.indexOf.call(c.parentNode.children, c) + 1;
                        out += '\n' + idx + '. ' + extractText(c);
                    } else {
                        out += '\n• ' + extractText(c);
                    }
                } else if (tag === 'UL' || tag === 'OL') {
                    out += extractText(c) + '\n';
                } else if (tag === 'P' || tag === 'DIV' || tag === 'H1' || tag === 'H2' || tag === 'H3') {
                    out += extractText(c) + '\n';
                } else {
                    out += extractText(c);
                }
            }
        });
        return out;
    }

    // --- Textarea value setter hook --------------------------------------
    // Intercept `ta.value = X` so programmatic writes (draft restore, Load
    // Document, etc.) feed back into the contenteditable editor.
    function hookValueSetter(ta, onChange) {
        if (ta.dataset.rtValueHooked === '1') return;
        ta.dataset.rtValueHooked = '1';
        const proto = Object.getPrototypeOf(ta);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        Object.defineProperty(ta, 'value', {
            get: function () { return desc.get.call(this); },
            set: function (v) {
                desc.set.call(this, v);
                onChange(v);
            },
            configurable: true
        });
    }
    // Bypass the hooked setter — used when the editor itself is syncing.
    function setTextareaRaw(ta, v) {
        const proto = Object.getPrototypeOf(ta);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        desc.set.call(ta, v);
    }

    // --- Editor <-> textarea sync ---------------------------------------
    function editorToTextarea(editor, ta) {
        const html = sanitizeHtml(editor.innerHTML);
        // If the HTML is just an empty <br> or empty paragraph, store empty string
        const clean = html.replace(/<br\s*\/?>/gi, '').replace(/<(p|div)>\s*<\/\1>/gi, '');
        setTextareaRaw(ta, clean ? html : '');
    }
    function textareaToEditor(editor, val) {
        if (val == null) val = '';
        const looksLikeHtml = /<(?:strong|b|em|i|s|del|ul|ol|li|h[1-3]|br|p|div|span)\b/i.test(val);
        if (looksLikeHtml) {
            editor.innerHTML = sanitizeHtml(val);
        } else {
            // Plain text → preserve newlines by converting to <br>
            editor.innerHTML = val
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
    }

    // --- Toolbar ---------------------------------------------------------
    function mkBtn(cls, title, html, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rt-btn ' + cls;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.innerHTML = html;
        // Prevent the button from stealing focus — keep cursor in the editor
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        b.addEventListener('click', function (ev) { ev.preventDefault(); onClick(); });
        return b;
    }

    function exec(editor, cmd, arg) {
        editor.focus();
        // document.execCommand is "deprecated" but still supported in every major
        // browser and there is no drop-in replacement for rich-text editing
        // commands. Evergreen support: Chrome, Firefox, Safari, Edge.
        try { document.execCommand(cmd, false, arg || null); } catch (e) {}
        // Dispatch input so our editor→textarea sync picks up the change
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // --- Popover helper --------------------------------------------------
    // Creates a small floating panel anchored below `anchorEl`. Auto-flips to
    // above if there's no room below. Closes on click-outside, Escape, or
    // explicit .close() call. Used by core (color/highlight palettes) and by
    // extension buttons (smart-phrase picker etc.).
    let _activePopover = null;
    function createPopover(anchorEl, contentEl, opts) {
        opts = opts || {};
        // Close any other open popover first
        if (_activePopover) _activePopover.close();
        const pop = document.createElement('div');
        pop.className = 'rt-popover' + (opts.className ? ' ' + opts.className : '');
        pop.appendChild(contentEl);
        document.body.appendChild(pop);
        // Position
        const rect = anchorEl.getBoundingClientRect();
        const popH = pop.offsetHeight;
        const popW = pop.offsetWidth;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        let top = rect.bottom + window.scrollY + 4;
        if (rect.bottom + popH + 8 > vh && rect.top - popH - 4 > 0) {
            top = rect.top + window.scrollY - popH - 4;
        }
        let left = rect.left + window.scrollX;
        if (left + popW > vw - 8) left = vw - popW - 8;
        if (left < 8) left = 8;
        pop.style.top = top + 'px';
        pop.style.left = left + 'px';

        function close() {
            if (!pop.parentNode) return;
            document.removeEventListener('mousedown', onOutside, true);
            document.removeEventListener('keydown', onKey, true);
            pop.parentNode.removeChild(pop);
            if (_activePopover === api) _activePopover = null;
            if (opts.onClose) try { opts.onClose(); } catch (e) {}
        }
        function onOutside(ev) {
            if (pop.contains(ev.target) || anchorEl.contains(ev.target)) return;
            close();
        }
        function onKey(ev) {
            if (ev.key === 'Escape') { ev.preventDefault(); close(); }
        }
        // Defer attaching listeners until next tick so the click that opened the
        // popover doesn't immediately trigger onOutside.
        setTimeout(function () {
            document.addEventListener('mousedown', onOutside, true);
            document.addEventListener('keydown', onKey, true);
        }, 0);
        const api = { close: close, el: pop };
        _activePopover = api;
        return api;
    }

    // --- Color palettes (core) -------------------------------------------
    const TEXT_COLOR_SWATCHES = [
        { hex: '#dc2626', label: 'Red',    hint: 'Critical / abnormal' },
        { hex: '#f97316', label: 'Orange', hint: 'Caution' },
        { hex: '#16a34a', label: 'Green',  hint: 'Normal / WDL' },
        { hex: '#2563eb', label: 'Blue',   hint: 'Info' },
        { hex: '#111827', label: 'Black',  hint: 'Default (reset)' }
    ];
    const HIGHLIGHT_SWATCHES = [
        { hex: '#fef08a', label: 'Yellow' },
        { hex: '#a5f3fc', label: 'Cyan' },
        { hex: '#fbcfe8', label: 'Pink' },
        { hex: '#bbf7d0', label: 'Green' },
        { hex: 'transparent', label: 'Clear', clear: true }
    ];

    function buildSwatchPalette(swatches, onPick) {
        const grid = document.createElement('div');
        grid.className = 'rt-swatch-grid';
        swatches.forEach(function (s) {
            const sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'rt-swatch' + (s.clear ? ' rt-swatch-clear' : '');
            sw.title = s.label + (s.hint ? ' — ' + s.hint : '');
            sw.setAttribute('aria-label', s.label);
            sw.style.background = s.hex;
            sw.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
            sw.addEventListener('click', function (ev) {
                ev.preventDefault();
                onPick(s);
            });
            grid.appendChild(sw);
        });
        return grid;
    }

    function buildToolbar(editor, ta, opts) {
        const bar = document.createElement('div');
        bar.className = 'rt-toolbar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Formatting toolbar');

        bar.appendChild(mkBtn('rt-btn-bold', 'Bold (Ctrl+B)', 'B',
            function () { exec(editor, 'bold'); }));
        bar.appendChild(mkBtn('rt-btn-italic', 'Italic (Ctrl+I)', 'I',
            function () { exec(editor, 'italic'); }));
        bar.appendChild(mkBtn('rt-btn-strike', 'Strikethrough', 'S',
            function () { exec(editor, 'strikeThrough'); }));

        const d1 = document.createElement('div'); d1.className = 'rt-divider'; bar.appendChild(d1);

        // Text color button + popover
        const colorBtn = mkBtn('rt-btn-color', 'Text color', '<span class="rt-color-glyph">A</span>',
            function () {
                const palette = buildSwatchPalette(TEXT_COLOR_SWATCHES, function (s) {
                    exec(editor, 'foreColor', s.hex);
                    pop.close();
                });
                const pop = createPopover(colorBtn, palette, { className: 'rt-popover-palette' });
            });
        bar.appendChild(colorBtn);

        // Highlight button + popover
        const hlBtn = mkBtn('rt-btn-highlight', 'Highlight', '<span class="rt-color-glyph rt-color-glyph-hl">A</span>',
            function () {
                const palette = buildSwatchPalette(HIGHLIGHT_SWATCHES, function (s) {
                    if (s.clear) {
                        // execCommand 'hiliteColor' with 'transparent' / no value
                        // doesn't work on all browsers. Fall back to removeFormat
                        // for the highlight specifically by setting bg to white,
                        // then we strip white later. Cleanest is to set a no-op
                        // and rely on user toggle. For now: setBg to inherit-ish.
                        exec(editor, 'hiliteColor', '#ffffff');
                    } else {
                        exec(editor, 'hiliteColor', s.hex);
                    }
                    pop.close();
                });
                const pop = createPopover(hlBtn, palette, { className: 'rt-popover-palette' });
            });
        bar.appendChild(hlBtn);

        const d2 = document.createElement('div'); d2.className = 'rt-divider'; bar.appendChild(d2);

        bar.appendChild(mkBtn('rt-btn-ul', 'Bulleted list', '•',
            function () { exec(editor, 'insertUnorderedList'); }));
        bar.appendChild(mkBtn('rt-btn-ol', 'Numbered list', '1.',
            function () { exec(editor, 'insertOrderedList'); }));

        const d3 = document.createElement('div'); d3.className = 'rt-divider'; bar.appendChild(d3);

        bar.appendChild(mkBtn('rt-btn-h1', 'Heading 1', 'H1',
            function () { exec(editor, 'formatBlock', 'H1'); }));
        bar.appendChild(mkBtn('rt-btn-h2', 'Heading 2', 'H2',
            function () { exec(editor, 'formatBlock', 'H2'); }));
        bar.appendChild(mkBtn('rt-btn-p', 'Normal text', '¶',
            function () { exec(editor, 'formatBlock', 'P'); }));

        const d4 = document.createElement('div'); d4.className = 'rt-divider'; bar.appendChild(d4);

        bar.appendChild(mkBtn('rt-btn-clear', 'Clear formatting', '⌫',
            function () { exec(editor, 'removeFormat'); }));

        // --- Extension buttons (consumer-provided) ---
        // Each entry: { label, title, className, dividerBefore, onClick(editor, ta, buttonEl) }
        // The shared module stays ignorant of what these do — consumer wires up
        // popovers, modals, custom logic, etc.
        const extras = (opts && opts.extraButtons) || [];
        if (extras.length) {
            const sep = document.createElement('div'); sep.className = 'rt-divider'; bar.appendChild(sep);
        }
        extras.forEach(function (b) {
            if (b.dividerBefore) {
                const d = document.createElement('div'); d.className = 'rt-divider'; bar.appendChild(d);
            }
            const btn = mkBtn(b.className || 'rt-btn-extra', b.title || b.label, b.label, function () {
                if (typeof b.onClick === 'function') b.onClick(editor, ta, btn);
            });
            bar.appendChild(btn);
        });

        return bar;
    }

    // --- Keyboard shortcuts ----------------------------------------------
    function attachShortcuts(editor) {
        editor.addEventListener('keydown', function (ev) {
            if (!(ev.ctrlKey || ev.metaKey)) return;
            const k = ev.key.toLowerCase();
            if (k === 'b') { ev.preventDefault(); exec(editor, 'bold'); }
            else if (k === 'i') { ev.preventDefault(); exec(editor, 'italic'); }
        });
    }

    // --- Attach ----------------------------------------------------------
    function attach(ta, opts) {
        if (!ta || ta.tagName !== 'TEXTAREA') return null;
        if (ta.dataset.rtAttached === '1') return ta.parentNode;
        ta.dataset.rtAttached = '1';
        opts = opts || {};

        // Build wrapper
        const wrap = document.createElement('div');
        wrap.className = 'rt-wrap';

        const editor = document.createElement('div');
        editor.className = 'rt-editor';
        editor.contentEditable = 'true';
        editor.setAttribute('role', 'textbox');
        editor.setAttribute('aria-multiline', 'true');
        if (ta.placeholder) editor.dataset.placeholder = ta.placeholder;
        if (ta.id) editor.dataset.rtEditorFor = ta.id;
        // Copy min-height from the textarea so the editor feels the same size
        try {
            const cs = window.getComputedStyle(ta);
            if (cs && cs.minHeight && cs.minHeight !== '0px') {
                editor.style.minHeight = cs.minHeight;
            } else {
                const rows = parseInt(ta.getAttribute('rows') || '0', 10);
                editor.style.minHeight = (rows > 0 ? (rows * 1.5) : 4.5) + 'em';
            }
        } catch (e) { editor.style.minHeight = '4.5em'; }

        const toolbar = buildToolbar(editor, ta, opts);

        // Hide original textarea (keep it in the DOM for form-value access)
        ta.style.display = 'none';

        const parent = ta.parentNode;
        parent.insertBefore(wrap, ta);
        wrap.appendChild(toolbar);
        wrap.appendChild(editor);
        wrap.appendChild(ta);

        // Seed editor with current textarea value (treats HTML if detected, plain-text otherwise)
        textareaToEditor(editor, ta.value);

        // Editor → textarea on every edit
        editor.addEventListener('input', function () { editorToTextarea(editor, ta); });
        editor.addEventListener('blur', function () { editorToTextarea(editor, ta); });

        // Paste as plain text (no <span style>, no pasted images)
        editor.addEventListener('paste', function (ev) {
            ev.preventDefault();
            const cd = ev.clipboardData || window.clipboardData;
            const text = cd ? cd.getData('text/plain') : '';
            document.execCommand('insertText', false, text);
        });

        // Forward focus to the hidden textarea so lastActiveTextarea tracking
        // keeps working. /app/ listens on `focusin` (which bubbles) to detect
        // textarea focus. The native `focus` event does NOT bubble even when
        // dispatched with { bubbles: true }, so we must dispatch `focusin`.
        editor.addEventListener('focus', function () {
            try {
                ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            } catch (e) {
                const ev = document.createEvent('Event');
                ev.initEvent('focusin', true, true);
                ta.dispatchEvent(ev);
            }
        });

        // Programmatic textarea.value = X → reflect back into editor (only when
        // the editor isn't the active element, to avoid clobbering live typing)
        hookValueSetter(ta, function (v) {
            if (document.activeElement !== editor) {
                textareaToEditor(editor, v);
            }
        });

        return wrap;
    }

    function attachAll(selectorOrList, opts) {
        let list = [];
        if (typeof selectorOrList === 'string') {
            list = document.querySelectorAll(selectorOrList);
        } else if (selectorOrList && selectorOrList.length != null) {
            list = selectorOrList;
        }
        const wraps = [];
        for (let i = 0; i < list.length; i++) {
            const w = attach(list[i], opts);
            if (w) wraps.push(w);
        }
        return wraps;
    }

    // --- Public helpers --------------------------------------------------
    // Insert plain text at the current cursor position of the editor
    // associated with `ta`. Falls back to a plain-textarea insert if the
    // textarea hasn't been attached (e.g., dynamic modal textareas).
    function insertAtCursor(ta, text) {
        if (!ta || !text) return;
        const wrap = ta.dataset && ta.dataset.rtAttached === '1' ? ta.parentNode : null;
        const editor = wrap ? wrap.querySelector('.rt-editor') : null;
        if (!editor) {
            // Plain textarea fallback (legacy path)
            const s = ta.selectionStart || 0;
            const e = ta.selectionEnd || 0;
            const v = ta.value || '';
            ta.value = v.slice(0, s) + text + v.slice(e);
            try { ta.setSelectionRange(s + text.length, s + text.length); } catch (err) {}
            ta.focus();
            return;
        }
        editor.focus();
        // If there's no existing selection within the editor, move the caret to the end
        const sel = window.getSelection();
        if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
            const r = document.createRange();
            r.selectNodeContents(editor);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        // Insert — execCommand handles line-break preservation (\n → <br>) cleanly
        document.execCommand('insertText', false, text);
    }

    // Set the full contents programmatically (preferred over ta.value = for
    // callers who want to avoid the monkey-patch path — equivalent, but
    // explicit).
    function setValue(ta, content) { ta.value = content == null ? '' : content; }

    // --- Export parser ---------------------------------------------------
    // Parse the editor's (or any stored) HTML into a structured block list
    // suitable for PDF / Word rendering. Strips tags we don't allow, then
    // walks the DOM to produce:
    //   [{ type: 'paragraph', runs: [{text, bold, italic, strike}, ...] },
    //    { type: 'heading', level: 1|2|3, runs: [...] },
    //    { type: 'list', ordered: true|false, items: [[runs], [runs], ...] }]
    // Empty input returns [].
    function parseForExport(html) {
        if (html == null || html === '') return [];
        const tmp = document.createElement('div');
        tmp.innerHTML = sanitizeHtml(html);
        const blocks = [];
        walkBlocks(tmp, blocks);
        return blocks;
    }

    function walkBlocks(root, blocks) {
        // Accumulator for loose text/inline runs at the root level. A <br>
        // flushes this as its own paragraph (Chrome's contenteditable often
        // emits <br>-separated content instead of <p>/<ul><li> — we have to
        // treat hard breaks as paragraph boundaries or everything collapses
        // into one block on export).
        let loose = null;
        function flushLoose() {
            if (loose && loose.length) {
                blocks.push({ type: 'paragraph', runs: loose });
            }
            loose = null;
        }
        root.childNodes.forEach(function (c) {
            if (c.nodeType === 3) {
                if (!loose) loose = [];
                loose.push(makeRun(c.nodeValue, EMPTY_STYLE));
                return;
            }
            if (c.nodeType !== 1) return;
            const tag = c.tagName;
            if (tag === 'BR') {
                flushLoose(); // hard break at root → new paragraph
                return;
            }
            if (tag === 'P' || tag === 'DIV') {
                // <p> and <div> are TRANSPARENT block containers — recurse
                // into them so nested <ul>/<ol>/<h1-3> get detected as their
                // proper block types. Without this, Chrome's contenteditable
                // wrapping (which puts each line in a <div>, including divs
                // that contain a <ul>) flattens the whole list into a single
                // paragraph of run-after-run text with no bullets.
                // Nested <br>s inside are still handled because walkBlocks
                // treats every <br> as a paragraph boundary.
                flushLoose();
                walkBlocks(c, blocks);
                return;
            }
            if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
                flushLoose();
                const runs = [];
                collectRuns(c, runs, EMPTY_STYLE);
                blocks.push({ type: 'heading', level: parseInt(tag[1], 10), runs: runs });
                return;
            }
            if (tag === 'UL' || tag === 'OL') {
                flushLoose();
                const items = [];
                c.childNodes.forEach(function (li) {
                    if (li.nodeType === 1 && li.tagName === 'LI') {
                        // A single <li> can contain <br>s (Chrome emits this when
                        // user presses Shift+Enter inside a list item, or when
                        // bullets are applied to multi-line text). Split into
                        // sub-items so each line gets its own bullet.
                        splitByBr(li, EMPTY_STYLE).forEach(function (runs) {
                            if (runs.length) items.push(runs);
                        });
                    }
                });
                if (items.length) blocks.push({ type: 'list', ordered: tag === 'OL', items: items });
                return;
            }
            // Inline element at the root — bucket with surrounding text.
            // Seed the style from this element's own tag so <strong>/<em>/<s>
            // at the root level still register correctly.
            if (!loose) loose = [];
            collectRuns(c, loose, styleFromTag(c, EMPTY_STYLE));
        });
        flushLoose();
    }

    // Empty starting style (immutable shared instance — never mutate)
    const EMPTY_STYLE = { bold: false, italic: false, strike: false, color: null, highlight: null };

    // Read inline-style color/background-color off an element (sanitizer has
    // already validated these — they're guaranteed safe hex). Returns
    // { color, highlight } object with null for missing.
    function readSpanStyle(el) {
        const out = { color: null, highlight: null };
        if (!el || el.nodeType !== 1) return out;
        const styleAttr = el.getAttribute && el.getAttribute('style');
        if (!styleAttr) return out;
        const decls = styleAttr.split(';');
        for (let i = 0; i < decls.length; i++) {
            const colon = decls[i].indexOf(':');
            if (colon === -1) continue;
            const prop = decls[i].slice(0, colon).trim().toLowerCase();
            const val = decls[i].slice(colon + 1).trim();
            if (prop === 'color') out.color = val;
            else if (prop === 'background-color') out.highlight = val;
        }
        return out;
    }

    // Compute the inherited style state given a parent style and the child element.
    // Bold/italic/strike accumulate (any ancestor sets them on); color/highlight
    // shadow (the deepest <span style="color:..."> wins).
    function styleFromTag(el, parentStyle) {
        const tag = el.tagName;
        const span = readSpanStyle(el);
        return {
            bold: parentStyle.bold || (tag === 'STRONG' || tag === 'B'),
            italic: parentStyle.italic || (tag === 'EM' || tag === 'I'),
            strike: parentStyle.strike || (tag === 'S' || tag === 'DEL' || tag === 'STRIKE'),
            color: span.color || parentStyle.color,
            highlight: span.highlight || parentStyle.highlight
        };
    }

    function makeRun(text, style) {
        const r = {
            text: text,
            bold: !!style.bold,
            italic: !!style.italic,
            strike: !!style.strike
        };
        if (style.color) r.color = style.color;
        if (style.highlight) r.highlight = style.highlight;
        return r;
    }

    // Walk a container's children, collecting runs; every <br> starts a new
    // sub-segment. Returns an array of run-arrays. Used for both <p>/<div>
    // (→ separate paragraphs per segment) and <li> (→ separate list items).
    function splitByBr(container, startStyle) {
        const segments = [];
        let current = [];
        function flush() { if (current.length) { segments.push(current); current = []; } }
        function walk(node, style) {
            node.childNodes.forEach(function (c) {
                if (c.nodeType === 3) {
                    if (c.nodeValue) current.push(makeRun(c.nodeValue, style));
                    return;
                }
                if (c.nodeType !== 1) return;
                const tag = c.tagName;
                if (tag === 'BR') { flush(); return; }
                walk(c, styleFromTag(c, style));
            });
        }
        walk(container, startStyle || EMPTY_STYLE);
        flush();
        return segments;
    }

    function collectRuns(node, runs, style) {
        node.childNodes.forEach(function (c) {
            if (c.nodeType === 3) {
                if (c.nodeValue) runs.push(makeRun(c.nodeValue, style));
                return;
            }
            if (c.nodeType !== 1) return;
            const tag = c.tagName;
            if (tag === 'BR') {
                runs.push(makeRun('\n', style));
                return;
            }
            collectRuns(c, runs, styleFromTag(c, style));
        });
    }

    // Convenience: flatten a runs array to plain text (no formatting).
    function runsToText(runs) {
        return (runs || []).map(function (r) { return r.text; }).join('');
    }

    window.richTextarea = {
        attach: attach,
        attachAll: attachAll,
        insertAtCursor: insertAtCursor,
        setValue: setValue,
        renderHtml: sanitizeHtml,
        stripToPlain: stripToPlain,
        parseForExport: parseForExport,
        runsToText: runsToText,
        // Exposed so consumers (e.g., /app/'s smart-phrase picker) can build
        // their own popovers anchored to extension-button DOM nodes without
        // duplicating the position / dismiss-on-outside-click logic.
        createPopover: createPopover
    };
})();
