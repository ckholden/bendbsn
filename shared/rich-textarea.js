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
        'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BR', 'P', 'DIV', 'SPAN'
    ]);
    // Some browsers emit <b> / <i> / <strike> via execCommand — normalize to the modern tags
    const TAG_NORMALIZE = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S' };

    function renameEl(el, newTag) {
        const replacement = document.createElement(newTag);
        while (el.firstChild) replacement.appendChild(el.firstChild);
        el.parentNode.replaceChild(replacement, el);
        return replacement;
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
                if (!ALLOWED_TAGS.has(tag)) {
                    // Unwrap: replace element with its children
                    const frag = document.createDocumentFragment();
                    while (c.firstChild) frag.appendChild(c.firstChild);
                    c.parentNode.replaceChild(frag, c);
                    continue;
                }
                // Strip ALL attributes (no classes, no inline styles, no data-*)
                while (c.attributes && c.attributes.length) {
                    c.removeAttribute(c.attributes[0].name);
                }
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

    function buildToolbar(editor, ta) {
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

        bar.appendChild(mkBtn('rt-btn-ul', 'Bulleted list', '•',
            function () { exec(editor, 'insertUnorderedList'); }));
        bar.appendChild(mkBtn('rt-btn-ol', 'Numbered list', '1.',
            function () { exec(editor, 'insertOrderedList'); }));

        const d2 = document.createElement('div'); d2.className = 'rt-divider'; bar.appendChild(d2);

        bar.appendChild(mkBtn('rt-btn-h1', 'Heading 1', 'H1',
            function () { exec(editor, 'formatBlock', 'H1'); }));
        bar.appendChild(mkBtn('rt-btn-h2', 'Heading 2', 'H2',
            function () { exec(editor, 'formatBlock', 'H2'); }));
        bar.appendChild(mkBtn('rt-btn-p', 'Normal text', '¶',
            function () { exec(editor, 'formatBlock', 'P'); }));

        const d3 = document.createElement('div'); d3.className = 'rt-divider'; bar.appendChild(d3);

        bar.appendChild(mkBtn('rt-btn-clear', 'Clear formatting', '⌫',
            function () { exec(editor, 'removeFormat'); }));

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
    function attach(ta) {
        if (!ta || ta.tagName !== 'TEXTAREA') return null;
        if (ta.dataset.rtAttached === '1') return ta.parentNode;
        ta.dataset.rtAttached = '1';

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

        const toolbar = buildToolbar(editor, ta);

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

    function attachAll(selectorOrList) {
        let list = [];
        if (typeof selectorOrList === 'string') {
            list = document.querySelectorAll(selectorOrList);
        } else if (selectorOrList && selectorOrList.length != null) {
            list = selectorOrList;
        }
        const wraps = [];
        for (let i = 0; i < list.length; i++) {
            const w = attach(list[i]);
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
                loose.push({ text: c.nodeValue, bold: false, italic: false, strike: false });
                return;
            }
            if (c.nodeType !== 1) return;
            const tag = c.tagName;
            if (tag === 'BR') {
                flushLoose(); // hard break at root → new paragraph
                return;
            }
            if (tag === 'P' || tag === 'DIV') {
                flushLoose();
                // A <p>/<div> that contains <br>s gets split into multiple paragraphs
                splitByBr(c, { bold: false, italic: false, strike: false }).forEach(function (runs) {
                    if (runs.length) blocks.push({ type: 'paragraph', runs: runs });
                });
                return;
            }
            if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
                flushLoose();
                const runs = [];
                collectRuns(c, runs, { bold: false, italic: false, strike: false });
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
                        splitByBr(li, { bold: false, italic: false, strike: false }).forEach(function (runs) {
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
            const startStyle = {
                bold: tag === 'STRONG' || tag === 'B',
                italic: tag === 'EM' || tag === 'I',
                strike: tag === 'S' || tag === 'DEL' || tag === 'STRIKE'
            };
            collectRuns(c, loose, startStyle);
        });
        flushLoose();
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
                    if (c.nodeValue) {
                        current.push({
                            text: c.nodeValue,
                            bold: !!style.bold,
                            italic: !!style.italic,
                            strike: !!style.strike
                        });
                    }
                    return;
                }
                if (c.nodeType !== 1) return;
                const tag = c.tagName;
                if (tag === 'BR') { flush(); return; }
                const next = {
                    bold: style.bold || (tag === 'STRONG' || tag === 'B'),
                    italic: style.italic || (tag === 'EM' || tag === 'I'),
                    strike: style.strike || (tag === 'S' || tag === 'DEL' || tag === 'STRIKE')
                };
                walk(c, next);
            });
        }
        walk(container, startStyle || { bold: false, italic: false, strike: false });
        flush();
        return segments;
    }

    function collectRuns(node, runs, style) {
        node.childNodes.forEach(function (c) {
            if (c.nodeType === 3) {
                if (c.nodeValue) {
                    runs.push({
                        text: c.nodeValue,
                        bold: !!style.bold,
                        italic: !!style.italic,
                        strike: !!style.strike
                    });
                }
                return;
            }
            if (c.nodeType !== 1) return;
            const tag = c.tagName;
            if (tag === 'BR') {
                runs.push({ text: '\n', bold: !!style.bold, italic: !!style.italic, strike: !!style.strike });
                return;
            }
            const next = {
                bold: style.bold || (tag === 'STRONG' || tag === 'B'),
                italic: style.italic || (tag === 'EM' || tag === 'I'),
                strike: style.strike || (tag === 'S' || tag === 'DEL' || tag === 'STRIKE')
            };
            collectRuns(c, runs, next);
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
        runsToText: runsToText
    };
})();
