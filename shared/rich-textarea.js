/* BendBSN shared Rich Textarea module
   -----------------------------------------------
   Wraps a plain <textarea> with a markdown-formatting toolbar (B / I / S /
   bullets / numbered / H1 / H2) plus a live Preview toggle.

   Public API (attached to window.richTextarea):
     richTextarea.attach(textareaEl)
         Wraps a single textarea.
     richTextarea.attachAll(selectorOrNodeList)
         Wraps all matching textareas.
     richTextarea.renderMarkdown(str) => safe HTML string
         Used by preview pane + any caller that wants to render saved notes.
     richTextarea.stripMarkdown(str) => plain text
         Strips markdown syntax for plain-text export paths.

   Markdown subset (intentional — nursing docs, not a CMS):
     **bold**     *italic*     ~~strike~~
     # H1         ## H2        ### H3
     - bullets (also • or *)   1. numbered
     Multiple newlines → paragraphs. Single newline → <br>.
     Everything else is HTML-escaped.

   Design choices:
     - Plain textarea stays in the DOM (lastActiveTextarea keeps working, all
       existing Insert-at-cursor helpers keep working, exports keep reading
       .value as markdown source of truth).
     - No CDN dependency — ~250 lines of purpose-built renderer and toolbar.
     - Idempotent: calling attach() twice on the same textarea is a no-op.
*/
(function () {
    'use strict';

    if (window.richTextarea) return; // already loaded

    // --- Utility ---------------------------------------------------------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- Markdown renderer ----------------------------------------------
    // Block-level first (headers, lists), then inline (bold/italic/strike)
    // on the remaining text. Unsafe HTML is always escaped first.
    function renderMarkdown(md) {
        if (md == null || md === '') return '';
        const raw = String(md);

        // Escape HTML up front; all markdown tokens are pure ASCII so this is safe
        let text = esc(raw);

        // Headers — must be at line start. Do ### first so it doesn't get eaten by #.
        text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Lists: walk line-by-line so consecutive bullets/numbers collapse into a single <ul>/<ol>
        const lines = text.split('\n');
        const out = [];
        let inUl = false, inOl = false;
        function closeLists() {
            if (inUl) { out.push('</ul>'); inUl = false; }
            if (inOl) { out.push('</ol>'); inOl = false; }
        }
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Bullets: -, *, or • at line start (with optional leading spaces)
            const ulm = line.match(/^\s*(?:[-*•])\s+(.+)$/);
            const olm = line.match(/^\s*\d+\.\s+(.+)$/);
            if (ulm) {
                if (inOl) { out.push('</ol>'); inOl = false; }
                if (!inUl) { out.push('<ul>'); inUl = true; }
                out.push('<li>' + ulm[1] + '</li>');
            } else if (olm) {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (!inOl) { out.push('<ol>'); inOl = true; }
                out.push('<li>' + olm[1] + '</li>');
            } else {
                closeLists();
                out.push(line);
            }
        }
        closeLists();
        text = out.join('\n');

        // Inline: bold (**), italic (*), strikethrough (~~)
        text = text.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, '<strong>$1</strong>');
        // Italic: match single * but not ** (already consumed). Use negative lookbehind/ahead.
        text = text.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
        text = text.replace(/~~([^~\n]+?)~~/g, '<s>$1</s>');

        // Paragraph/line-break handling.
        // Walk line-by-line and buffer consecutive prose lines into a <p>. When we hit
        // a block-level tag line (<ul>, <ol>, <li>, </ul>, </ol>, <h1..3>), flush the
        // prose buffer and emit the block as-is. A blank line also flushes.
        const blockStart = /^<(?:ul|ol|li|h[1-3]|\/ul|\/ol)\b/;
        const finalLines = text.split('\n');
        const rendered = [];
        let para = [];
        function flushPara() {
            if (!para.length) return;
            const joined = para.join('<br>').replace(/^(?:<br>)+|(?:<br>)+$/g, '');
            if (joined) rendered.push('<p>' + joined + '</p>');
            para = [];
        }
        for (let i = 0; i < finalLines.length; i++) {
            const line = finalLines[i];
            if (line.trim() === '') {
                flushPara();
                continue;
            }
            if (blockStart.test(line.trim())) {
                flushPara();
                rendered.push(line.trim());
                continue;
            }
            para.push(line);
        }
        flushPara();
        return rendered.join('');
    }

    // --- Strip-to-plain (for export paths that don't understand markdown) ---
    function stripMarkdown(md) {
        if (md == null) return '';
        let t = String(md);
        // Headers — keep the heading text, drop the # marks
        t = t.replace(/^#{1,3}\s+/gm, '');
        // Bold/italic/strike — keep inner
        t = t.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
        t = t.replace(/\*([^*\n]+?)\*/g, '$1');
        t = t.replace(/~~([^~\n]+?)~~/g, '$1');
        // Bullets: convert "- item" / "* item" / "• item" to "• item" for readability
        t = t.replace(/^\s*[-*]\s+/gm, '• ');
        return t;
    }

    // --- Selection helpers ----------------------------------------------
    function wrapSelection(ta, marker, placeholder) {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const before = ta.value.slice(0, s);
        const sel = ta.value.slice(s, e);
        const after = ta.value.slice(e);
        const txt = sel || placeholder;
        ta.value = before + marker + txt + marker + after;
        const mL = marker.length;
        if (sel) {
            ta.selectionStart = s + mL;
            ta.selectionEnd = e + mL;
        } else {
            ta.selectionStart = s + mL;
            ta.selectionEnd = s + mL + placeholder.length;
        }
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function prefixLines(ta, prefixFn) {
        const s = ta.selectionStart, e = ta.selectionEnd;
        // Expand selection to whole lines
        let lineStart = s;
        while (lineStart > 0 && ta.value[lineStart - 1] !== '\n') lineStart--;
        let lineEnd = e;
        while (lineEnd < ta.value.length && ta.value[lineEnd] !== '\n') lineEnd++;
        const before = ta.value.slice(0, lineStart);
        const block = ta.value.slice(lineStart, lineEnd);
        const after = ta.value.slice(lineEnd);
        // Empty selection on an empty line → just insert the prefix + placeholder
        const emptySel = (s === e) && block.trim() === '';
        const applied = emptySel
            ? prefixFn(0) + 'item'
            : block.split('\n').map(function (line, idx) {
                  // Skip already-prefixed lines — toggle off instead
                  const pre = prefixFn(idx);
                  if (line.startsWith(pre)) return line.slice(pre.length);
                  // Strip any existing bullet/number prefix first so switching lists works
                  const stripped = line.replace(/^\s*(?:[-*•]\s+|\d+\.\s+)/, '');
                  return pre + stripped;
              }).join('\n');
        ta.value = before + applied + after;
        ta.selectionStart = lineStart;
        ta.selectionEnd = lineStart + applied.length;
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function togglePrefix(ta, prefix) {
        // For headers — just toggle the prefix on the current line(s).
        const s = ta.selectionStart;
        let lineStart = s;
        while (lineStart > 0 && ta.value[lineStart - 1] !== '\n') lineStart--;
        let lineEnd = ta.selectionEnd;
        while (lineEnd < ta.value.length && ta.value[lineEnd] !== '\n') lineEnd++;
        const before = ta.value.slice(0, lineStart);
        const block = ta.value.slice(lineStart, lineEnd);
        const after = ta.value.slice(lineEnd);
        const applied = block.split('\n').map(function (line) {
            if (line.startsWith(prefix)) return line.slice(prefix.length);
            // Strip any other heading prefix before applying new one
            const stripped = line.replace(/^#{1,3}\s+/, '');
            return (stripped ? prefix + stripped : prefix + 'Heading');
        }).join('\n');
        ta.value = before + applied + after;
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // --- Toolbar builder -------------------------------------------------
    function buildToolbar(ta, previewEl, wrap) {
        const bar = document.createElement('div');
        bar.className = 'rt-toolbar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Formatting toolbar');

        function mkBtn(cls, title, html, onClick) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'rt-btn ' + cls;
            b.title = title;
            b.setAttribute('aria-label', title);
            b.innerHTML = html;
            b.addEventListener('click', function (ev) { ev.preventDefault(); onClick(); });
            // Prevent toolbar button from stealing focus before the textarea action
            b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
            return b;
        }

        bar.appendChild(mkBtn('rt-btn-bold', 'Bold (Ctrl+B)', 'B',
            function () { wrapSelection(ta, '**', 'bold text'); }));
        bar.appendChild(mkBtn('rt-btn-italic', 'Italic (Ctrl+I)', 'I',
            function () { wrapSelection(ta, '*', 'italic text'); }));
        bar.appendChild(mkBtn('rt-btn-strike', 'Strikethrough', 'S',
            function () { wrapSelection(ta, '~~', 'strikethrough'); }));

        const div1 = document.createElement('div'); div1.className = 'rt-divider'; bar.appendChild(div1);

        bar.appendChild(mkBtn('rt-btn-ul', 'Bulleted list', '•',
            function () { prefixLines(ta, function () { return '- '; }); }));
        bar.appendChild(mkBtn('rt-btn-ol', 'Numbered list', '1.',
            function () { prefixLines(ta, function (i) { return (i + 1) + '. '; }); }));

        const div2 = document.createElement('div'); div2.className = 'rt-divider'; bar.appendChild(div2);

        bar.appendChild(mkBtn('rt-btn-h1', 'Heading 1', 'H1',
            function () { togglePrefix(ta, '# '); }));
        bar.appendChild(mkBtn('rt-btn-h2', 'Heading 2', 'H2',
            function () { togglePrefix(ta, '## '); }));

        const spacer = document.createElement('div'); spacer.className = 'rt-spacer'; bar.appendChild(spacer);

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'rt-btn rt-preview-toggle';
        previewBtn.title = 'Toggle preview (Ctrl+Shift+P)';
        previewBtn.setAttribute('aria-label', 'Toggle preview');
        previewBtn.innerHTML = '<span class="rt-preview-icon">👁</span>Preview';
        previewBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            togglePreview(wrap, ta, previewEl, previewBtn);
        });
        bar.appendChild(previewBtn);

        return bar;
    }

    function togglePreview(wrap, ta, previewEl, btn) {
        const isPreviewing = wrap.classList.toggle('rt-previewing');
        if (isPreviewing) {
            previewEl.innerHTML = renderMarkdown(ta.value);
            btn.innerHTML = '<span class="rt-preview-icon">✎</span>Edit';
        } else {
            btn.innerHTML = '<span class="rt-preview-icon">👁</span>Preview';
            ta.focus();
        }
    }

    // --- Keyboard shortcuts ---------------------------------------------
    function attachShortcuts(ta) {
        ta.addEventListener('keydown', function (ev) {
            if (!(ev.ctrlKey || ev.metaKey)) return;
            const key = ev.key.toLowerCase();
            if (key === 'b') {
                ev.preventDefault();
                wrapSelection(ta, '**', 'bold text');
            } else if (key === 'i') {
                ev.preventDefault();
                wrapSelection(ta, '*', 'italic text');
            }
        });
    }

    // --- Public attach --------------------------------------------------
    function attach(ta) {
        if (!ta || ta.tagName !== 'TEXTAREA') return null;
        if (ta.dataset.rtAttached === '1') return ta.parentNode;
        ta.dataset.rtAttached = '1';

        // Build wrapper
        const wrap = document.createElement('div');
        wrap.className = 'rt-wrap';
        const previewEl = document.createElement('div');
        previewEl.className = 'rt-preview';
        previewEl.setAttribute('aria-live', 'polite');

        const parent = ta.parentNode;
        parent.insertBefore(wrap, ta);
        wrap.appendChild(buildToolbar(ta, previewEl, wrap));
        wrap.appendChild(ta);
        wrap.appendChild(previewEl);

        attachShortcuts(ta);
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

    window.richTextarea = {
        attach: attach,
        attachAll: attachAll,
        renderMarkdown: renderMarkdown,
        stripMarkdown: stripMarkdown
    };
})();
