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

    // ------------------------------------------------------------------
    // Layout helpers — scope-local to one generate() call via makeLayout
    // ------------------------------------------------------------------
    function makeLayout(doc) {
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const m = 18;              // margin in mm
        const cw = pw - m * 2;     // content width
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
            addPage: function () {
                // The footer and header strip change the text style (the strip
                // leaves white bold). Callers that break mid-paragraph keep calling
                // doc.text, so restore their style or the rest prints invisibly.
                const prev = this._txt;
                this.addFooter();
                doc.addPage();
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
            table: function (headers, rows, colWidths) {
                // colWidths sum should = cw (all in mm)
                const lineH = 4;
                const padY = 2.5;
                const padX = 1.5;

                function wrapCells(cells, bold) {
                    doc.setFont('helvetica', bold ? 'bold' : 'normal');
                    doc.setFontSize(8.5);
                    return cells.map(function (cell, i) {
                        return doc.splitTextToSize(pdfSafe(cell || ''), colWidths[i] - padX * 2);
                    });
                }
                function rowHeight(wrapped) {
                    let maxLines = 1;
                    wrapped.forEach(function (lines) { if (lines.length > maxLines) maxLines = lines.length; });
                    return padY * 2 + maxLines * lineH;
                }
                function drawRow(cells, y, bold, fill) {
                    return paintRow(wrapCells(cells, bold), y, bold, fill);
                }
                // Draws already-wrapped cells (one array of lines per column)
                function paintRow(wrapped, y, bold, fill) {
                    const cells = wrapped;
                    const rowH = rowHeight(wrapped);
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
                        L.setText(bold ? ACCENT : TEXT, 8.5, bold ? 'bold' : 'normal');
                        let ty = y + padY + 3;
                        wrapped[i].forEach(function (ln, ix) {
                            doc.text(ln, xCur + padX, ty);
                            ty += lineH;
                        });
                        xCur += colWidths[i];
                    }
                    return rowH;
                }

                // Header
                this.pageBreakIfNeeded(12);
                const hdrH = drawRow(headers, this.y, true, true);
                this.y += hdrH;
                // Rows — measured before drawing. A row that doesn't fit moves to
                // a new page; a row taller than a whole page is split across pages.
                const bottom = ph - 18;
                function newTablePage() {
                    L.addPage();
                    L.y += drawRow(headers, L.y, true, true); // re-draw header
                }
                rows.forEach(function (row) {
                    let wrapped = wrapCells(row, false);
                    for (let guard = 0; guard < 50; guard++) {
                        const need = rowHeight(wrapped);
                        const avail = bottom - L.y;
                        if (need <= avail) { L.y += paintRow(wrapped, L.y, false, false); return; }
                        const fullPage = bottom - 18 - hdrH;
                        const fit = Math.floor((avail - padY * 2) / lineH);
                        if (need <= fullPage || fit < 3) { newTablePage(); continue; }
                        L.y += paintRow(wrapped.map(function (c) { return c.slice(0, fit); }), L.y, false, false);
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

        L.y = 44;

        // Info box — sized to its rows. They are measured first because the
        // filled box has to be drawn before the text (it would cover it after).
        const coverRows = [
            ['Student', info.student_name || ''],
            ['Date', info.date || meta.date || ''],
            ['Course', info.course || meta.course || ''],
            ['Site', info.site || meta.site || ''],
            ['Instructor', info.instructor || ''],
            ['Resident Initials', info.res_initials || meta.residentInitials || '']
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
    const CAP = window.CAP_MODULES;

    R_PDF.info = function (L, s) {
        // Student, Date, Course, Site, Instructor and Resident Initials are
        // already in the cover box printed directly above — only add the rest.
        L.h1('Patient Info');
        L.inlineKv('Shift', s.shift);
        L.spacer(4);
        L.h3('Resident');
        L.inlineKv('Age', s.res_age);
        L.inlineKv('DOB', s.res_dob);
        L.inlineKv('Room', s.res_room);
        L.inlineKv('Attending Physician', s.res_physician);
        L.inlineKv('Primary Diagnosis', s.res_dx);
    };

    R_PDF.omega = function (L, s) {
        L.h1('OMEGA-7 Assessment');
        const OMEGA_ROWS = [
            ['O','Orientation'], ['M','Medication'], ['E','Emergency'],
            ['G','Gait'], ['A','Allergies'],
            ['1','Air'], ['2','Food'], ['3','Water'], ['4','Safety'],
            ['5','Hygiene'], ['6','Pain'], ['7','Sleep']
        ];
        OMEGA_ROWS.forEach(function (r) {
            const val = s[r[0]];
            if (!val) return;
            L.fieldBlock(r[0] + ' — ' + r[1], val);
        });
    };

    R_PDF.meds = function (L, s) {
        L.h1('Medications');
        const rows = (s.rows || []).filter(function (r) {
            return r && (r.order || r.time || r.class || r.indication || r.sideEffects || r.implications);
        });
        if (!rows.length) { L.para('(no medications listed)', { color: L.MUTED, style: 'italic' }); return; }
        const headers = ['Order', 'Time', 'Class', 'Indication', 'Side Effects', 'Nursing Implications'];
        const widths = [32, 18, 28, 28, 36, 32]; // total ~174; cw is 174 for 210mm - 36margin = 174
        // Scale widths to fit cw exactly
        const sum = widths.reduce(function (a, b) { return a + b; }, 0);
        const scaled = widths.map(function (w) { return w * L.cw / sum; });
        const tableRows = rows.map(function (r) {
            return [r.order || '', r.time || '', r.class || '', r.indication || '', r.sideEffects || '', r.implications || ''];
        });
        L.table(headers, tableRows, scaled);
    };

    function scaleRow(widths, cw) {
        const sum = widths.reduce(function (a, b) { return a + b; }, 0);
        return widths.map(function (w) { return w * cw / sum; });
    }

    R_PDF.morse = function (L, s) {
        L.h1('Morse Fall Scale');
        const choices = s.choices || {};
        const MORSE_VARS = [
            ['history','History of Falling'],
            ['secondary_dx','Secondary Diagnosis'],
            ['ambulatory','Ambulatory Aid'],
            ['iv','IV / IV Access'],
            ['gait','Gait'],
            ['mental','Mental Status']
        ];
        let total = 0;
        MORSE_VARS.forEach(function (v) {
            const val = choices[v[0]];
            if (val != null) total += val;
            L.inlineKv(v[1], val != null ? String(val) + ' pts' : '—');
        });
        const risk = total >= 45 ? 'High Risk (45+)' : total >= 25 ? 'Moderate Risk (25–44)' : 'Low Risk (0–24)';
        L.spacer(2);
        L.scoreBox(total, 'Total Morse Score', risk);
        if (s.admit_date || s.review1 || s.review2) {
            L.spacer(2);
            L.inlineKv('Admission Date', s.admit_date);
            L.inlineKv('Review Date', s.review1);
            L.inlineKv('Review Date 2', s.review2);
        }
        if (s.signature) L.inlineKv('Signature', s.signature);
    };

    R_PDF.braden = function (L, s) {
        L.h1('Braden Scale — Pressure Sore Risk');
        const choices = s.choices || {};
        const BRADEN_FACTORS = [
            ['sensory','Sensory Perception'], ['moisture','Moisture'], ['activity','Activity'],
            ['mobility','Mobility'], ['nutrition','Nutrition'], ['friction','Friction and Shear']
        ];
        let total = 0;
        let nScored = 0;
        BRADEN_FACTORS.forEach(function (f) {
            const val = choices[f[0]];
            if (val != null) { total += val; nScored++; }
            L.inlineKv(f[1], val != null ? String(val) : '—');
        });
        let risk = 'Not scored';
        // Only interpret a complete scale: a partial sum reads as falsely severe
        if (nScored && nScored < BRADEN_FACTORS.length) {
            risk = 'Incomplete (' + nScored + '/' + BRADEN_FACTORS.length + ' scored)';
        } else if (total) {
            if (total <= 9) risk = 'Severe Risk (≤9)';
            else if (total <= 12) risk = 'High Risk (10–12)';
            else if (total <= 14) risk = 'Moderate Risk (13–14)';
            else if (total <= 18) risk = 'Mild Risk (15–18)';
            else risk = 'No significant risk (19+)';
        }
        L.spacer(2);
        L.scoreBox(total || '—', 'Total Braden Score', risk);
        if (s.date || s.evaluator) {
            L.spacer(2);
            L.inlineKv('Assessment Date', s.date);
            L.inlineKv('Evaluator', s.evaluator);
        }
        L.spacer(3);
        L.setText(L.MUTED, 7.5, 'italic');
        L.doc.text('Source: Barbara Braden & Nancy Bergstrom. Copyright 1988. Reprinted with permission. www.bradenscale.com',
            L.m, L.y);
        L.y += 4;
    };

    R_PDF.minicog = function (L, s) {
        L.h1('Mini-Cog — Cognitive Assessment');
        L.para('Three-word recall (Ocean · Desk · Tractor) + clock drawing test with hands at 8:20.');
        if (s.clockPng) {
            L.h3('Clock Drawing');
            L.image(s.clockPng, 70, 70);
        }
        L.inlineKv('Word Recall (0–3)', s.recall);
        L.inlineKv('Clock Drawing (0 or 2)', s.clock);
        const r = parseInt(s.recall, 10);
        const c = parseInt(s.clock, 10);
        if (!isNaN(r) && !isNaN(c)) {
            const total = r + c;
            const risk = total <= 2 ? 'Positive screen for dementia (0–2)' : 'Negative screen (3–5)';
            L.spacer(2);
            L.scoreBox(total, 'Mini-Cog Total (0–5)', risk);
        }
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

    R_PDF.ncsbn = function (L, s) {
        L.h1('Six Steps of the NCSBN Clinical Judgment Model');
        const STEPS = [
            'Step 1: Recognize Cues',
            'Step 2: Analyze Cues',
            'Step 3: Prioritize Hypotheses',
            'Step 4: Generate Solutions',
            'Step 5: Take Action',
            'Step 6: Evaluate Outcomes'
        ];
        const steps = s.steps || {};
        STEPS.forEach(function (label, i) {
            L.fieldBlock(label, steps[i]);
        });
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

    R_PDF.headToToe = function (L, s) {
        L.h1('Head-to-Toe Assessment');
        const SYS = [
            ['neuro','Neurological'], ['heent','HEENT'], ['cardio','Cardiovascular'],
            ['resp','Respiratory'], ['gi','Gastrointestinal'], ['gu','Genitourinary'],
            ['msk','Musculoskeletal'], ['skin','Skin / Integumentary'], ['psych','Psychosocial']
        ];
        SYS.forEach(function (sy) { L.fieldBlock(sy[1], s[sy[0]]); });
    };

    R_PDF.hendrich = function (L, s) {
        L.h1('Hendrich II Fall Risk Model');
        const FACTORS = [
            ['confusion','Confusion / Disorientation / Impulsivity', 4],
            ['depression','Symptomatic Depression', 2],
            ['elimination','Altered Elimination', 1],
            ['dizziness','Dizziness / Vertigo', 1],
            ['male','Male Gender', 1],
            ['antiepileptics','Antiepileptics', 2],
            ['benzos','Benzodiazepines', 1]
        ];
        const factors = s.factors || {};
        let total = 0;
        FACTORS.forEach(function (f) {
            const on = !!factors[f[0]];
            if (on) total += f[2];
            L.inlineKv(f[1] + ' (+' + f[2] + ')', on ? 'Yes' : 'No');
        });
        const ugVal = parseInt(s.getUpGo, 10);
        if (!isNaN(ugVal)) {
            total += ugVal;
            L.inlineKv('Get-Up-and-Go', '+' + ugVal);
        }
        const risk = total >= 5 ? 'High Risk for Falling (≥5)' : 'Lower Risk (<5)';
        L.spacer(2);
        L.scoreBox(total, 'Total Hendrich II Score', risk);
    };

    R_PDF.references = function (L, s) {
        L.h1('References');
        const refs = (s.refs || []).filter(function (r) { return r && r.trim(); });
        if (!refs.length) { L.para('(no references)', { color: L.MUTED, style: 'italic' }); return; }
        refs.forEach(function (r, i) {
            L.para((i + 1) + '. ' + r, { size: 9.5 });
        });
    };

    R_PDF.conceptMap = function (L, s) {
        L.h1('Concept Map');
        L.fieldBlock('Resident Summary (center)', s.center);
        const problems = (s.problems || []).filter(function (p) {
            return p && (p.name || p.data || p.dx || p.goals || p.interventions || p.evaluation);
        });
        if (!problems.length) { L.para('(no problems mapped)', { color: L.MUTED, style: 'italic' }); return; }
        problems.forEach(function (p, i) {
            L.h2((p.name || 'Problem ' + (i + 1)));
            L.fieldBlock('Supporting Data', p.data);
            L.fieldBlock('NANDA Diagnosis', p.dx);
            L.fieldBlock('Goals / Outcomes', p.goals);
            L.fieldBlock('Interventions & Rationales', p.interventions);
            L.fieldBlock('Evaluation Criteria', p.evaluation);
            L.divider();
        });
    };

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
    // count either.
    function moduleHasData(modState) {
        function filled(y) { return y != null && y !== false && String(y).trim() !== ''; }
        return Object.keys(modState || {}).some(function (k) {
            const v = modState[k];
            if (v && typeof v === 'object') {
                return Object.keys(v).some(function (kk) {
                    const x = v[kk];
                    if (x && typeof x === 'object') {
                        return Object.keys(x).some(function (f) { return f !== 'format' && filled(x[f]); });
                    }
                    return filled(x);
                });
            }
            return filled(v);
        });
    }

    // ------------------------------------------------------------------
    // Main generate()
    // ------------------------------------------------------------------
    function generate(packet) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('jsPDF not loaded — editor must lazy-load it before calling CAP_PDF.generate()');
        }
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const L = makeLayout(doc);

        drawCoverPage(L, packet);

        // Sumner attribution (tiny footer on cover page)
        L.setText(L.MUTED, 7.5, 'italic');
        const attrib = 'Framework adapted from Sumner College NUR curriculum materials.';
        doc.text(attrib, L.pw / 2, L.ph - 13, { align: 'center' }); // above the 'Page 1' footer (ph - 8)

        // Walk enabled modules in order
        const enabled = (packet.meta && packet.meta.enabledModules) || [];
        for (let i = 0; i < enabled.length; i++) {
            const modId = enabled[i];
            const renderer = R_PDF[modId];
            if (!renderer) continue;
            const modState = (packet.state && packet.state[modId]) || {};
            // A module the student left blank gets a one-line stub on the current
            // page instead of its own page — no blank "(none)" pages and no
            // misleading "Total 0 / Low Risk" score boxes — while still showing
            // the instructor that the section was enabled.
            if (modId !== 'info' && !moduleHasData(modState)) {
                const mod = CAP && CAP.MODULE_BY_ID && CAP.MODULE_BY_ID[modId];
                L.spacer(4);
                L.h1((mod && mod.label) || modId);
                L.para('(left blank)', { color: L.MUTED, style: 'italic' });
                continue;
            }
            // Start each module on a new page for clean section breaks
            if (i > 0 || L.y > 90) L.addPage();
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
