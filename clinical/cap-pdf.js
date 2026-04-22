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
            },

            pageBreakIfNeeded: function (reserve) {
                if (this.y + (reserve || 0) > ph - 18) this.addPage();
            },
            addPage: function () {
                this.addFooter();
                doc.addPage();
                this.pageNum += 1;
                this.y = 18;
                this.addHeaderStrip();
            },
            addHeaderStrip: function () {
                // Small branding strip on subsequent pages
                doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                doc.rect(0, 0, pw, 8, 'F');
                this.setText([255, 255, 255], 9, 'bold');
                doc.text('Clinical Assessment Packet', m, 5.5);
                if (this.resident) {
                    doc.text(this.resident, pw - m, 5.5, { align: 'right' });
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
                doc.text(text, m, this.y);
                this.y += 2;
                doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
                doc.setLineWidth(0.4);
                doc.line(m, this.y, m + cw, this.y);
                this.y += 6;
            },
            h2: function (text) {
                this.pageBreakIfNeeded(10);
                this.setText(ACCENT, 11, 'bold');
                doc.text(text, m, this.y);
                this.y += 6;
            },
            h3: function (text) {
                this.pageBreakIfNeeded(8);
                this.setText(TEXT, 10, 'bold');
                doc.text(text, m, this.y);
                this.y += 5;
            },

            // Small uppercase label line
            label: function (text) {
                this.pageBreakIfNeeded(5);
                this.setText(MUTED, 8, 'bold');
                doc.text(String(text || '').toUpperCase(), m, this.y);
                this.y += 4;
            },

            // Wrapped body paragraph
            para: function (text, opts) {
                opts = opts || {};
                const t = String(text == null ? '' : text).trim();
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
                this.setText(MUTED, 9, 'bold');
                doc.text(label + ':', x, this.y);
                const labelW = doc.getTextWidth(label + ':');
                this.setText(TEXT, 9, 'normal');
                const lines = doc.splitTextToSize(String(value), cw - labelW - 4);
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
                doc.text(String(num), m + 5, this.y + 8.5);
                this.setText(TEXT, 9.5, 'bold');
                doc.text(label, m + 24, this.y + 7.5);
                this.setText(MUTED, 9, 'normal');
                if (risk) doc.text(risk, pw - m - 4, this.y + 7.5, { align: 'right' });
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

                function drawRow(cells, y, bold, fill) {
                    // Compute row height by wrapping each cell
                    let maxLines = 1;
                    const wrapped = cells.map(function (cell, i) {
                        doc.setFont('helvetica', bold ? 'bold' : 'normal');
                        doc.setFontSize(8.5);
                        const w = colWidths[i] - padX * 2;
                        const lines = doc.splitTextToSize(String(cell || ''), w);
                        if (lines.length > maxLines) maxLines = lines.length;
                        return lines;
                    });
                    const rowH = padY * 2 + maxLines * lineH;
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
                // Rows
                rows.forEach(function (row) {
                    // estimate minimum row height as 1 line × n cols for break check
                    if (L.y + 8 > ph - 18) {
                        L.addPage();
                        // Re-draw header on new page
                        const h2 = drawRow(headers, L.y, true, true);
                        L.y += h2;
                    }
                    const rh = drawRow(row, L.y, false, false);
                    L.y += rh;
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
        L.doc.text(title, L.pw / 2, 24, { align: 'center' });

        L.y = 44;

        // Info box
        L.doc.setFillColor(248, 250, 252);
        L.doc.setDrawColor(L.ACCENT[0], L.ACCENT[1], L.ACCENT[2]);
        L.doc.setLineWidth(0.3);
        L.doc.roundedRect(L.m, L.y, L.cw, 30, 2, 2, 'FD');
        const startY = L.y;
        L.y += 6;
        L.inlineKv('Student', info.student_name || '');
        L.inlineKv('Date', info.date || meta.date || '');
        L.inlineKv('Course', info.course || meta.course || '');
        L.inlineKv('Site', info.site || meta.site || '');
        L.inlineKv('Instructor', info.instructor || '');
        L.inlineKv('Resident Initials', info.res_initials || meta.residentInitials || '');
        L.y = startY + 34;
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
        // Cover page already has the most important fields; on a dedicated
        // Patient Info page, include the rest.
        L.h1('Patient Info');
        L.inlineKv('Student', s.student_name);
        L.inlineKv('Date', s.date);
        L.inlineKv('Course', s.course);
        L.inlineKv('Instructor', s.instructor);
        L.inlineKv('Clinical Site', s.site);
        L.inlineKv('Shift', s.shift);
        L.spacer(4);
        L.h3('Resident');
        L.inlineKv('Initials', s.res_initials);
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
        BRADEN_FACTORS.forEach(function (f) {
            const val = choices[f[0]];
            if (val != null) total += val;
            L.inlineKv(f[1], val != null ? String(val) : '—');
        });
        let risk = 'Not scored';
        if (total) {
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
        const attrib = 'Framework adapted from Sumner College NUR curriculum materials. For educational use only.';
        doc.text(attrib, L.pw / 2, L.ph - 8, { align: 'center' });

        // Walk enabled modules in order
        const enabled = (packet.meta && packet.meta.enabledModules) || [];
        for (let i = 0; i < enabled.length; i++) {
            const modId = enabled[i];
            const renderer = R_PDF[modId];
            if (!renderer) continue;
            const modState = (packet.state && packet.state[modId]) || {};
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
        const date = sanitizeForFilename(info.date || meta.date || new Date().toISOString().slice(0, 10));
        const lastName = sanitizeForFilename(lastNameOf(info.student_name) || 'student');
        doc.save('CAP_' + initials + '_' + date + '_' + lastName + '.pdf');
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
