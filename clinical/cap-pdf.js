/* BendBSN — Clinical Assessment Packet — PDF export
   ------------------------------------------------------------------
   Exports: window.CAP_PDF.generate(packet) → saves the PDF.

   Depends on window.jspdf (loaded lazily by the editor before calling
   this). Each enabled module renders via a per-module function in
   R_PDF; the main loop walks packet.meta.enabledModules and calls
   the matching renderer.
*/
(function () {
    'use strict';
    if (window.CAP_PDF) return;

    // ------------------------------------------------------------------
    // Text sanitizer — jsPDF's built-in Helvetica is WinAnsi-only. A single
    // character outside WinAnsi (≥, ≤, SpO₂, ⚠, ✓, emoji…) makes jsPDF
    // re-encode the WHOLE string as UTF-16, so the entire line prints as
    // garbage. Map common clinical symbols to ASCII and replace anything
    // else unsupported with '?'. Applied to every string the layout draws,
    // so it covers both the literals below and students' free text.
    // ------------------------------------------------------------------
    const PDF_CHAR_MAP = {
        '\u2265': '>=', '\u2264': '<=', '\u2260': '!=', '\u2212': '-',
        '\u2082': '2', '\u2083': '3',
        '\u26A0': '!', '\u2713': 'OK', '\u2714': 'OK', '\u2717': 'X', '\u2718': 'X',
        '\u2192': '->', '\u2190': '<-', '\u2191': '(up)', '\u2193': '(down)',
        '\u2153': '1/3', '\u2154': '2/3', '\uFE0F': ''
    };
    const PDF_MAP_RE = new RegExp('[' + Object.keys(PDF_CHAR_MAP).join('') + ']', 'g');
    // Latin-1 plus the CP1252 extras WinAnsi adds in 0x80-0x9F
    const PDF_UNSUPPORTED_RE = /[^\u0000-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/gu;
    function pdfSafe(s) {
        return String(s == null ? '' : s)
            .replace(PDF_MAP_RE, function (ch) { return PDF_CHAR_MAP[ch]; })
            .replace(PDF_UNSUPPORTED_RE, '?');
    }

    // US Letter, like the program's Word form
    const PAGE_FORMAT = 'letter';

    const CAP = window.CAP_MODULES;
    // Word-form wording shared with the editor (cap-modules.js FORM)
    const FORM = (CAP && CAP.FORM) || { NAME: 'Clinical Assessment Packet Forms', VERSION: '6/24', OMEGA_ROWS: [], MED_COLUMNS: [], NCSBN_ROWS: [] };

    // "patient" (Word form) or "resident" (memory-care packets); set per generate()
    let PERSON = 'patient';
    function PersonCap() { return PERSON.charAt(0).toUpperCase() + PERSON.slice(1); }

    // ------------------------------------------------------------------
    // Layout helpers — scope-local to one generate() call via makeLayout
    // ------------------------------------------------------------------
    // Page size tracks the current page: addPage('landscape') swaps pw/ph/cw
    // (and L.pw/L.ph/L.cw), so helpers and renderers must read them at draw
    // time, never cache them across a page break.
    function makeLayout(doc) {
        let pw = doc.internal.pageSize.getWidth();
        let ph = doc.internal.pageSize.getHeight();
        const m = 18;              // margin in mm
        let cw = pw - m * 2;       // content width
        const ACCENT = [31, 78, 121];  // #1F4E79-ish
        const TEXT = [26, 58, 92];
        const MUTED = [90, 104, 122];
        const LINE = [209, 220, 232];

        const L = {
            doc: doc,
            pw: pw, ph: ph, m: m, cw: cw,
            y: 30,
            ACCENT: ACCENT,
            TEXT: TEXT,
            MUTED: MUTED,
            LINE: LINE,

            // Track context for the page footer
            resident: '',
            pageNum: 1,
            // Orientation for pages added mid-module (a landscape module that
            // overflows continues on landscape pages). generate() sets it per module.
            orientation: 'portrait',

            // Checkbox glyph that the standard (WinAnsi) fonts render reliably
            cb: function (on) { return on ? '[x]' : '[ ]'; },

            setText: function (rgb, size, style) {
                doc.setTextColor(rgb[0], rgb[1], rgb[2]);
                if (size) doc.setFontSize(size);
                if (style) doc.setFont('helvetica', style);
                // Remember the current text style so addPage() can restore it
                const prev = this._txt || {};
                this._txt = { rgb: rgb, size: size || prev.size, style: style || prev.style };
            },

            pageBreakIfNeeded: function (reserve) {
                if (this.y + (reserve || 0) > ph - 18) this.addPage();
            },
            addPage: function (orientation) {
                // The footer and header strip change the text style (the strip
                // leaves white bold). Callers that break mid-paragraph keep calling
                // doc.text, so restore their style or the rest prints invisibly.
                const prev = this._txt;
                if (orientation) this.orientation = orientation;
                this.addFooter();
                doc.addPage(PAGE_FORMAT, this.orientation === 'landscape' ? 'landscape' : 'portrait');
                pw = doc.internal.pageSize.getWidth();
                ph = doc.internal.pageSize.getHeight();
                cw = pw - m * 2;
                this.pw = pw; this.ph = ph; this.cw = cw;
                this.pageNum += 1;
                this.y = 18;
                this.addHeaderStrip();
                if (prev) this.setText(prev.rgb, prev.size, prev.style);
            },
            addHeaderStrip: function () {
                // Small branding strip on subsequent pages
                doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                doc.rect(0, 0, pw, 8, 'F');
                this.setText([255, 255, 255], 9, 'bold');
                doc.text('Clinical Assessment Packet', m, 5.5);
                if (this.resident) {
                    doc.text(pdfSafe(this.resident), pw - m, 5.5, { align: 'right' });
                }
                this.y = 18;
            },
            addFooter: function () {
                this.setText(MUTED, 8, 'normal');
                doc.text('Page ' + this.pageNum, pw / 2, ph - 8, { align: 'center' });
            },

            // Section heading
            h1: function (text) {
                this.pageBreakIfNeeded(14);
                this.y += 2;
                this.setText(ACCENT, 14, 'bold');
                doc.text(pdfSafe(text), m, this.y);
                this.y += 2;
                doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                doc.setLineWidth(0.4);
                doc.line(m, this.y, m + cw, this.y);
                this.y += 6;
            },
            h2: function (text) {
                this.pageBreakIfNeeded(10);
                this.setText(ACCENT, 11, 'bold');
                // Wrap: some h2s carry student text (concept-map problem names)
                const lines = doc.splitTextToSize(pdfSafe(text), cw);
                lines.forEach(function (ln, ix) {
                    if (ix) {
                        L.y += 5;
                        if (L.y > ph - 18) L.addPage();
                    }
                    doc.text(ln, m, L.y);
                });
                this.y += 6;
            },
            h3: function (text) {
                this.pageBreakIfNeeded(8);
                this.setText(TEXT, 10, 'bold');
                doc.text(pdfSafe(text), m, this.y);
                this.y += 5;
            },

            // Small uppercase label line
            label: function (text) {
                this.pageBreakIfNeeded(5);
                this.setText(MUTED, 8, 'bold');
                doc.text(pdfSafe(String(text || '').toUpperCase()), m, this.y);
                this.y += 4;
            },

            // Wrapped body paragraph
            para: function (text, opts) {
                opts = opts || {};
                const t = pdfSafe(text).trim();
                if (!t) return;
                this.setText(opts.color || TEXT, opts.size || 9.5, opts.style || 'normal');
                const lines = doc.splitTextToSize(t, opts.width || cw);
                const lh = (opts.size || 9.5) * 0.4;
                lines.forEach(function (ln) {
                    if (L.y + lh > ph - 18) L.addPage();
                    doc.text(ln, opts.x != null ? opts.x : m, L.y);
                    L.y += lh;
                });
                L.y += 2;
            },

            // Labeled paragraph (for SBAR-style or Omega entries)
            fieldBlock: function (label, value) {
                if (!value || !String(value).trim()) return;
                this.label(label);
                this.para(value);
            },

            // Inline two-column label: value (for Info section)
            inlineKv: function (label, value, indent) {
                if (!value && value !== 0) return;
                this.pageBreakIfNeeded(5);
                const x = m + (indent || 0);
                label = pdfSafe(label);
                this.setText(MUTED, 9, 'bold');
                doc.text(label + ':', x, this.y);
                const labelW = doc.getTextWidth(label + ':');
                this.setText(TEXT, 9, 'normal');
                const lines = doc.splitTextToSize(pdfSafe(value), cw - labelW - 4);
                doc.text(lines[0] || '', x + labelW + 2, this.y);
                for (let i = 1; i < lines.length; i++) {
                    this.y += 4;
                    if (this.y > ph - 18) this.addPage();
                    doc.text(lines[i], x + labelW + 2, this.y);
                }
                this.y += 5;
            },

            // Score box
            scoreBox: function (num, label, risk, riskLevel) {
                this.pageBreakIfNeeded(14);
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                doc.setLineWidth(0.3);
                doc.roundedRect(m, this.y, cw, 12, 2, 2, 'FD');
                this.setText(ACCENT, 18, 'bold');
                doc.text(pdfSafe(num), m + 5, this.y + 8.5);
                this.setText(TEXT, 9.5, 'bold');
                doc.text(pdfSafe(label), m + 24, this.y + 7.5);
                this.setText(MUTED, 9, 'normal');
                if (risk) doc.text(pdfSafe(risk), pw - m - 4, this.y + 7.5, { align: 'right' });
                this.y += 14;
            },

            // Simple row divider
            divider: function () {
                doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
                doc.setLineWidth(0.2);
                doc.line(m, this.y, m + cw, this.y);
                this.y += 3;
            },

            // Table — borders, header row, wrapping cells
            // opts (optional): { subHeaders: [...] — a second, non-bold header row
            //   (the Word form's column captions), repeated with the header on
            //   each new page; minRowH: mm — minimum body row height, so blank
            //   rows still show a writable cell; boldCols: [i, ...] — body
            //   columns printed bold (row labels); groupRows: [i, ...] — body
            //   rows printed as shaded bold group headings (Lab table's
            //   Chemistry / Hematology…); fontSize: pt, default 8.5 }.
            //   headers = null draws no header row (a label-column grid such
            //   as OMEGA).
            table: function (headers, rows, colWidths, opts) {
                // colWidths sum should = cw (all in mm)
                opts = opts || {};
                const fs = opts.fontSize || 8.5;
                const lineH = opts.fontSize ? fs * 0.47 : 4;
                const padY = 2.5;
                const padX = 1.5;
                const minRowH = opts.minRowH || 0;
                const boldCols = opts.boldCols || [];
                const groupRows = opts.groupRows || [];

                function cellBold(i, bold) { return bold === true || bold === 'group' || (bold === 'body' && boldCols.indexOf(i) !== -1); }
                // bold: true = header row, 'body' = body row (boldCols apply),
                // 'group' = group heading row, false = plain
                function wrapCells(cells, bold) {
                    doc.setFontSize(fs);
                    return cells.map(function (cell, i) {
                        doc.setFont('helvetica', cellBold(i, bold) ? 'bold' : 'normal');
                        return doc.splitTextToSize(pdfSafe(cell == null ? '' : cell), colWidths[i] - padX * 2);
                    });
                }
                function rowHeight(wrapped, body) {
                    let maxLines = 1;
                    wrapped.forEach(function (lines) { if (lines.length > maxLines) maxLines = lines.length; });
                    return Math.max(padY * 2 + maxLines * lineH, body ? minRowH : 0);
                }
                function drawRow(cells, y, bold, fill) {
                    return paintRow(wrapCells(cells, bold), y, bold, fill);
                }
                // Draws already-wrapped cells (one array of lines per column)
                function paintRow(wrapped, y, bold, fill) {
                    const cells = wrapped;
                    const rowH = rowHeight(wrapped, bold === 'body');
                    if (fill) {
                        doc.setFillColor(241, 245, 249);
                        let xCur = m;
                        for (let i = 0; i < cells.length; i++) {
                            doc.rect(xCur, y, colWidths[i], rowH, 'F');
                            xCur += colWidths[i];
                        }
                    }
                    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
                    doc.setLineWidth(0.2);
                    let xCur = m;
                    for (let i = 0; i < cells.length; i++) {
                        doc.rect(xCur, y, colWidths[i], rowH, 'S');
                        const b = cellBold(i, bold);
                        // Sub-header (captions) rows: muted, not bold
                        L.setText(bold === true || bold === 'group' ? ACCENT : (bold === 'sub' ? MUTED : TEXT), bold === 'sub' ? Math.min(7.5, fs) : fs, b ? 'bold' : 'normal');
                        let ty = y + padY + 3;
                        wrapped[i].forEach(function (ln, ix) {
                            doc.text(ln, xCur + padX, ty);
                            ty += lineH;
                        });
                        xCur += colWidths[i];
                    }
                    return rowH;
                }
                // Header row(s): the titles, then the optional caption row
                function drawHeader(y) {
                    let h = 0;
                    if (headers) h += drawRow(headers, y, true, true);
                    if (opts.subHeaders) {
                        doc.setFontSize(Math.min(7.5, fs));
                        doc.setFont('helvetica', 'normal');
                        const w = opts.subHeaders.map(function (c, i) {
                            return doc.splitTextToSize(pdfSafe(c || ''), colWidths[i] - padX * 2);
                        });
                        h += paintRow(w, y + h, 'sub', true);
                    }
                    return h;
                }

                // Header
                this.pageBreakIfNeeded(headers || opts.subHeaders ? 20 : 12);
                const hdrH = drawHeader(this.y);
                this.y += hdrH;
                // Rows — measured before drawing. A row that doesn't fit moves to
                // a new page; a row taller than a whole page is split across pages.
                const bottom = ph - 18;
                function newTablePage() {
                    L.addPage();
                    L.y += drawHeader(L.y); // re-draw header
                }
                rows.forEach(function (row, ri) {
                    const kind = groupRows.indexOf(ri) !== -1 ? 'group' : 'body';
                    let wrapped = wrapCells(row, kind);
                    for (let guard = 0; guard < 50; guard++) {
                        const need = rowHeight(wrapped, kind === 'body');
                        const avail = bottom - L.y;
                        if (need <= avail) { L.y += paintRow(wrapped, L.y, kind, kind === 'group'); return; }
                        const fullPage = bottom - 18 - hdrH;
                        const fit = Math.floor((avail - padY * 2) / lineH);
                        if (need <= fullPage || fit < 3) { newTablePage(); continue; }
                        L.y += paintRow(wrapped.map(function (c) { return c.slice(0, fit); }), L.y, kind, kind === 'group');
                        wrapped = wrapped.map(function (c) { return c.slice(fit); });
                        newTablePage();
                    }
                });
                this.y += 3;
            },

            // Image (Mini-Cog clock)
            image: function (dataUrl, width, height) {
                if (!dataUrl) return;
                const h = height || 60;
                const w = width || 60;
                this.pageBreakIfNeeded(h + 4);
                try {
                    doc.addImage(dataUrl, 'PNG', (pw - w) / 2, this.y, w, h);
                    this.y += h + 4;
                } catch (e) {
                    // bad data url, skip
                }
            },

            spacer: function (amt) { this.y += amt || 4; }
        };
        return L;
    }

    // ------------------------------------------------------------------
    // Title page / header
    // ------------------------------------------------------------------
    function drawCoverPage(L, packet) {
        const info = (packet.state && packet.state.info) || {};
        const meta = packet.meta || {};
        const title = meta.title || packetFallbackTitle(packet);
        L.resident = info.res_initials || meta.residentInitials || '';

        L.doc.setFillColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
        L.doc.rect(0, 0, L.pw, 34, 'F');
        L.setText([255, 255, 255], 18, 'bold');
        L.doc.text('Clinical Assessment Packet', L.pw / 2, 16, { align: 'center' });
        L.setText([255, 255, 255], 11, 'normal');
        // Up to two lines inside the 34 mm banner; longer titles are cut short
        const titleLines = L.doc.splitTextToSize(pdfSafe(title), L.cw);
        L.doc.text(titleLines[0] || '', L.pw / 2, 24, { align: 'center' });
        if (titleLines[1]) {
            L.doc.text(titleLines[1] + (titleLines.length > 2 ? '...' : ''), L.pw / 2, 29.5, { align: 'center' });
        }

        // Word-form subtitle + which revision of the form this mirrors
        L.setText(L.TEXT, 10.5, 'italic');
        L.doc.text('To be turned in as the evidence for your patient concept map.', L.pw / 2, 41, { align: 'center' });
        L.setText(L.MUTED, 8, 'normal');
        L.doc.text(pdfSafe('Aligned to ' + FORM.NAME + ' (' + FORM.VERSION + ')'), L.pw / 2, 46, { align: 'center' });

        L.y = 52;

        // Info box — sized to its rows. They are measured first because the
        // filled box has to be drawn before the text (it would cover it after).
        const coverRows = [
            ['Student', info.student_name || ''],
            ['Date', info.date || meta.date || ''],
            ['Course', info.course || meta.course || ''],
            ['Site', info.site || meta.site || ''],
            ['Instructor', info.instructor || ''],
            [PersonCap() + ' Initials', info.res_initials || meta.residentInitials || '']
        ];
        let rowsH = 0;
        coverRows.forEach(function (r) {
            if (!r[1] && r[1] !== 0) return;
            L.setText(L.MUTED, 9, 'bold');
            const lw = L.doc.getTextWidth(pdfSafe(r[0]) + ':');
            L.setText(L.TEXT, 9, 'normal');
            const n = L.doc.splitTextToSize(pdfSafe(r[1]), L.cw - lw - 4).length || 1;
            rowsH += 5 + (n - 1) * 4; // same advance as inlineKv
        });
        const boxH = Math.max(30, rowsH + 6);
        L.doc.setFillColor(248, 250, 252);
        L.doc.setDrawColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
        L.doc.setLineWidth(0.3);
        L.doc.roundedRect(L.m, L.y, L.cw, boxH, 2, 2, 'FD');
        const startY = L.y;
        L.y += 6;
        coverRows.forEach(function (r) { L.inlineKv(r[0], r[1]); });
        L.y = startY + boxH + 4;
    }

    function packetFallbackTitle(p) {
        const meta = p.meta || {};
        const parts = [];
        if (meta.residentInitials) parts.push(meta.residentInitials);
        if (meta.date) parts.push(meta.date);
        if (meta.site) parts.push(meta.site);
        return parts.join(' · ') || 'Untitled packet';
    }

    // ------------------------------------------------------------------
    // Per-module PDF renderers
    // ------------------------------------------------------------------
    const R_PDF = {};

    R_PDF.info = function (L, s) {
        // Student, Date, Course, Site, Instructor and Patient Initials are
        // already in the cover box printed directly above — only add the rest.
        L.h1('Patient Info');
        L.inlineKv('Shift', s.shift);
        L.spacer(4);
        L.h3(PersonCap());
        L.inlineKv('Age', s.res_age);
        L.inlineKv('DOB', s.res_dob);
        L.inlineKv('Room', s.res_room);
        L.inlineKv('Attending Physician', s.res_physician);
        L.inlineKv('Primary Diagnosis', s.res_dx);
    };

    // TABLE 1 / TABLE 2 — all 12 rows as a 3-column grid, blanks included.
    // ctx (3rd arg) is set for the Day 2 instance (omega2).
    R_PDF.omega = function (L, s, ctx) {
        ctx = ctx || {};
        L.h1(ctx.day ? 'OMEGA-7 Assessment — Day ' + ctx.day + ' (Disregard for Five-Week Courses)' : 'OMEGA-7 Assessment');
        s = s || {};
        const rows = FORM.OMEGA_ROWS.map(function (r) {
            const v = s[r.key];
            return [r.letter, r.label, v == null ? '' : String(v)];
        });
        L.table(null, rows, scaleRow([10, 28, 136], L.cw), { minRowH: 12, boldCols: [0, 1] });
    };

    // TABLE 4 — the Word column titles, with its captions as a second header
    // row. Blank rows print (padded to at least 3) so the grid is visible.
    R_PDF.meds = function (L, s) {
        L.h1('Medications');
        const COLS = FORM.MED_COLUMNS;
        const rows = (s.rows || []).filter(function (r) {
            return r && COLS.some(function (c) { return r[c.key] != null && String(r[c.key]).trim() !== ''; });
        });
        const tableRows = rows.map(function (r) {
            return COLS.map(function (c) { return r[c.key] == null ? '' : String(r[c.key]); });
        });
        while (tableRows.length < 3) tableRows.push(COLS.map(function () { return ''; }));
        const headers = COLS.map(function (c) { return c.title; });
        const captions = COLS.map(function (c) { return c.caption; });
        // Nursing Implications gets the most room (patient-specific detail)
        L.table(headers, tableRows, scaleRow([30, 15, 28, 27, 29, 40], L.cw), { subHeaders: captions, minRowH: 12 });
    };

    function scaleRow(widths, cw) {
        const sum = widths.reduce(function (a, b) { return a + b; }, 0);
        return widths.map(function (w) { return w * cw / sum; });
    }

    // Date input values (YYYY-MM-DD) print as M/D/YYYY, or M/D/YY for the
    // narrow Braden columns; anything else prints as typed.
    function pdfDate(v, short) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v == null ? '' : v));
        if (!m) return String(v == null ? '' : v);
        return (+m[2]) + '/' + (+m[3]) + '/' + (short ? m[1].slice(2) : m[1]);
    }
    function personText(t) { return PERSON === 'patient' ? t : String(t).replace(/\bpatient\b/g, PERSON); }

    // Morse Fall Scale — the Word grid: one row per option, the three dated
    // columns marked with the option picked, then Total and Signature & Status.
    // Old single-score packets are read through CAP_MODULES.readMorse().
    R_PDF.morse = function (L, s) {
        const M = FORM.MORSE;
        L.h1(M.TITLE);
        L.para(M.INTRO, { size: 9 });
        const view = CAP.readMorse(s);
        const cols = M.COLS.map(function (c) { return view.cols[c.key]; });
        const rows = [];
        function mark(col, v, o) { return col.choices[v.id] === o.val ? L.cb(true) + ' ' + o.val : ''; }
        M.VARS.forEach(function (v) {
            if (v.stacked) {
                // One row, one line per option (No / Yes), marks on the matching line
                rows.push([v.name,
                    v.opts.map(function (o) { return o.label; }).join('\n'),
                    v.opts.map(function (o) { return String(o.val); }).join('\n')
                ].concat(cols.map(function (col) {
                    return v.opts.map(function (o) { return mark(col, v, o); }).join('\n');
                })));
                return;
            }
            v.opts.forEach(function (o, oi) {
                rows.push([oi === 0 ? v.name : '', o.label, String(o.val)].concat(cols.map(function (col) { return mark(col, v, o); })));
            });
        });
        rows.push(['Total', '', ''].concat(cols.map(function (col) {
            const sc = CAP.scoreMorse(col.choices);
            return sc.n ? sc.total + '\n' + sc.label : 'Not scored';
        })));
        rows.push([M.SIGNATURE, '', ''].concat(cols.map(function (col) { return col.signature || ''; })));
        L.table(['Variables', '', 'Score'].concat(M.COLS.map(function (c) { return c.label; })), rows,
            scaleRow([26, 44, 12, 32, 32, 32], L.cw),
            { subHeaders: ['Date', '', ''].concat(cols.map(function (col) { return pdfDate(col.date); })), boldCols: [0] });
        L.spacer(2);
        L.para(M.HOWTO, { size: 9 });
        L.table(['Morse Fall Score', ''], M.BANDS.map(function (b) { return [b.label, b.range]; }), [40, 32], { boldCols: [0] });
    };

    // Braden Scale (TABLE 5) on a landscape page: the full descriptor grid,
    // one score column per assessment (1–4) with its date, the TOTAL SCORE
    // row, then the ASSESS | DATE | EVALUATOR SIGNATURE/TITLE table.
    // Old single-assessment packets are read through readBraden() as Assess 1.
    R_PDF.braden = function (L, s) {
        const B = FORM.BRADEN;
        L.h1(B.TITLE);
        const view = CAP.readBraden(s);
        const cols = B.COLS.map(function (c) { return view.cols[c.key]; });
        L.para(B.LEGEND, { size: 8.5, style: 'bold' });
        const rows = B.FACTORS.map(function (f) {
            const head = f.name.toUpperCase() + (f.defn ? '\n' + f.defn : '') + (f.footnotes ? '\n' + B.FOOTNOTES.join('\n') : '');
            const descs = [0, 1, 2, 3].map(function (i) {
                const o = f.opts[i];
                return o ? o.val + '. ' + o.title + ' – ' + o.desc : '';
            });
            return [head].concat(descs, cols.map(function (col) {
                const x = col.choices[f.id];
                return x == null ? '' : String(x);
            }));
        });
        rows.push(['TOTAL SCORE', B.HIGH_RISK, '', '', ''].concat(cols.map(function (col) {
            const sc = CAP.scoreBraden(col.choices);
            return sc.n ? String(sc.total) : '';
        })));
        L.table(['RISK FACTOR', 'SCORE/DESCRIPTION', '', '', ''].concat(B.COLS.map(function (c) { return c.num; })), rows,
            scaleRow([26, 41, 41, 41, 41, 15, 15, 15, 15], L.cw),
            { subHeaders: ['DATE OF ASSESS', '', '', '', ''].concat(cols.map(function (col) { return pdfDate(col.date, true); })),
              fontSize: 7.5, minRowH: 10 });
        // Band per assessment (not on the paper form, which leaves it to the grader)
        L.spacer(2);
        L.para(B.COLS.map(function (c, i) {
            const sc = CAP.scoreBraden(cols[i].choices);
            return 'Assess ' + c.num + ': ' + (sc.n ? 'Total ' + sc.total + ' — ' + sc.label : 'Not scored');
        }).join('   ·   '), { size: 8.5, style: 'bold' });
        L.table(['ASSESS', 'DATE', B.EVALUATOR.toUpperCase(), 'ASSESS.', 'DATE', B.EVALUATOR.toUpperCase()], [
            ['1', pdfDate(cols[0].date), cols[0].evaluator, '3', pdfDate(cols[2].date), cols[2].evaluator],
            ['2', pdfDate(cols[1].date), cols[1].evaluator, '4', pdfDate(cols[3].date), cols[3].evaluator]
        ], scaleRow([18, 24, 80, 18, 24, 80], L.cw), { minRowH: 9 });
        L.para(B.COPYRIGHT, { size: 7.5, style: 'italic', color: L.MUTED });
    };
    R_PDF.braden.orientation = 'landscape';

    // Mini-Cog — every line of the Patient Cognitive Assessment Form, the
    // words remembered as checkboxes, and each score (or '—').
    R_PDF.minicog = function (L, s) {
        const MC = FORM.MINICOG;
        const v = CAP.readMinicog(s);
        L.h1(MC.TITLE);
        MC.STEPS.forEach(function (t, i) { L.para((i + 1) + '. ' + personText(t), { size: 9 }); });
        L.h3('Clock Drawing');
        if (s.clockPng) L.image(s.clockPng, 70, 70);
        else {
            // No drawing saved: leave a 70 x 70 mm space with a circle guide,
            // like the paper form, so the clock can be drawn by hand.
            L.para('(no clock drawing attached — draw the clock in the space below)', { size: 8, color: L.MUTED, style: 'italic' });
            L.pageBreakIfNeeded(74);
            const bx = (L.pw - 70) / 2;
            L.doc.setDrawColor(L.MUTED[0], L.MUTED[1], L.MUTED[2]);
            L.doc.setLineWidth(0.2);
            L.doc.rect(bx, L.y, 70, 70, 'S');
            L.doc.setLineWidth(0.3);
            L.doc.circle(bx + 35, L.y + 35, 30, 'S');
            L.y += 74;
        }
        L.spacer(2);
        L.label('Scoring');
        L.para('1. ' + MC.SCORE_WORDS, { size: 9 });
        L.inlineKv('Words remembered', MC.WORDS.map(function (w) { return L.cb(v.words[w.key]) + ' ' + w.label; }).join('     '));
        if (!(s.words && typeof s.words === 'object') && v.recall != null) {
            L.para('(Which words were remembered was not recorded; the score was entered as a number.)', { size: 8, color: L.MUTED, style: 'italic' });
        }
        L.inlineKv(MC.RECALL_LABEL, v.recall == null ? '—' : String(v.recall));
        L.spacer(1);
        L.para('2. ' + MC.SCORE_CLOCK, { size: 9 });
        L.inlineKv(MC.CLOCK_LABEL, v.clock == null ? '—' : String(v.clock));
        L.spacer(1);
        let total = '—';
        if (v.recall != null && v.clock != null) total = v.total + ' — ' + v.label;
        else if (v.total != null) total = v.total + ' (incomplete — ' + (v.recall == null ? 'word recall' : 'clock drawing') + ' not scored)';
        L.inlineKv(MC.TOTAL_LABEL, total);
        if (s.notes) { L.spacer(2); L.fieldBlock('Additional Notes', s.notes); }
    };

    R_PDF.behavior = function (L, s) {
        L.h1('Behavioral Assessment (ABC)');
        const events = (s.events || []).filter(function (e) {
            return e && (e.behavior || e.ant_going_on || e.cons_interaction || e.interventions);
        });
        if (!events.length) { L.para('(no events logged)', { color: L.MUTED, style: 'italic' }); return; }
        events.forEach(function (e, i) {
            L.h2('Event ' + (i + 1));
            if (e.date || e.time || e.location) {
                L.inlineKv('When', [e.date, e.time].filter(Boolean).join(' '));
                if (e.location) L.inlineKv('Where', e.location);
            }
            L.fieldBlock('B — Behavior', e.behavior);
            if (e.duration) L.inlineKv('Duration', e.duration);
            L.fieldBlock('A — Antecedent: what was going on', e.ant_going_on);
            L.fieldBlock('A — Antecedent: what else', e.ant_what_else);
            L.fieldBlock('C — Consequence: interaction', e.cons_interaction);
            L.fieldBlock('C — Consequence: what else', e.cons_what_else);
            L.fieldBlock('Interventions', e.interventions);
            L.fieldBlock('Effect', e.effect);
            L.divider();
        });
    };

    // TABLE 6 — the Word form's 7 rows (prompt | step | answer), every prompt
    // printed, blank answers left as an empty cell. Old 6-box packets are
    // read through CAP_MODULES.readNcsbn().
    R_PDF.ncsbn = function (L, s) {
        L.h1('Six Steps of the NCSBN Clinical Judgment Model');
        const boxes = (CAP && CAP.readNcsbn) ? CAP.readNcsbn(s) : {};
        // An old 6-box packet answered both Step 3 prompts (and both Evaluate
        // prompts) in one box, which readNcsbn() puts in the first row of each
        // pair. Say so in the second row instead of printing it blank.
        const oldShape = !(s && s._schema >= 3) && !(s && s.boxes && typeof s.boxes === 'object') &&
            !!(s && s.steps && typeof s.steps === 'object');
        if (oldShape) {
            [['s3a', 's3b'], ['s6a', 's6b']].forEach(function (p) {
                if (String(boxes[p[0]] || '').trim() && !String(boxes[p[1]] || '').trim()) {
                    boxes[p[1]] = '(answered together with the row above)';
                }
            });
        }
        const rows = FORM.NCSBN_ROWS.map(function (r) {
            return [r.prompt, r.step, boxes[r.key] || ''];
        });
        L.table(null, rows, scaleRow([34, 18, 48], L.cw), { minRowH: 22, boldCols: [1] });
    };

    R_PDF.progressNotes = function (L, s) {
        L.h1('Nurses Progress Notes');
        const notes = (s.notes || []).filter(function (n) {
            return n && (n.d || n.a || n.r || n.p || n.narrative || n.s || n.o || n.i || n.e);
        });
        if (!notes.length) { L.para('(no notes)', { color: L.MUTED, style: 'italic' }); return; }
        notes.forEach(function (n, idx) {
            L.h2('Note ' + (idx + 1) + ' — ' + (n.format || 'DARP'));
            if (n.date || n.time || n.focus) {
                const line = [n.date, n.time, n.focus].filter(Boolean).join(' · ');
                L.para(line, { size: 9, style: 'italic', color: L.MUTED });
            }
            const fmt = n.format || 'DARP';
            const fields = ({
                'DAR':       [['d','Data'],['a','Action'],['r','Response']],
                'DARP':      [['d','Data'],['a','Action'],['r','Response'],['p','Plan']],
                'Narrative': [['narrative','Narrative']],
                'SOAP':      [['s','Subjective'],['o','Objective'],['a','Assessment'],['p','Plan']],
                'PIE':       [['p','Problem'],['i','Intervention'],['e','Evaluation']],
                'SOAPIE':    [['s','Subjective'],['o','Objective'],['a','Assessment'],['p','Plan'],['i','Intervention'],['e','Evaluation']]
            })[fmt] || [];
            fields.forEach(function (f) { L.fieldBlock(f[1], n[f[0]]); });
            L.divider();
        });
    };

    R_PDF.carePlan = function (L, s) {
        L.h1('Nursing Care Plan');
        L.fieldBlock('OMEGA-7 / Assessment Finding', s.finding);
        L.fieldBlock('Nursing Diagnostic Statement', s.dx);
        if (s.st_goal || s.st_assess_intervention || s.st_do_intervention || s.st_teach_intervention) {
            L.h2('Short-Term Goal');
            L.fieldBlock('Goal', s.st_goal);
            L.h3('Assess'); L.fieldBlock('Intervention', s.st_assess_intervention); L.fieldBlock('Rationale', s.st_assess_rationale);
            L.h3('Do');     L.fieldBlock('Intervention', s.st_do_intervention);     L.fieldBlock('Rationale', s.st_do_rationale);
            L.h3('Teach');  L.fieldBlock('Intervention', s.st_teach_intervention);  L.fieldBlock('Rationale', s.st_teach_rationale);
        }
        if (s.lt_goal || s.lt_assess_intervention || s.lt_do_intervention || s.lt_teach_intervention) {
            L.h2('Long-Term Goal');
            L.fieldBlock('Goal', s.lt_goal);
            L.h3('Assess'); L.fieldBlock('Intervention', s.lt_assess_intervention); L.fieldBlock('Rationale', s.lt_assess_rationale);
            L.h3('Do');     L.fieldBlock('Intervention', s.lt_do_intervention);     L.fieldBlock('Rationale', s.lt_do_rationale);
            L.h3('Teach');  L.fieldBlock('Intervention', s.lt_teach_intervention);  L.fieldBlock('Rationale', s.lt_teach_rationale);
        }
        L.fieldBlock('Summary of Care', s.summary);
    };

    R_PDF.sbar = function (L, s) {
        L.h1('SBAR Report Sheet');
        L.h2('S — Situation');
        L.fieldBlock('Situation of concern', s.situation);

        L.h2('B — Background');
        L.fieldBlock('Brief History', s.background);
        if (s.allergies) L.inlineKv('Allergies', s.allergies);
        if (s.code) L.inlineKv('Code Status', s.code);

        L.h2('A — Assessment');
        const vitals = [s.bp && 'BP ' + s.bp, s.hr && 'HR ' + s.hr, s.rr && 'RR ' + s.rr,
                        s.temp && 'T ' + s.temp, s.spo2 && 'SpO₂ ' + s.spo2].filter(Boolean).join(' · ');
        if (vitals) L.inlineKv('Vitals', vitals);
        if (s.o2) L.inlineKv('O₂ Requirements', s.o2);
        if (s.nausea) L.inlineKv('Nausea', s.nausea);
        if (s.pain_level) L.inlineKv('Pain', s.pain_level + '/10' + (s.pain_location ? ' at ' + s.pain_location : '') + (s.pain_description ? ' — ' + s.pain_description : ''));
        if (s.iv) L.inlineKv('IV Access', s.iv);
        if (s.fluids) L.inlineKv('Fluids', s.fluids);
        L.fieldBlock('Procedures / Scans', s.procedures);
        L.fieldBlock('Labs & Results', s.labs);
        if (s.ambulatory) L.inlineKv('Ambulatory', s.ambulatory);
        if (s.fall_risk) L.inlineKv('Fall Risk', s.fall_risk);
        if (s.loc) L.inlineKv('LOC', s.loc);
        L.fieldBlock('Wounds / Drains / Ostomies', s.wounds);
        L.fieldBlock('Other Assessments', s.other);
        L.fieldBlock('Interventions Implemented', s.interventions);

        L.h2('R — Recommendations');
        L.fieldBlock('Recommended Action', s.recommendation);
        L.fieldBlock('Other / Orders Received', s.orders);
    };

    R_PDF.notes = function (L, s) {
        L.h1('General Notes');
        L.para(s.text || '(none)', { size: 10, color: s.text ? L.TEXT : L.MUTED });
    };

    // ------------------------------------------------------------------
    // HEAD-TO-TOE (FORM.H2T) — every item of the Word form, region by region
    // in its two-column layout (General | Upper Extremities, Head | Lower
    // Extremities, …): checkboxes as [x]/[ ], blanks as a drawn line. A row
    // whose two regions don't fit side by side on a page (long answers)
    // prints them one after the other, full width, breaking across pages.
    // Old packets' free-text systems print as "Previous notes" in the
    // matching region (CAP_MODULES.readHeadToToe).
    // ------------------------------------------------------------------
    const H2T_FS = 8.5;     // item text size (pt)
    const H2T_LH = 3.8;     // line advance (mm)
    const H2T_BASE = 2.9;   // baseline offset from the line top (mm)

    // Body diagram as vector outlines (same shapes as the editor's SVG).
    // Returns the height used; draws only when `draw` is true.
    function drawBodyDiagram(L, x, y, w, markers, draw) {
        const doc = L.doc;
        const B = (FORM.H2T && FORM.H2T.BODY) || { VIEWS: [], VIEW_BY_KEY: {} };
        const vw = Math.min(28, w * 0.36);          // front/back figure width (mm)
        const vh = vw * 2.16;
        const sq = Math.min(26, w * 0.34);          // head / feet box (mm)
        const gap = Math.min(10, w * 0.12);
        const lblH = 4;
        const cx = x + w / 2;
        const pos = {
            front: { x: cx - gap / 2 - vw, y: y, s: vw / 100 },
            back:  { x: cx + gap / 2,      y: y, s: vw / 100 },
            head:  { x: cx - gap / 2 - sq, y: y + vh + lblH + 2, s: sq / 100 },
            feet:  { x: cx + gap / 2,      y: y + vh + lblH + 2, s: sq / 100 }
        };
        const h = vh + lblH + 2 + sq + lblH;
        if (!draw) return h;
        doc.setDrawColor(L.MUTED[0], L.MUTED[1], L.MUTED[2]);
        doc.setLineWidth(0.25);
        B.VIEWS.forEach(function (v) {
            const o = pos[v.key];
            if (!o) return;
            function X(px) { return o.x + px * o.s; }
            function Y(py) { return o.y + py * o.s; }
            v.shapes.forEach(function (sh) {
                if (sh.e) {
                    doc.ellipse(X(sh.e[0]), Y(sh.e[1]), Math.max(0.2, sh.e[2] * o.s), Math.max(0.2, sh.e[3] * o.s), 'S');
                } else if (sh.l) {
                    for (let i = 1; i < sh.l.length; i++) doc.line(X(sh.l[i - 1][0]), Y(sh.l[i - 1][1]), X(sh.l[i][0]), Y(sh.l[i][1]));
                } else if (sh.p && CAP.bodyCurves) {
                    // jsPDF lines(): each Bézier segment relative to the previous end point
                    let px = X(sh.p[0][0]), py = Y(sh.p[0][1]);
                    const segs = CAP.bodyCurves(sh.p, sh.closed).map(function (sg) {
                        const seg = [X(sg.c1[0]) - px, Y(sg.c1[1]) - py, X(sg.c2[0]) - px, Y(sg.c2[1]) - py, X(sg.p[0]) - px, Y(sg.p[1]) - py];
                        px = X(sg.p[0]); py = Y(sg.p[1]);
                        return seg;
                    });
                    doc.lines(segs, X(sh.p[0][0]), Y(sh.p[0][1]), [1, 1], 'S', !!sh.closed);
                }
            });
            L.setText(L.MUTED, 7, 'normal');
            doc.text(pdfSafe(v.label), X(v.w / 2), Y(v.h) + 3.5, { align: 'center' });
            if (v.sides) {
                doc.text(v.sides[0], X(0), Y(62));
                doc.text(v.sides[1], X(v.w), Y(62), { align: 'right' });
            }
        });
        // Numbered markers
        markers.forEach(function (m, i) {
            const v = B.VIEW_BY_KEY[m.view];
            const o = pos[m.view];
            if (!v || !o || m.x == null || m.y == null) return; // listed only, not placed
            const mx = o.x + m.x * v.w * o.s, my = o.y + m.y * v.h * o.s;
            doc.setFillColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.2);
            doc.circle(mx, my, 1.9, 'FD');
            L.setText([255, 255, 255], i + 1 > 9 ? 5 : 6, 'bold');
            doc.text(String(i + 1), mx, my + 0.75, { align: 'center' });
        });
        return h;
    }

    // One region at (x, w). mode: 'measure' (height only), 'draw' (at L.y,
    // no page breaks — the caller made room) or 'flow' (from L.y, breaking
    // pages as needed; leaves L.y below the region). Returns the height.
    function h2tRegion(L, region, view, x, w, mode) {
        const doc = L.doc;
        const draw = mode !== 'measure';
        const vals = view.values;
        let y = L.y;
        const y0 = y;
        function room(hh) {
            if (mode === 'flow' && y + hh > L.ph - 18) { L.addPage(); y = L.y; }
        }
        function font(style, rgb, size) { L.setText(rgb || L.TEXT, size || H2T_FS, style || 'normal'); }
        // quiet = measuring a grid row inside a drawing pass: advance y only
        let quiet = false;
        function tw(t) { return doc.getTextWidth(pdfSafe(t)); }
        function put(t, tx, ty, opt) { if (draw && !quiet) doc.text(pdfSafe(t), tx, ty, opt); }
        function blank(x1, x2, base) {
            if (!draw || quiet || x2 - x1 < 2) return;
            doc.setDrawColor(L.MUTED[0], L.MUTED[1], L.MUTED[2]);
            doc.setLineWidth(0.2);
            doc.line(x1, base + 0.8, x2, base + 0.8);
        }
        // Label + value (wrapped) or a blank line. breakable = may page-break
        // between its lines (flow mode); grid cells pass false.
        function textItem(label, value, xL, wL, breakable) {
            const v = value == null ? '' : String(value);
            font('bold');
            const lw = label ? tw(label) + 2 : 0;
            const below = !!label && (wL - lw) < wL * 0.4;
            font('normal');
            const valW = below ? wL - 3 : wL - lw;
            const lines = v.trim() ? doc.splitTextToSize(pdfSafe(v), valW) : [];
            if (breakable) room(H2T_LH);
            if (label) { font('bold'); put(label, xL, y + H2T_BASE); }
            if (!lines.length) {
                blank(xL + (below ? 3 : lw), xL + wL, below ? y + H2T_LH + H2T_BASE : y + H2T_BASE);
                y += below ? H2T_LH * 2 : H2T_LH;
            } else {
                if (below) y += H2T_LH;
                lines.forEach(function (ln, i) {
                    if (i > 0 || below) { if (breakable) room(H2T_LH); }
                    font('normal');
                    put(ln, below ? xL + 3 : xL + lw, y + H2T_BASE);
                    y += H2T_LH;
                });
            }
            y += 0.7;
        }
        // Label then the options as [x]/[ ] tokens, wrapping; ticked ones bold.
        function checksItem(it, xL, wL) {
            const v = vals[it.id];
            font('bold');
            let lw = it.label ? tw(it.label) + 2 : 0;
            room(H2T_LH);
            if (it.label) put(it.label, xL, y + H2T_BASE);
            if (lw > wL * 0.45) { y += H2T_LH; room(H2T_LH); lw = 3; }
            const start = xL + lw;
            let cx = start;
            it.opts.forEach(function (o) {
                const on = it.single ? v === o.key : !!(v && v[o.key]);
                const tok = L.cb(on) + ' ' + o.label;
                font(on ? 'bold' : 'normal', on ? L.ACCENT : L.TEXT);
                const t = tw(tok);
                if (cx > start && cx + t > xL + wL) { y += H2T_LH; room(H2T_LH); cx = start; }
                put(tok, cx, y + H2T_BASE);
                cx += t + 3.5;
            });
            y += H2T_LH + 0.7;
        }
        // A row of short fields (Vitals). Falls back to one field per line
        // when an answer is too long to sit in the row.
        function inlineItem(it, xL, wL) {
            const fields = it.fields.map(function (f) {
                if (f.ids) {
                    const a = String(vals[f.ids[0]] || '').trim(), b = String(vals[f.ids[1]] || '').trim();
                    return { label: f.label, value: (a || b) ? (a || '___') + ' ' + (f.sep || '/') + ' ' + (b || '___') : '', split: true, sep: f.sep || '/' };
                }
                return { label: f.label, value: String(vals[f.id] || '').trim() };
            });
            font('normal');
            const tooLong = fields.some(function (f) { return f.value && tw(f.value) > wL * 0.5; });
            if (tooLong) {
                if (it.label) { room(H2T_LH); font('bold'); put(it.label, xL, y + H2T_BASE); y += H2T_LH; }
                fields.forEach(function (f) { textItem(f.label, f.value, xL + 3, wL - 3, true); });
                return;
            }
            room(H2T_LH);
            font('bold');
            const lw = it.label ? tw(it.label) + 2 : 0;
            if (it.label) put(it.label, xL, y + H2T_BASE);
            const start = xL + lw;
            let cx = start;
            fields.forEach(function (f) {
                font('bold');
                const flw = tw(f.label) + 1.5;
                font('normal');
                const blankW = f.split ? 17 : 12;
                const t = flw + (f.value ? tw(f.value) : blankW);
                if (cx > start && cx + t > xL + wL) { y += H2T_LH; room(H2T_LH); cx = start; }
                font('bold');
                put(f.label, cx, y + H2T_BASE);
                font('normal');
                if (f.value) put(f.value, cx + flw, y + H2T_BASE);
                else if (f.split) {
                    blank(cx + flw, cx + flw + 7, y + H2T_BASE);
                    put(f.sep, cx + flw + 8, y + H2T_BASE);
                    blank(cx + flw + 10, cx + flw + 17, y + H2T_BASE);
                } else blank(cx + flw, cx + flw + blankW, y + H2T_BASE);
                cx += t + 4;
            });
            y += H2T_LH + 0.7;
        }
        function groupLabel(label, xL) {
            room(H2T_LH);
            font('bold');
            put(label, xL, y + H2T_BASE);
            y += H2T_LH;
        }
        function item(it, xL, wL) {
            const ind = it.sub ? 4 : 0;
            if (it.type === 'text') textItem(it.label, vals[it.id], xL + ind, wL - ind, true);
            else if (it.type === 'checks') checksItem(it, xL + ind, wL - ind);
            else if (it.type === 'inline') inlineItem(it, xL, wL);
            else if (it.type === 'group') {
                groupLabel(it.label, xL);
                it.items.forEach(function (x2) { item(Object.assign({}, x2, { sub: true }), xL, wL); });
            } else if (it.type === 'grid') {
                groupLabel(it.label, xL);
                const cols = it.cols || 2;
                const cw2 = (wL - 4 - (cols - 1) * 3) / cols;
                for (let i = 0; i < it.fields.length; i += cols) {
                    const row = it.fields.slice(i, i + cols);
                    const cellX = function (ci) { return xL + 4 + ci * (cw2 + 3); };
                    // Measure the row (nothing painted), make room, then paint
                    // every cell from the same top.
                    let top = y, rowH = 0;
                    quiet = true;
                    row.forEach(function (f, ci) {
                        y = top;
                        textItem(f.label, vals[f.id], cellX(ci), cw2, false);
                        rowH = Math.max(rowH, y - top);
                    });
                    quiet = false;
                    y = top;
                    if (mode === 'flow' && rowH > L.ph - 42) {
                        // Taller than a whole page: side-by-side cells can't
                        // break, so print this row's cells one after another,
                        // full width, breaking pages between lines.
                        row.forEach(function (f) { textItem(f.label, vals[f.id], xL + 4, wL - 4, true); });
                        continue;
                    }
                    room(rowH);
                    top = y;
                    row.forEach(function (f, ci) {
                        y = top;
                        textItem(f.label, vals[f.id], cellX(ci), cw2, false);
                    });
                    y = top + rowH;
                }
            } else if (it.type === 'body') {
                const markers = view.markers;
                const dh = drawBodyDiagram(L, xL, y, wL, markers, false);
                room(dh + 2);
                drawBodyDiagram(L, xL, y + 1, wL, markers, draw);
                y += dh + 2;
                if (!markers.length) {
                    room(H2T_LH);
                    font('italic', L.MUTED, 8);
                    put('Markers: none', xL, y + H2T_BASE);
                    y += H2T_LH + 0.7;
                } else {
                    markers.forEach(function (m, i) {
                        const vv = (FORM.H2T.BODY.VIEW_BY_KEY || {})[m.view];
                        const off = m.x == null || m.y == null;
                        textItem((i + 1) + '. ' + (vv ? vv.label : m.view) + (off ? ' (not marked on figure)' : '') + ':', m.note, xL, wL, true);
                    });
                }
            }
        }

        // Region heading
        room(9);
        L.setText(L.ACCENT, 10.5, 'bold');
        put(region.title, x, y + 3.6);
        if (draw) {
            doc.setDrawColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
            doc.setLineWidth(0.3);
            doc.line(x, y + 5.2, x + w, y + 5.2);
        }
        y += 7.5;
        region.items.forEach(function (it) { item(it, x, w); });
        view.legacy.filter(function (l) { return l.region === region.id; }).forEach(function (l) {
            y += 1;
            textItem('Previous notes — ' + l.label + ':', l.text, x, w, true);
        });
        const h = y - y0;
        if (mode === 'flow') L.y = y;
        return h;
    }

    // ctx (3rd arg) is set for the Day 2 instance (headToToe2): ctx.title.
    R_PDF.headToToe = function (L, s, ctx) {
        ctx = ctx || {};
        const H = FORM.H2T;
        L.h1(ctx.title || (H && H.TITLE) || 'Head-to-Toe Assessment');
        if (!H || !CAP.readHeadToToe) {
            L.para('(Head-to-Toe form definition not loaded)', { color: L.MUTED, style: 'italic' });
            return;
        }
        const view = CAP.readHeadToToe(s);
        const gap = 6;
        const colW = (L.cw - gap) / 2;
        H.PAIRS.forEach(function (pair) {
            const left = pair[0], right = pair[1];
            const hL = left ? h2tRegion(L, left, view, L.m, colW, 'measure') : 0;
            const hR = right ? h2tRegion(L, right, view, L.m + colW + gap, colW, 'measure') : 0;
            const hh = Math.max(hL, hR);
            const bottom = L.ph - 18;
            if (L.y + hh > bottom && hh <= bottom - 18) L.addPage();
            if (L.y + hh <= bottom) {
                if (left) h2tRegion(L, left, view, L.m, colW, 'draw');
                if (right) h2tRegion(L, right, view, L.m + colW + gap, colW, 'draw');
                L.y += hh + 4;
            } else {
                // Too tall to sit side by side on one page: full width, in order
                if (left) { h2tRegion(L, left, view, L.m, L.cw, 'flow'); L.y += 4; }
                if (right) { h2tRegion(L, right, view, L.m, L.cw, 'flow'); L.y += 4; }
            }
        });
    };

    // Hendrich II + Get Up & Go — the Word grid: factor | findings | points |
    // score, the Get Up & Go options with the chosen one marked, then the
    // total ("Not scored" when nothing was entered).
    R_PDF.hendrich = function (L, s) {
        const H = FORM.HENDRICH;
        L.h1(H.TITLE);
        const factors = s.factors || {};
        const notes = (s.notes && typeof s.notes === 'object') ? s.notes : {};
        const sc = CAP.scoreHendrich(s);
        const rows = H.FACTORS.map(function (f) {
            const on = !!factors[f.id];
            const score = on ? L.cb(true) + ' ' + f.pts : (sc.scored ? L.cb(false) + ' 0' : L.cb(false));
            return [f.label, notes[f.id] == null ? '' : String(notes[f.id]), String(f.pts), score];
        });
        const groupAt = rows.length;
        rows.push([H.GUG_TITLE, '', '', '']);
        H.GUG.forEach(function (o) {
            const on = sc.gug != null && sc.gug === o.val;
            rows.push(['', o.label + (o.qualifier ? '\n' + o.qualifier : '') + (o.note ? '\n' + o.note : ''),
                String(o.val), on ? L.cb(true) + ' ' + o.val : L.cb(false)]);
        });
        rows.push([H.HIGH, '', 'Total Score', sc.scored ? sc.total + '\n' + sc.label : 'Not scored']);
        L.table(['Risk Factor', 'Findings', 'Points', 'Score'], rows, scaleRow([46, 88, 16, 30], L.cw),
            { groupRows: [groupAt], boldCols: [0], minRowH: 9 });
    };

    R_PDF.references = function (L, s) {
        L.h1('References');
        const refs = (s.refs || []).filter(function (r) { return r && r.trim(); });
        if (!refs.length) { L.para('(no references)', { color: L.MUTED, style: 'italic' }); return; }
        refs.forEach(function (r, i) {
            L.para((i + 1) + '. ' + r, { size: 9.5 });
        });
    };

    // Nursing Concept Map — the Word form's page 1, on its own LANDSCAPE page:
    // the boxes at their Word positions (FORM.CONCEPT_MAP row / col) joined by
    // the map's connectors, every label printed with the entered text wrapped
    // inside its box ('—' when empty). The font steps down (9 → 7 pt) to fit;
    // text that still doesn't fit stops at the box's last line with
    // "(continued on next page)" and prints in full on the next page(s), so
    // nothing is cut off. The optional Care plan detail (the pre-6/24 problem
    // list) follows on a portrait page. Old packets are read through
    // CAP.readConceptMap() (old diagnoses → Nursing Diagnoses, interventions →
    // Nursing Interventions, the old summary as "Previous notes").
    R_PDF.conceptMap = function (L, s) {
        const CM = FORM.CONCEPT_MAP;
        const doc = L.doc;
        const v = CAP.readConceptMap(s);
        L.h1(CM.TITLE);

        const top = L.y;
        const bottom = L.ph - 13;           // clear of the 'Page N' footer
        const gx = 12, gy = 9;              // gaps hold the connectors
        const colW = (L.cw - gx * 2) / 3;
        const rowH = (bottom - top - gy * 2) / 3;
        const pad = 2.5;
        const innerW = colW - pad * 2;
        const LBL = 8.5;                    // label size (pt)
        const LH = function (pt) { return pt * 0.42; };  // line height (mm)
        const SIZES = [9, 8, 7.5, 7];

        function rectOf(b) {
            return { x: L.m + (b.col - 1) * (colW + gx), y: top + (b.row - 1) * (rowH + gy), w: colW, h: rowH };
        }
        // A box's content as fields: { label, paras[] } — paras are the value's
        // paragraphs (one per Nursing Diagnoses entry), [] = empty.
        function contentOf(b) {
            const out = b.fields.map(function (f) {
                if (f.multi) {
                    const list = v.nursingDx.map(function (t) { return String(t).trim(); }).filter(Boolean);
                    return { label: f.label, paras: list.map(function (t, i) { return (i + 1) + '. ' + t; }) };
                }
                const t = String(v.fields[f.key] || '').replace(/\s+$/, '');
                return { label: f.label, paras: t.trim() ? t.split('\n') : [] };
            });
            if (b.center && v.center.trim()) out.push({ label: CM.PREVIOUS_CENTER, paras: v.center.replace(/\s+$/, '').split('\n') });
            return out;
        }
        // Lines to print at value size `fs`: { t, kind: label|val|empty, fi, pi, h }
        function layout(fields, fs) {
            const lines = [];
            fields.forEach(function (f, fi) {
                doc.setFont('helvetica', 'bold'); doc.setFontSize(LBL);
                doc.splitTextToSize(pdfSafe(f.label), innerW).forEach(function (t) {
                    lines.push({ t: t, kind: 'label', fi: fi, h: LH(LBL) });
                });
                doc.setFont('helvetica', 'normal'); doc.setFontSize(fs);
                if (!f.paras.length) { lines.push({ t: '—', kind: 'empty', fi: fi, h: LH(fs) }); }
                f.paras.forEach(function (p, pi) {
                    const w = doc.splitTextToSize(pdfSafe(p), innerW);
                    (w.length ? w : ['']).forEach(function (t) { lines.push({ t: t, kind: 'val', fi: fi, pi: pi, h: LH(fs) }); });
                });
                if (fi < fields.length - 1) lines.push({ t: '', kind: 'gap', fi: fi, h: 1.2 });
            });
            return lines;
        }
        function heightOf(lines) { return lines.reduce(function (a, l) { return a + l.h; }, 0); }

        // Connectors first; the boxes' white fill covers nothing they need.
        const rects = {};
        CM.BOXES.forEach(function (b) { rects[b.id] = rectOf(b); });
        function edge(r, dx, dy) {
            const hw = r.w / 2, hh = r.h / 2;
            const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
            return [r.x + hw + dx * t, r.y + hh + dy * t];
        }
        doc.setDrawColor(L.MUTED[0], L.MUTED[1], L.MUTED[2]);
        doc.setFillColor(L.MUTED[0], L.MUTED[1], L.MUTED[2]);
        doc.setLineWidth(0.35);
        (CM.CONNECT || []).forEach(function (c) {
            const a = rects[c[0]], b = rects[c[1]];
            if (!a || !b) return;
            const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
            const len = Math.sqrt(dx * dx + dy * dy);
            if (!len) return;
            const p = edge(a, dx, dy), q = edge(b, -dx, -dy);
            doc.line(p[0], p[1], q[0], q[1]);
            if (c[2]) {
                const ux = dx / len, uy = dy / len;
                const bx = q[0] - ux * 2.4, by = q[1] - uy * 2.4;
                doc.triangle(q[0], q[1], bx - uy * 1.2, by + ux * 1.2, bx + uy * 1.2, by - ux * 1.2, 'F');
            }
        });

        // Boxes
        const overflow = [];   // { label, text } printed on the next page
        CM.BOXES.forEach(function (b) {
            const r = rects[b.id];
            const fields = contentOf(b);
            const room = r.h - pad * 2;
            let fs = SIZES[SIZES.length - 1];
            let lines = null;
            for (let i = 0; i < SIZES.length; i++) {
                const ls = layout(fields, SIZES[i]);
                if (heightOf(ls) <= room) { fs = SIZES[i]; lines = ls; break; }
            }
            let cut = -1;
            if (!lines) {
                lines = layout(fields, fs);
                // Keep what fits, leaving one line for the continuation note
                let used = LH(fs);
                for (let i = 0; i < lines.length; i++) {
                    if (used + lines[i].h > room) { cut = i; break; }
                    used += lines[i].h;
                }
                // Don't strand a label at the bottom without its first line
                while (cut > 0 && (lines[cut - 1].kind === 'label' || lines[cut - 1].kind === 'gap')) cut--;
                if (cut < 0) cut = lines.length;
            }

            doc.setFillColor(255, 255, 255);
            if (b.center) {
                doc.setFillColor(241, 245, 249);
                doc.setDrawColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
                doc.setLineWidth(0.6);
            } else {
                doc.setDrawColor(L.TEXT[0], L.TEXT[1], L.TEXT[2]);
                doc.setLineWidth(0.3);
            }
            doc.roundedRect(r.x, r.y, r.w, r.h, 2, 2, 'FD');

            const shown = cut >= 0 ? lines.slice(0, cut) : lines;
            let y = r.y + pad;
            shown.forEach(function (ln) {
                if (ln.kind === 'label') L.setText(b.center ? L.ACCENT : L.TEXT, LBL, 'bold');
                else if (ln.kind === 'empty') L.setText(L.MUTED, fs, 'normal');
                else L.setText(L.TEXT, fs, 'normal');
                if (ln.t) doc.text(ln.t, r.x + pad, y + ln.h * 0.78);
                y += ln.h;
            });
            if (cut >= 0) {
                L.setText(L.MUTED, 7, 'italic');
                doc.text('(continued on next page)', r.x + r.w - pad, r.y + r.h - pad + 0.2, { align: 'right' });
                // Rebuild the rest of each field's text from its remaining lines
                const rest = lines.slice(cut);
                fields.forEach(function (f, fi) {
                    const mine = rest.filter(function (ln) { return ln.fi === fi && (ln.kind === 'val' || ln.kind === 'empty'); });
                    const labelLeft = rest.some(function (ln) { return ln.fi === fi && ln.kind === 'label'; });
                    if (!mine.length && !labelLeft) return;
                    let text = '', lastPi = null;
                    mine.forEach(function (ln) {
                        if (ln.kind === 'empty') { text = '—'; return; }
                        if (lastPi === null) text = ln.t;
                        else text += (ln.pi === lastPi ? ' ' : '\n') + ln.t;
                        lastPi = ln.pi;
                    });
                    overflow.push({ label: f.label + (labelLeft ? '' : ' (continued)'), text: text || '—' });
                });
            }
        });
        L.y = bottom + 2;

        // Continuation page(s), same orientation as the map
        if (overflow.length) {
            L.addPage();
            L.h1(CM.TITLE + ' (continued)');
            overflow.forEach(function (o) {
                L.h3(o.label);
                L.para(o.text);
                L.spacer(1);
            });
        }

        // Care plan detail — BendBSN's per-problem extra, portrait
        const pKeys = ['name'].concat(CM.PROBLEM_FIELDS.map(function (f) { return f.key; }));
        const problems = v.problems.filter(function (p) {
            return pKeys.some(function (k) { return String(p[k] || '').trim() !== ''; });
        });
        if (problems.length) {
            L.addPage('portrait');
            L.h1(CM.DETAIL_TITLE);
            problems.forEach(function (p, i) {
                L.h2(p.name.trim() || ('Problem ' + (i + 1)));
                CM.PROBLEM_FIELDS.forEach(function (f) { L.fieldBlock(f.pdf || f.label, p[f.key]); });
                L.divider();
            });
        }
    };
    R_PDF.conceptMap.orientation = 'landscape';

    R_PDF.caseStudy = function (L, s) {
        L.h1('Case Study');
        L.h2('1. Assessment');
        L.fieldBlock('Subjective Data', s.subjective);
        L.fieldBlock('Objective Data', s.objective);
        L.h2('2. Nursing Diagnoses');
        L.fieldBlock('Skin Integrity', s.dx_skin);
        L.fieldBlock('Mobility', s.dx_mobility);
        L.fieldBlock('Psychosocial / Emotional Health', s.dx_psych);
        L.h2('3. Planning (Goals / Outcomes)');
        L.fieldBlock('Skin — short-term', s.plan_skin_st);
        L.fieldBlock('Skin — long-term',  s.plan_skin_lt);
        L.fieldBlock('Mobility — short-term', s.plan_mobility_st);
        L.fieldBlock('Mobility — long-term',  s.plan_mobility_lt);
        L.fieldBlock('Psychosocial — short-term', s.plan_psych_st);
        L.fieldBlock('Psychosocial — long-term',  s.plan_psych_lt);
        L.h2('4. Nursing Interventions and Rationales');
        L.fieldBlock('Skin Integrity', s.iv_skin);
        L.fieldBlock('Mobility', s.iv_mobility);
        L.fieldBlock('Psychosocial', s.iv_psych);
        L.h2('5. Evaluation');
        L.fieldBlock('Evaluation Plan', s.evaluation);
        L.h2('6. Interdisciplinary Collaboration');
        L.fieldBlock('Team Members + Roles', s.collaboration);
        L.h2('7. Patient and Family Education');
        L.fieldBlock('Pressure injury prevention / repositioning', s.edu_skin);
        L.fieldBlock('Nutrition and hydration', s.edu_nutrition);
        L.fieldBlock('Emotional health and social engagement', s.edu_psych);
        L.fieldBlock('Medication management / chronic disease control', s.edu_meds);
        L.h2('8. Reflection');
        L.fieldBlock('Reflection', s.reflection);
    };

    // ------------------------------------------------------------------
    // Validated screening tools (PHQ-9, GAD-7, C-SSRS, CAGE, CAM)
    // ------------------------------------------------------------------
    const PHQ9_Q_PDF = [
        'Little interest or pleasure in doing things',
        'Feeling down, depressed, or hopeless',
        'Trouble falling or staying asleep, or sleeping too much',
        'Feeling tired or having little energy',
        'Poor appetite or overeating',
        'Feeling bad about yourself or that you are a failure',
        'Trouble concentrating on things',
        'Moving / speaking slowly OR fidgety / restless',
        'Thoughts that you would be better off dead, or hurting yourself'
    ];
    const PHQ9_OPT_LABELS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

    const GAD7_Q_PDF = [
        'Feeling nervous, anxious, or on edge',
        'Not being able to stop or control worrying',
        'Worrying too much about different things',
        'Trouble relaxing',
        'Being so restless that it is hard to sit still',
        'Becoming easily annoyed or irritable',
        'Feeling afraid as if something awful might happen'
    ];

    function pdfScored04(L, s, opts) {
        // opts: { title, subtitle, questions, severityFn, footnote }
        L.h1(opts.title);
        if (opts.subtitle) L.para(opts.subtitle);
        const choices = s.choices || {};
        let total = 0;
        let answered = 0;
        opts.questions.forEach(function (q, idx) {
            const v = choices[idx];
            if (v != null) { total += v; answered += 1; }
            L.inlineKv((idx + 1) + '. ' + q, v != null ? (v + ' — ' + PHQ9_OPT_LABELS[v]) : '—');
        });
        L.spacer(2);
        L.scoreBox(answered ? total : '—', 'Total ' + opts.title.split(' ')[0] + ' Score', answered ? opts.severityFn(total).label : 'Not scored');
        if (opts.footnote) {
            L.spacer(2);
            L.setText([180, 30, 30], 8, 'bold');
            L.doc.text(pdfSafe(opts.footnote), L.m, L.y);
            L.y += 5;
        }
        if (s.date)  L.inlineKv('Date', s.date);
        if (s.notes) { L.spacer(1); L.fieldBlock('Notes', s.notes); }
    }

    function phq9SevPdf(s) {
        if (s >= 20) return { label: 'Severe (20–27)' };
        if (s >= 15) return { label: 'Moderately Severe (15–19)' };
        if (s >= 10) return { label: 'Moderate (10–14)' };
        if (s >= 5)  return { label: 'Mild (5–9)' };
        return { label: 'None–Minimal (0–4)' };
    }
    function gad7SevPdf(s) {
        if (s >= 15) return { label: 'Severe (15–21)' };
        if (s >= 10) return { label: 'Moderate (10–14)' };
        if (s >= 5)  return { label: 'Mild (5–9)' };
        return { label: 'Minimal (0–4)' };
    }

    R_PDF.phq9 = function (L, s) {
        pdfScored04(L, s, {
            title: 'PHQ-9 — Depression Screening',
            subtitle: 'Over the last 2 weeks, how often bothered by:',
            questions: PHQ9_Q_PDF,
            severityFn: phq9SevPdf,
            footnote: 'ALERT: Item 9 (suicidal ideation): if scored >= 1, immediate safety assessment + provider notification.'
        });
    };

    R_PDF.gad7 = function (L, s) {
        pdfScored04(L, s, {
            title: 'GAD-7 — Anxiety Screening',
            subtitle: 'Over the last 2 weeks, how often bothered by:',
            questions: GAD7_Q_PDF,
            severityFn: gad7SevPdf
        });
    };

    R_PDF.cssrs = function (L, s) {
        L.h1('C-SSRS — Suicide Severity Rating');
        const ans = s.answers || {};
        const Q = [
            ['q1', 'Wished you were dead / would not wake up?'],
            ['q2', 'Actually had thoughts of killing yourself?'],
            ['q3', 'Been thinking about how you might do this?'],
            ['q4', 'Had thoughts and some intention of acting on them?'],
            ['q5', 'Worked out details? Intend to carry out plan?'],
            ['q6', 'Ever done / started / prepared anything to end your life?']
        ];
        Q.forEach(function (q, idx) {
            const v = ans[q[0]];
            L.inlineKv((idx + 1) + '. ' + q[1], v ? v.toUpperCase() : '—');
        });
        let triage = 'Not scored';
        if (ans.q6 === 'yes') triage = 'BEHAVIORAL — escalate immediately';
        else if (ans.q4 === 'yes' || ans.q5 === 'yes') triage = 'HIGH RISK — provider + safety plan';
        else if (ans.q3 === 'yes') triage = 'MODERATE RISK — provider + monitor';
        else if (ans.q2 === 'yes') triage = 'LOW RISK — assess support';
        else if (ans.q1 === 'yes') triage = 'POSITIVE IDEATION — ongoing assessment';
        else if (Object.keys(ans).length) triage = 'Negative screen';
        L.spacer(2);
        L.scoreBox(triage === 'Not scored' || triage === 'Negative screen' ? '-' : '!', 'Triage Level', triage);
        if (s.date)   L.inlineKv('Date', s.date);
        if (s.action) { L.spacer(1); L.fieldBlock('Action / Notification', s.action); }
    };

    R_PDF.cage = function (L, s) {
        L.h1('CAGE — Alcohol Screening');
        const ans = s.answers || {};
        const Q = [
            ['C', 'CUT DOWN — felt should cut down on drinking?'],
            ['A', 'ANNOYED — people criticized your drinking?'],
            ['G', 'GUILTY — felt bad / guilty about drinking?'],
            ['E', 'EYE-OPENER — drink first thing in morning?']
        ];
        let yes = 0;
        let answered = 0;
        Q.forEach(function (q) {
            const v = ans[q[0]];
            if (v === 'yes') yes += 1;
            if (v) answered += 1;
            L.inlineKv(q[0] + ' — ' + q[1], v ? v.toUpperCase() : '—');
        });
        let sev = 'Not scored';
        if (answered) {
            if (yes >= 2) sev = 'Clinically significant (≥2) — further assessment indicated';
            else if (yes === 1) sev = 'Possible concern — repeat / probe further';
            else sev = 'Negative screen';
        }
        L.spacer(2);
        L.scoreBox(answered ? yes : '—', 'CAGE Score (0–4)', sev);
        if (s.date)  L.inlineKv('Date', s.date);
        if (s.notes) { L.spacer(1); L.fieldBlock('Notes', s.notes); }
    };

    R_PDF.cam = function (L, s) {
        L.h1('CAM — Confusion Assessment Method');
        L.para('Algorithm: POSITIVE if (F1 + F2) AND (F3 OR F4) are present.');
        const f = s.features || {};
        const FEATS = [
            ['F1', 'Acute Onset & Fluctuating Course'],
            ['F2', 'Inattention'],
            ['F3', 'Disorganized Thinking'],
            ['F4', 'Altered Level of Consciousness']
        ];
        FEATS.forEach(function (ft) {
            const v = f[ft[0]];
            L.inlineKv(ft[0] + ' — ' + ft[1], v ? (v === 'yes' ? 'PRESENT' : 'Absent') : '—');
        });
        const f1 = f.F1 === 'yes', f2 = f.F2 === 'yes', f3 = f.F3 === 'yes', f4 = f.F4 === 'yes';
        let result = 'Not scored';
        if (f1 && f2 && (f3 || f4)) result = 'POSITIVE — delirium likely. Notify provider.';
        else if (Object.keys(f).length) result = 'Negative — delirium unlikely';
        L.spacer(2);
        L.scoreBox(result.startsWith('POSITIVE') ? '!' : (result === 'Not scored' ? '-' : 'OK'), 'Algorithm Result', result);
        if (s.date)  L.inlineKv('Date / Time', s.date);
        if (s.cause) { L.spacer(1); L.fieldBlock('Suspected Cause(s)', s.cause); }
    };

    // Has the student entered anything in this module? Collections hold either
    // row objects (meds, notes…) or bare values — RTDB returns integer-keyed
    // objects such as PHQ-9/GAD-7 `choices` as arrays of numbers — so values
    // are tested directly (a 0 score counts; '', null and an unticked
    // checkbox don't). A row's `format` alone (Progress Notes default) doesn't
    // count either, nor does the `_schema` shape marker.
    // Nested shapes (Braden/Morse cols → column → choices) are searched all the
    // way down, so an empty column object doesn't count as data.
    function moduleHasData(modState) {
        function filled(y) { return y != null && y !== false && String(y).trim() !== ''; }
        function deep(y) {
            if (y && typeof y === 'object') return Object.keys(y).some(function (k) { return deep(y[k]); });
            return filled(y);
        }
        return Object.keys(modState || {}).some(function (k) {
            if (k === '_schema') return false;
            const v = modState[k];
            if (v && typeof v === 'object') {
                return Object.keys(v).some(function (kk) {
                    const x = v[kk];
                    if (x && typeof x === 'object') {
                        return Object.keys(x).some(function (f) { return f !== 'format' && deep(x[f]); });
                    }
                    return filled(x);
                });
            }
            return filled(v);
        });
    }

    // ---------- LAB VALUES (TABLE 3) ----------
    // The full grid: group headings, every analyte row (blank cells when not
    // filled in), then the student's added rows under Other. Notes typed into
    // the earlier placeholder print after the grid as "Previous notes".
    R_PDF.labs = function (L, s) {
        L.h1('Lab Values');
        const COLS = FORM.LAB_COLUMNS || [];
        const GROUPS = FORM.LAB_GROUPS || [];
        const saved = (s.rows && typeof s.rows === 'object') ? s.rows : {};
        let extra = s.extra;
        if (extra && !Array.isArray(extra) && typeof extra === 'object') {
            extra = Object.keys(extra).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return extra[k]; });
        }
        extra = (Array.isArray(extra) ? extra : []).filter(function (x) {
            return x && typeof x === 'object' && ['lab'].concat(COLS.map(function (c) { return c.key; })).some(function (k) {
                return x[k] != null && String(x[k]).trim() !== '';
            });
        });
        function cell(v) { return v == null ? '' : String(v); }
        const out = [];
        const groupRows = [];
        GROUPS.forEach(function (g, gi) {
            groupRows.push(out.length);
            out.push([g.group].concat(COLS.map(function () { return ''; })));
            g.rows.forEach(function (r) {
                const v = saved[r.id] || {};
                out.push([r.label].concat(COLS.map(function (c) { return cell(v[c.key]); })));
            });
            if (gi === GROUPS.length - 1) {
                extra.forEach(function (x) {
                    out.push([cell(x.lab) || '(lab not named)'].concat(COLS.map(function (c) { return cell(x[c.key]); })));
                });
            }
        });
        L.table(['Lab'].concat(COLS.map(function (c) { return c.title; })), out,
            scaleRow([30, 30, 24, 28, 68], L.cw), { groupRows: groupRows, boldCols: [0], minRowH: 8 });
        if (s._sandboxText && String(s._sandboxText).trim()) L.fieldBlock('Previous notes', s._sandboxText);
    };

    // ---------- Second instances (catalog `base`) ----------
    // Resolved at call time so a rebuilt base renderer applies to Day 2 too.
    ((CAP && CAP.MODULE_CATALOG) || []).forEach(function (m) {
        if (!m.base || R_PDF[m.id]) return;
        R_PDF[m.id] = function (L, s) {
            const base = R_PDF[m.base];
            if (typeof base !== 'function') return;
            return base(L, s, { moduleId: m.id, title: m.label, day: m.day || 2 });
        };
    });

    // A module asks for a landscape page via its catalog entry
    // (pdfOrientation: 'landscape') or R_PDF[id].orientation = 'landscape'.
    function orientationFor(modId) {
        const mod = CAP && CAP.MODULE_BY_ID && CAP.MODULE_BY_ID[modId];
        const fn = R_PDF[modId];
        const base = mod && mod.base ? R_PDF[mod.base] : null;
        const o = (mod && mod.pdfOrientation) || (fn && fn.orientation) || (base && base.orientation);
        return o === 'landscape' ? 'landscape' : 'portrait';
    }

    // Word-form section order (CAP_MODULES.PDF_ORDER), extras after.
    function orderForPdf(ids) {
        return (CAP && CAP.orderModules) ? CAP.orderModules(ids) : (ids || []).slice();
    }

    // ------------------------------------------------------------------
    // Main generate()
    // ------------------------------------------------------------------
    function generate(packet) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('jsPDF not loaded — editor must lazy-load it before calling CAP_PDF.generate()');
        }
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({ unit: 'mm', format: PAGE_FORMAT, orientation: 'portrait' });
        PERSON = (CAP && CAP.personWord) ? CAP.personWord(packet.meta) : 'patient';
        const L = makeLayout(doc);

        drawCoverPage(L, packet);

        // Sumner attribution (tiny footer on cover page)
        L.setText(L.MUTED, 7.5, 'italic');
        const attrib = 'Framework adapted from Sumner College NUR curriculum materials.';
        doc.text(attrib, L.pw / 2, L.ph - 13, { align: 'center' }); // above the 'Page 1' footer (ph - 8)

        // Walk enabled modules in the Word form's order (not the order they
        // were switched on)
        const enabled = orderForPdf((packet.meta && packet.meta.enabledModules) || []);
        for (let i = 0; i < enabled.length; i++) {
            const modId = enabled[i];
            const renderer = R_PDF[modId];
            if (!renderer) continue;
            const modState = (packet.state && packet.state[modId]) || {};
            const mod = CAP && CAP.MODULE_BY_ID && CAP.MODULE_BY_ID[modId];
            // A module the student left blank gets a one-line stub on the current
            // page instead of its own page — no blank "(none)" pages and no
            // misleading "Total 0 / Low Risk" score boxes — while still showing
            // the instructor that the section was enabled. Grids the instructor
            // grades cell by cell (printBlank) print their blank form instead.
            if (modId !== 'info' && !(mod && mod.printBlank) && !moduleHasData(modState)) {
                L.spacer(4);
                L.h1((mod && mod.label) || modId);
                L.para('(left blank)', { color: L.MUTED, style: 'italic' });
                continue;
            }
            // Start each module on a new page for clean section breaks; a
            // landscape module always gets a fresh (landscape) page.
            const orient = orientationFor(modId);
            if (orient === 'landscape' || L.orientation !== 'portrait' || i > 0 || L.y > 90) L.addPage(orient);
            try {
                renderer(L, modState);
            } catch (e) {
                console.error('[CAP PDF] render failed for module ' + modId, e);
                L.para('(error rendering ' + modId + ': ' + (e.message || e) + ')', { color: [180, 30, 30], style: 'italic' });
            }
        }

        L.addFooter();

        // Filename — CAP_{Initials}_{Date}_{LastName}.pdf
        const info = (packet.state && packet.state.info) || {};
        const meta = packet.meta || {};
        const initials = sanitizeForFilename(info.res_initials || meta.residentInitials || 'UNK');
        const date = sanitizeForFilename(info.date || meta.date || localISODate());
        const lastName = sanitizeForFilename(lastNameOf(info.student_name) || 'student');
        doc.save('CAP_' + initials + '_' + date + '_' + lastName + '.pdf');
    }

    function localISODate() {
        const d = new Date(); // local calendar date, not UTC
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function lastNameOf(full) {
        if (!full) return '';
        const parts = String(full).trim().split(/\s+/);
        return parts[parts.length - 1] || '';
    }
    function sanitizeForFilename(s) {
        return String(s || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
    }

    window.CAP_PDF = { generate: generate };
})();
