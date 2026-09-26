/* BendBSN — Clinical Assessment Packet — Per-module renderers
   ------------------------------------------------------------------
   Each renderer signature: (rootEl, state, onChange) => void
     • rootEl   — DOM element to populate (the cap-content area)
     • state    — packet.state[moduleId] (auto-created object, may be empty)
     • onChange — fn to call after any user edit; triggers autosave

   Adding a new renderer:
     1. Add the module entry to cap-modules.js MODULE_CATALOG
     2. Add CAP_RENDERERS.{moduleId} here
     3. (Optional) add per-module CSS in /clinical/packet/index.html

   A catalog entry with `base` (e.g. headToToe2 → headToToe) is registered
   at the bottom as an alias that calls CAP_RENDERERS[base] at call time
   with a 4th argument ctx = { moduleId, title, day, hint }. Renderers that
   can be a base must take their heading from ctx.title when given.

   Wording: the editor calls CAP_RENDERERS.setContext({ person }) before
   rendering; who()/Who() give "patient" (default, as on the Word form) or
   "resident" (memory-care packets).
*/
(function () {
    'use strict';
    if (window.CAP_RENDERERS) return;

    const CAP = window.CAP_MODULES || {};
    const FORM = CAP.FORM || {};

    let CTX = { person: 'patient' };
    function who() { return CTX.person === 'resident' ? 'resident' : 'patient'; }
    function Who() { const w = who(); return w.charAt(0).toUpperCase() + w.slice(1); }

    // ============================================================
    // SHARED HELPERS
    // ============================================================
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Generic field binding: any element with [data-cap-field="key"] inside
    // rootEl gets wired so its value flows into state[key] on input/change.
    // Also seeds the element from existing state on call.
    function bindFields(rootEl, state, onChange) {
        rootEl.querySelectorAll('[data-cap-field]').forEach(function (el) {
            const key = el.getAttribute('data-cap-field');
            // Seed from state
            if (el.type === 'checkbox') {
                el.checked = !!state[key];
            } else if (state[key] != null) {
                el.value = state[key];
            }
            // Listen
            const evt = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio')
                ? 'change' : 'input';
            el.addEventListener(evt, function () {
                state[key] = el.type === 'checkbox' ? el.checked : el.value;
                if (typeof onChange === 'function') onChange();
            });
        });
    }

    // Render a "field group" — a label above a textarea/input with consistent layout.
    function field(label, key, opts) {
        opts = opts || {};
        const tag = opts.tag || 'textarea';
        const rows = opts.rows || 2;
        const placeholder = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '';
        const type = opts.type ? ' type="' + opts.type + '"' : '';
        const min = opts.min != null ? ' min="' + opts.min + '"' : '';
        const max = opts.max != null ? ' max="' + opts.max + '"' : '';
        const ctl = tag === 'textarea'
            ? '<textarea data-cap-field="' + esc(key) + '" rows="' + rows + '"' + placeholder + ' class="cap-tf"></textarea>'
            : tag === 'select'
                ? '<select data-cap-field="' + esc(key) + '" class="cap-tf">' + (opts.optionsHtml || '') + '</select>'
                : '<input data-cap-field="' + esc(key) + '"' + type + min + max + placeholder + ' class="cap-tf">';
        return '<div class="cap-field">' +
            '<label class="cap-label">' + esc(label) + '</label>' + ctl +
        '</div>';
    }

    // Wraps a panel with a title bar.
    function panel(title, bodyHtml) {
        return '<section class="cap-panel">' +
            '<header class="cap-panel-head"><h3>' + esc(title) + '</h3></header>' +
            '<div class="cap-panel-body">' + bodyHtml + '</div>' +
        '</section>';
    }

    function panelHint(title, hintHtml, bodyHtml) {
        return '<section class="cap-panel">' +
            '<header class="cap-panel-head"><h3>' + esc(title) + '</h3></header>' +
            '<div class="cap-panel-body">' +
                '<p class="cap-hint">' + hintHtml + '</p>' +
                bodyHtml +
            '</div>' +
        '</section>';
    }

    // Score block — used by Morse, Braden, Mini-Cog
    function scoreBlock(num, label, risk, riskClass) {
        return '<div class="cap-score-block ' + (riskClass || '') + '">' +
            '<span class="cap-score-num">' + esc(num) + '</span>' +
            '<span class="cap-score-label">' + esc(label) + '</span>' +
            '<span class="cap-score-risk">' + esc(risk) + '</span>' +
        '</div>';
    }

    // ============================================================
    // DATA CONSTANTS (ported from standalone)
    // ============================================================
    // Word-form wording shared with cap-pdf.js (cap-modules.js FORM)
    const OMEGA_ROWS = FORM.OMEGA_ROWS || [];
    const MED_COLUMNS = FORM.MED_COLUMNS || [];
    const NCSBN_ROWS = FORM.NCSBN_ROWS || [];

    // Scored tools: wording, options and points live in cap-modules.js FORM
    // (shared with the PDF); read/score helpers there too (CAP.readBraden…).
    const BRADEN = FORM.BRADEN || { FACTORS: [], COLS: [] };
    const MORSE = FORM.MORSE || { VARS: [], COLS: [], BANDS: [] };
    const HENDRICH = FORM.HENDRICH || { FACTORS: [], GUG: [] };
    const MINICOG = FORM.MINICOG || { WORDS: [], STEPS: [] };
    const LAB_GROUPS = FORM.LAB_GROUPS || [];
    const LAB_COLUMNS = FORM.LAB_COLUMNS || [];

    // ---- Screening tools ported from /app/ (RN Notes) ----
    // PHQ-9 — depression. 9 items, scored 0-3 each (0-27 total).
    const PHQ9_QUESTIONS = [
        'Little interest or pleasure in doing things',
        'Feeling down, depressed, or hopeless',
        'Trouble falling or staying asleep, or sleeping too much',
        'Feeling tired or having little energy',
        'Poor appetite or overeating',
        'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
        'Trouble concentrating on things, such as reading the newspaper or watching television',
        'Moving or speaking so slowly that other people could have noticed; or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
        'Thoughts that you would be better off dead, or of hurting yourself in some way'
    ];
    const PHQ9_OPTS = [
        { val: 0, label: 'Not at all' },
        { val: 1, label: 'Several days' },
        { val: 2, label: 'More than half the days' },
        { val: 3, label: 'Nearly every day' }
    ];
    function phq9Severity(s) {
        if (s == null) return { label: 'Not scored', cls: '' };
        if (s >= 20) return { label: 'Severe (20–27)', cls: 'high' };
        if (s >= 15) return { label: 'Moderately Severe (15–19)', cls: 'high' };
        if (s >= 10) return { label: 'Moderate (10–14)', cls: 'moderate' };
        if (s >= 5)  return { label: 'Mild (5–9)', cls: 'moderate' };
        return { label: 'None–Minimal (0–4)', cls: 'low' };
    }

    // GAD-7 — anxiety. 7 items, 0-3 each (0-21 total).
    const GAD7_QUESTIONS = [
        'Feeling nervous, anxious, or on edge',
        'Not being able to stop or control worrying',
        'Worrying too much about different things',
        'Trouble relaxing',
        'Being so restless that it is hard to sit still',
        'Becoming easily annoyed or irritable',
        'Feeling afraid as if something awful might happen'
    ];
    function gad7Severity(s) {
        if (s == null) return { label: 'Not scored', cls: '' };
        if (s >= 15) return { label: 'Severe (15–21)', cls: 'high' };
        if (s >= 10) return { label: 'Moderate (10–14)', cls: 'moderate' };
        if (s >= 5)  return { label: 'Mild (5–9)', cls: 'moderate' };
        return { label: 'Minimal (0–4)', cls: 'low' };
    }

    // C-SSRS — Columbia Suicide Severity Rating Scale (yes/no triage).
    const CSSRS_QUESTIONS = [
        { id: 'q1', text: 'Have you wished you were dead or wished you could go to sleep and not wake up?' },
        { id: 'q2', text: 'Have you actually had any thoughts of killing yourself?' },
        { id: 'q3', text: 'Have you been thinking about how you might do this?' },
        { id: 'q4', text: 'Have you had these thoughts and had some intention of acting on them?' },
        { id: 'q5', text: 'Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?' },
        { id: 'q6', text: 'Have you ever done anything, started to do anything, or prepared to do anything to end your life?' }
    ];
    function cssrsTriage(answers) {
        const a = answers || {};
        if (a.q6 === 'yes') return { label: 'BEHAVIORAL — escalate immediately, do not leave alone', cls: 'high' };
        if (a.q4 === 'yes' || a.q5 === 'yes') return { label: 'HIGH RISK — notify provider, safety plan', cls: 'high' };
        if (a.q3 === 'yes') return { label: 'MODERATE RISK — notify provider, monitor', cls: 'moderate' };
        if (a.q2 === 'yes') return { label: 'LOW RISK — assess support, document', cls: 'moderate' };
        if (a.q1 === 'yes') return { label: 'POSITIVE IDEATION — ongoing assessment', cls: 'low' };
        if (Object.keys(a).length) return { label: 'Negative screen', cls: 'low' };
        return { label: 'Not scored', cls: '' };
    }

    // CAGE — alcohol screen. 4 yes/no items, ≥2 = significant.
    const CAGE_QUESTIONS = [
        { id: 'C', letter: 'C', text: 'Have you ever felt you should CUT DOWN on your drinking?' },
        { id: 'A', letter: 'A', text: 'Have people ANNOYED you by criticizing your drinking?' },
        { id: 'G', letter: 'G', text: 'Have you ever felt bad or GUILTY about your drinking?' },
        { id: 'E', letter: 'E', text: 'Have you ever had a drink first thing in the morning to steady your nerves or get rid of a hangover (EYE-OPENER)?' }
    ];
    function cageSeverity(score) {
        if (score == null) return { label: 'Not scored', cls: '' };
        if (score >= 2) return { label: 'Clinically significant (≥2) — further assessment indicated', cls: 'high' };
        if (score === 1) return { label: 'Possible concern — repeat / probe further', cls: 'moderate' };
        return { label: 'Negative screen', cls: 'low' };
    }

    // CAM — Confusion Assessment Method. 4 features; positive if F1 + F2 + (F3 OR F4).
    const CAM_FEATURES = [
        { id: 'F1', name: 'Acute Onset & Fluctuating Course', defn: 'Is there evidence of an acute change in mental status from baseline? Did the (abnormal) behavior fluctuate during the day?' },
        { id: 'F2', name: 'Inattention', defn: 'Did the patient have difficulty focusing attention — easily distracted, trouble keeping track of what was being said?' },
        { id: 'F3', name: 'Disorganized Thinking', defn: 'Was the patient\'s thinking disorganized or incoherent — rambling/irrelevant conversation, unclear or illogical flow of ideas, unpredictable switching from subject to subject?' },
        { id: 'F4', name: 'Altered Level of Consciousness', defn: 'Overall, how would you rate the patient\'s LOC? Anything other than alert (vigilant, lethargic, stuporous, comatose) is positive.' }
    ];
    function camResult(features) {
        const f = features || {};
        const f1 = f.F1 === 'yes', f2 = f.F2 === 'yes', f3 = f.F3 === 'yes', f4 = f.F4 === 'yes';
        if (f1 && f2 && (f3 || f4)) return { label: 'POSITIVE — delirium likely. Notify provider, look for cause.', cls: 'high' };
        if (Object.keys(f).length === 0) return { label: 'Not scored', cls: '' };
        return { label: 'Negative — delirium unlikely', cls: 'low' };
    }

    // ============================================================
    // RENDERERS
    // ============================================================
    const R = {};

    // ---------- INFO ----------
    R.info = function (rootEl, state, onChange) {
        rootEl.innerHTML = panelHint(
            'Student & ' + Who() + ' Information',
            'De-identify all ' + who() + ' data — initials only, no names.',
            '<div class="cap-grid g2">' +
                field('Student Name', 'student_name', { tag: 'input' }) +
                field('Date', 'date', { tag: 'input', type: 'date' }) +
                field('Course', 'course', { tag: 'input' }) +
                field('Instructor', 'instructor', { tag: 'input' }) +
                field('Clinical Site', 'site', { tag: 'input' }) +
                field('Shift', 'shift', { tag: 'select', optionsHtml:
                    '<option value="">—</option>' +
                    '<option>AM (0700-1500)</option>' +
                    '<option>PM (1500-2300)</option>' +
                    '<option>NOC (2300-0700)</option>' +
                    '<option>8-hour</option>' +
                    '<option>12-hour</option>'
                }) +
            '</div>' +
            '<h4 class="cap-subhead">' + Who() + '</h4>' +
            '<div class="cap-grid g4">' +
                field('Initials', 'res_initials', { tag: 'input' }) +
                field('Age', 'res_age', { tag: 'input', type: 'number', min: 0, max: 120 }) +
                field('DOB', 'res_dob', { tag: 'input', type: 'date' }) +
                field('Apartment / Room', 'res_room', { tag: 'input' }) +
            '</div>' +
            '<div class="cap-grid g2">' +
                field('Attending Physician', 'res_physician', { tag: 'input' }) +
                field('Primary Diagnosis / Reason for Admission', 'res_dx', { tag: 'input' }) +
            '</div>'
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- OMEGA 1234567 ----------
    // ctx (4th arg) is set when called for a second instance (omega2).
    R.omega = function (rootEl, state, onChange, ctx) {
        ctx = ctx || {};
        const rows = OMEGA_ROWS.map(function (r) {
            return '<tr>' +
                '<td class="cap-omega-key"><span class="cap-omega-letter">' + esc(r.letter) + '</span></td>' +
                '<td class="cap-omega-label">' + esc(r.label) + '</td>' +
                '<td><textarea data-cap-field="' + esc(r.key) + '" rows="2" class="cap-tf" aria-label="' + esc(r.letter + ' ' + r.label) + '"></textarea></td>' +
            '</tr>';
        }).join('');
        rootEl.innerHTML = panelHint(
            ctx.title || 'OMEGA-7 Assessment',
            (ctx.hint ? esc(ctx.hint) + ' ' : '') + 'Systematic assessment framework. One row per domain.',
            '<table class="cap-omega-table"><tbody>' + rows + '</tbody></table>'
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- MEDICATIONS ----------
    R.meds = function (rootEl, state, onChange) {
        if (!Array.isArray(state.rows)) state.rows = [emptyMed()];
        function emptyMed() { return { order:'', time:'', class:'', indication:'', sideEffects:'', implications:'' }; }
        const COL_W = { order:'18%', time:'10%', class:'15%', indication:'15%', sideEffects:'17%', implications:'21%' };
        function render() {
            const rowsHtml = state.rows.map(function (r, i) {
                return '<tr>' +
                    MED_COLUMNS.map(function (c) {
                        return '<td><textarea data-row="' + i + '" data-col="' + esc(c.key) + '" rows="2" class="cap-tf" aria-label="' +
                            esc(c.title + (c.caption ? ' (' + c.caption + ')' : '') + ', row ' + (i + 1)) + '">' + esc(r[c.key]) + '</textarea></td>';
                    }).join('') +
                    '<td class="cap-meds-del"><button class="cap-row-del" data-del="' + i + '" title="Delete row">&times;</button></td>' +
                '</tr>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'Medications',
                'Current medications the ' + who() + ' is on. One row per med.',
                '<div class="cap-meds-wrap">' +
                    '<table class="cap-meds-table">' +
                        '<thead><tr>' +
                            MED_COLUMNS.map(function (c) {
                                return '<th style="width:' + (COL_W[c.key] || 'auto') + '">' + esc(c.title) +
                                    (c.caption ? '<small>' + esc(c.caption) + '</small>' : '') + '</th>';
                            }).join('') +
                            '<th style="width:36px"></th>' +
                        '</tr></thead>' +
                        '<tbody>' + rowsHtml + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<button class="cap-add-row" id="cap-meds-add">+ Add medication</button>'
            );
            // Wire row inputs
            rootEl.querySelectorAll('textarea[data-row][data-col]').forEach(function (ta) {
                ta.addEventListener('input', function () {
                    const i = parseInt(ta.dataset.row, 10);
                    const col = ta.dataset.col;
                    if (state.rows[i]) {
                        state.rows[i][col] = ta.value;
                        if (typeof onChange === 'function') onChange();
                    }
                });
            });
            // Wire delete row
            rootEl.querySelectorAll('[data-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.dataset.del, 10);
                    state.rows.splice(i, 1);
                    if (!state.rows.length) state.rows.push(emptyMed());
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            // Add row
            const addBtn = rootEl.querySelector('#cap-meds-add');
            if (addBtn) addBtn.addEventListener('click', function () {
                state.rows.push(emptyMed());
                if (typeof onChange === 'function') onChange();
                render();
            });
        }
        render();
    };

    // ---------- Dated score columns (Braden 1–4, Morse Admission/Review) ----------
    // The Word forms score each assessment in its own column. The editor shows
    // one column at a time (picked with these tabs) and a read-only summary
    // grid of all columns underneath.
    function fmtDate(v) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v == null ? '' : v));
        return m ? (+m[2]) + '/' + (+m[3]) + '/' + m[1] : String(v == null ? '' : v);
    }
    // cols: [{ key, title, sub }]
    function colTabsHtml(cols, activeKey, label) {
        return '<div class="cap-assess-tabs" role="tablist" aria-label="' + esc(label) + '">' + cols.map(function (c) {
            const on = c.key === activeKey;
            return '<button type="button" class="cap-assess-tab' + (on ? ' active' : '') + '" role="tab" aria-selected="' + on + '" data-col-tab="' + esc(c.key) + '">' +
                '<strong>' + esc(c.title) + '</strong>' +
                '<small>' + esc(c.sub) + '</small>' +
            '</button>';
        }).join('') + '</div>';
    }
    // Small tags on an option naming the OTHER columns that picked it
    function pickBadges(names) {
        return names.map(function (n) { return ' <span class="cap-pick-badge">' + esc(n) + '</span>'; }).join('');
    }
    // Read-only grid: rows = [{ head, cells[], cls }], cols = [{ title, active }]
    function summaryTableHtml(cornerLabel, cols, rows) {
        return '<div class="cap-sum-wrap"><table class="cap-sum-table">' +
            '<thead><tr><th scope="col">' + esc(cornerLabel) + '</th>' + cols.map(function (c) {
                return '<th scope="col"' + (c.active ? ' class="active"' : '') + '>' + esc(c.title) + '</th>';
            }).join('') + '</tr></thead><tbody>' +
            rows.map(function (r) {
                return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '><th scope="row">' + esc(r.head) + '</th>' +
                    r.cells.map(function (v, i) {
                        return '<td' + (cols[i] && cols[i].active ? ' class="active"' : '') + '>' + esc(v) + '</td>';
                    }).join('') + '</tr>';
            }).join('') +
        '</tbody></table></div>';
    }
    function confirmThen(title, msg, fn) {
        if (typeof window.showConfirmModal === 'function') window.showConfirmModal(title, msg, fn, { confirmText: 'Clear', danger: true });
        else fn();
    }
    // A re-render replaces the control the student just used; put focus back
    // on its replacement (matched by attribute value, so no selector
    // escaping), or the next Tab would start from the top of the page.
    function refocus(rootEl, sel, attrs) {
        const list = rootEl.querySelectorAll(sel);
        const keys = Object.keys(attrs || {});
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            const hit = keys.every(function (k) {
                return String(k === 'value' ? el.value : el.getAttribute(k)) === String(attrs[k]);
            });
            if (!hit) continue;
            try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
            return;
        }
    }

    // ---------- MORSE FALL SCALE ----------
    // Three dated columns (Admission, Review 1, Review 2), each scoring every
    // variable with its own Total and Signature & Status. Stored as
    // state.cols{admit,review1,review2} (schema 4); an old single score set is
    // shown in the Admission column (CAP.readMorse) and only rewritten in the
    // new shape when the student edits this module.
    R.morse = function (rootEl, state, onChange) {
        const view = CAP.readMorse(state);
        let active = MORSE.COLS.length ? MORSE.COLS[0].key : 'admit';
        function commit() {
            if (state.cols !== view.cols) { state.cols = view.cols; state._schema = 4; }
            if (typeof onChange === 'function') onChange();
        }
        function meta(key) { return MORSE.COLS.filter(function (c) { return c.key === key; })[0] || { key: key, label: key, short: key }; }
        function tabs() {
            return MORSE.COLS.map(function (c) {
                const col = view.cols[c.key];
                const sc = CAP.scoreMorse(col.choices);
                return { key: c.key, title: c.short,
                         sub: (col.date ? fmtDate(col.date) : 'No date') + ' · ' + (sc.n ? 'Total ' + sc.total + (sc.complete ? '' : ' (' + sc.n + '/' + sc.of + ')') : 'Not scored') };
            });
        }
        function summary() {
            const cols = MORSE.COLS.map(function (c) { return { title: c.short, active: c.key === active }; });
            function each(fn) { return MORSE.COLS.map(function (c) { return fn(view.cols[c.key]); }); }
            const rows = [{ head: 'Date', cells: each(function (col) { return col.date ? fmtDate(col.date) : '—'; }) }];
            MORSE.VARS.forEach(function (v) {
                rows.push({ head: v.name, cells: each(function (col) {
                    const x = col.choices[v.id];
                    if (x == null) return '—';
                    const o = v.opts.filter(function (op) { return op.val === x; })[0];
                    return x + (o ? ' (' + o.label + ')' : '');
                }) });
            });
            rows.push({ head: 'Total', cls: 'cap-sum-total', cells: each(function (col) { const s = CAP.scoreMorse(col.choices); return s.n ? String(s.total) : '—'; }) });
            rows.push({ head: 'Risk', cells: each(function (col) { return CAP.scoreMorse(col.choices).label; }) });
            rows.push({ head: MORSE.SIGNATURE, cells: each(function (col) { return col.signature || '—'; }) });
            return summaryTableHtml('Variables', cols, rows);
        }
        function refreshPassive() {
            const t = tabs();
            rootEl.querySelectorAll('[data-col-tab]').forEach(function (b, i) {
                const sm = b.querySelector('small');
                if (sm && t[i]) sm.textContent = t[i].sub;
            });
            const w = rootEl.querySelector('.cap-sum-wrap');
            if (w) w.outerHTML = summary();
        }
        function render() {
            const col = view.cols[active];
            const cm = meta(active);
            const sc = CAP.scoreMorse(col.choices);
            const varsHtml = MORSE.VARS.map(function (v) {
                const optsHtml = v.opts.map(function (o) {
                    const isOn = col.choices[v.id] === o.val;
                    const others = MORSE.COLS.filter(function (c) {
                        return c.key !== active && view.cols[c.key].choices[v.id] === o.val;
                    }).map(function (c) { return c.short; });
                    return '<label class="cap-morse-opt' + (isOn ? ' selected' : '') + '">' +
                        '<input type="radio" name="morse_' + v.id + '" value="' + o.val + '" data-morse="' + v.id + '"' + (isOn ? ' checked' : '') + '>' +
                        '<span>' + esc(o.label) + pickBadges(others) + '</span>' +
                        '<span class="cap-morse-pts">' + o.val + '</span>' +
                    '</label>';
                }).join('');
                return '<div class="cap-morse-var">' +
                    '<h4>' + esc(v.name) + '</h4>' +
                    '<div class="cap-morse-opts" role="radiogroup" aria-label="' + esc(v.name + ' — ' + cm.label) + '">' + optsHtml + '</div>' +
                '</div>';
            }).join('');
            const migratedNote = (view.migrated && state.cols !== view.cols)
                ? '<p class="cap-fineprint cap-ncsbn-migrated">Your earlier Morse score, admission date and signature are in the Admission column; your earlier review dates are in the two Review columns.</p>'
                : '';
            rootEl.innerHTML = panelHint(
                MORSE.TITLE,
                esc(MORSE.INTRO),
                migratedNote +
                colTabsHtml(tabs(), active, 'Morse assessment column') +
                '<div class="cap-grid g2">' +
                    '<div class="cap-field"><label class="cap-label" for="capMorseDate">' + esc(cm.label) + '</label>' +
                        '<input type="date" id="capMorseDate" class="cap-tf" data-col-field="date"></div>' +
                    '<div class="cap-field"><label class="cap-label" for="capMorseSig">' + esc(MORSE.SIGNATURE) + ' — ' + esc(cm.short) + '</label>' +
                        '<input id="capMorseSig" class="cap-tf" data-col-field="signature"></div>' +
                '</div>' +
                varsHtml +
                scoreBlock(sc.n ? sc.total : '—', 'Total — ' + cm.label, sc.label, sc.cls) +
                '<p class="cap-fineprint">' + esc(MORSE.HOWTO) + '</p>' +
                '<div class="cap-assess-actions"><button type="button" class="cap-btn-sm" id="capMorseClear">Clear ' + esc(cm.short) + ' scores</button></div>' +
                '<h4 class="cap-subhead">All columns</h4>' +
                summary() +
                '<table class="cap-sum-table cap-band-table"><thead><tr><th scope="col" colspan="2">Morse Fall Score</th></tr></thead><tbody>' +
                    MORSE.BANDS.map(function (b) { return '<tr><th scope="row">' + esc(b.label) + '</th><td>' + esc(b.range) + '</td></tr>'; }).join('') +
                '</tbody></table>'
            );
            rootEl.querySelectorAll('[data-col-tab]').forEach(function (b) {
                b.addEventListener('click', function () {
                    const key = b.getAttribute('data-col-tab');
                    active = key;
                    render();
                    refocus(rootEl, '[data-col-tab]', { 'data-col-tab': key });
                });
            });
            rootEl.querySelectorAll('[data-col-field]').forEach(function (el) {
                const f = el.getAttribute('data-col-field');
                el.value = col[f] || '';
                el.addEventListener('input', function () {
                    view.cols[active][f] = el.value;
                    commit();
                    refreshPassive();
                });
            });
            rootEl.querySelectorAll('input[type="radio"][data-morse]').forEach(function (r) {
                r.addEventListener('change', function () {
                    const id = r.dataset.morse, val = r.value;
                    view.cols[active].choices[id] = parseInt(val, 10);
                    commit();
                    render();  // re-render to update score + selected styling
                    refocus(rootEl, 'input[type="radio"][data-morse]', { 'data-morse': id, value: val });
                });
            });
            const clr = rootEl.querySelector('#capMorseClear');
            if (clr) clr.addEventListener('click', function () {
                if (!Object.keys(view.cols[active].choices).length) return;
                confirmThen('Clear scores?', 'Clear the ' + cm.short + ' column\'s Morse scores? The date and signature stay.', function () {
                    view.cols[active].choices = {};
                    commit();
                    render();
                    refocus(rootEl, '#capMorseClear', {});
                });
            });
        }
        render();
    };

    // ---------- BRADEN SCALE ----------
    // TABLE 5: four dated assessments (Assess 1–4), each with its own six
    // factor scores, total and evaluator signature/title. Stored as
    // state.cols{a1..a4} (schema 4); an old single assessment
    // (state.choices/date/evaluator) is shown as Assess 1 (CAP.readBraden).
    R.braden = function (rootEl, state, onChange) {
        const view = CAP.readBraden(state);
        let active = BRADEN.COLS.length ? BRADEN.COLS[0].key : 'a1';
        function commit() {
            if (state.cols !== view.cols) { state.cols = view.cols; state._schema = 4; }
            if (typeof onChange === 'function') onChange();
        }
        function meta(key) { return BRADEN.COLS.filter(function (c) { return c.key === key; })[0] || { key: key, num: key }; }
        function tabs() {
            return BRADEN.COLS.map(function (c) {
                const col = view.cols[c.key];
                const sc = CAP.scoreBraden(col.choices);
                return { key: c.key, title: 'Assess ' + c.num,
                         sub: (col.date ? fmtDate(col.date) : 'No date') + ' · ' + (sc.n ? 'Total ' + sc.total + (sc.complete ? '' : ' (' + sc.n + '/' + sc.of + ')') : 'Not scored') };
            });
        }
        function summary() {
            const cols = BRADEN.COLS.map(function (c) { return { title: 'Assess ' + c.num, active: c.key === active }; });
            function each(fn) { return BRADEN.COLS.map(function (c) { return fn(view.cols[c.key]); }); }
            const rows = [{ head: 'Date of assess', cells: each(function (col) { return col.date ? fmtDate(col.date) : '—'; }) }];
            BRADEN.FACTORS.forEach(function (f) {
                rows.push({ head: f.name, cells: each(function (col) {
                    const x = col.choices[f.id];
                    return x == null ? '—' : String(x);
                }) });
            });
            rows.push({ head: 'Total score', cls: 'cap-sum-total', cells: each(function (col) { const s = CAP.scoreBraden(col.choices); return s.n ? String(s.total) : '—'; }) });
            rows.push({ head: 'Risk', cells: each(function (col) { return CAP.scoreBraden(col.choices).label; }) });
            rows.push({ head: BRADEN.EVALUATOR, cells: each(function (col) { return col.evaluator || '—'; }) });
            return summaryTableHtml('Risk factor', cols, rows);
        }
        function refreshPassive() {
            const t = tabs();
            rootEl.querySelectorAll('[data-col-tab]').forEach(function (b, i) {
                const sm = b.querySelector('small');
                if (sm && t[i]) sm.textContent = t[i].sub;
            });
            const w = rootEl.querySelector('.cap-sum-wrap');
            if (w) w.outerHTML = summary();
        }
        function render() {
            const col = view.cols[active];
            const cm = meta(active);
            const sc = CAP.scoreBraden(col.choices);
            const factorsHtml = BRADEN.FACTORS.map(function (f) {
                const optsHtml = f.opts.map(function (o) {
                    const isOn = col.choices[f.id] === o.val;
                    const others = BRADEN.COLS.filter(function (c) {
                        return c.key !== active && view.cols[c.key].choices[f.id] === o.val;
                    }).map(function (c) { return 'A' + c.num; });
                    return '<label class="cap-braden-opt' + (isOn ? ' selected' : '') + '">' +
                        '<input type="radio" name="braden_' + f.id + '" value="' + o.val + '" data-braden="' + f.id + '"' + (isOn ? ' checked' : '') + '>' +
                        '<strong>' + o.val + '. ' + esc(o.title) + ' –' + pickBadges(others) + '</strong>' +
                        '<span class="cap-braden-desc">' + esc(o.desc) + '</span>' +
                    '</label>';
                }).join('');
                return '<div class="cap-braden-factor">' +
                    '<h4>' + esc(f.name) + '</h4>' +
                    (f.defn ? '<p class="cap-braden-defn">' + esc(f.defn) + '</p>' : '') +
                    '<div class="cap-braden-opts cols-' + f.opts.length + '" role="radiogroup" aria-label="' + esc(f.name + ' — Assess ' + cm.num) + '">' + optsHtml + '</div>' +
                    (f.footnotes ? '<p class="cap-fineprint">' + esc(BRADEN.FOOTNOTES.join('  ')) + '</p>' : '') +
                '</div>';
            }).join('');
            const migratedNote = (view.migrated && state.cols !== view.cols)
                ? '<p class="cap-fineprint cap-ncsbn-migrated">Your earlier Braden assessment (scores, date and evaluator) is now Assess 1.</p>'
                : '';
            rootEl.innerHTML = panelHint(
                BRADEN.TITLE,
                'Up to four assessments. Pick an assessment, then one description per risk factor. ' + esc(BRADEN.HIGH_RISK) + '.',
                migratedNote +
                '<p class="cap-fineprint cap-braden-legend">' + esc(BRADEN.LEGEND) + '</p>' +
                colTabsHtml(tabs(), active, 'Braden assessment') +
                '<div class="cap-grid g2">' +
                    '<div class="cap-field"><label class="cap-label" for="capBradenDate">Date of Assess ' + esc(cm.num) + '</label>' +
                        '<input type="date" id="capBradenDate" class="cap-tf" data-col-field="date"></div>' +
                    '<div class="cap-field"><label class="cap-label" for="capBradenEval">' + esc(BRADEN.EVALUATOR) + ' — Assess ' + esc(cm.num) + '</label>' +
                        '<input id="capBradenEval" class="cap-tf" data-col-field="evaluator"></div>' +
                '</div>' +
                factorsHtml +
                scoreBlock(sc.n ? sc.total : '—', 'Total Score — Assess ' + cm.num, sc.label, sc.cls) +
                '<p class="cap-fineprint">' + esc(BRADEN.HIGH_RISK) + '</p>' +
                '<div class="cap-assess-actions"><button type="button" class="cap-btn-sm" id="capBradenClear">Clear Assess ' + esc(cm.num) + ' scores</button></div>' +
                '<h4 class="cap-subhead">All assessments</h4>' +
                summary() +
                '<p class="cap-fineprint" style="margin-top:14px;font-style:italic;">' + esc(BRADEN.COPYRIGHT) + '</p>'
            );
            rootEl.querySelectorAll('[data-col-tab]').forEach(function (b) {
                b.addEventListener('click', function () {
                    const key = b.getAttribute('data-col-tab');
                    active = key;
                    render();
                    refocus(rootEl, '[data-col-tab]', { 'data-col-tab': key });
                });
            });
            rootEl.querySelectorAll('[data-col-field]').forEach(function (el) {
                const f = el.getAttribute('data-col-field');
                el.value = col[f] || '';
                el.addEventListener('input', function () {
                    view.cols[active][f] = el.value;
                    commit();
                    refreshPassive();
                });
            });
            rootEl.querySelectorAll('input[type="radio"][data-braden]').forEach(function (r) {
                r.addEventListener('change', function () {
                    const id = r.dataset.braden, val = r.value;
                    view.cols[active].choices[id] = parseInt(val, 10);
                    commit();
                    render();
                    refocus(rootEl, 'input[type="radio"][data-braden]', { 'data-braden': id, value: val });
                });
            });
            const clr = rootEl.querySelector('#capBradenClear');
            if (clr) clr.addEventListener('click', function () {
                if (!Object.keys(view.cols[active].choices).length) return;
                confirmThen('Clear scores?', 'Clear the Braden scores for Assess ' + cm.num + '? The date and evaluator stay.', function () {
                    view.cols[active].choices = {};
                    commit();
                    render();
                    refocus(rootEl, '#capBradenClear', {});
                });
            });
        }
        render();
    };

    // ---------- MINI-COG ----------
    // "Patient Cognitive Assessment Form". state: { words{ocean,desk,tractor},
    // recall, clock, notes, clockPng }. Ticking words sets recall to the count
    // (state.recall is kept in sync so older readers stay right); a packet
    // with only a legacy recall number keeps it editable until words are ticked.
    R.minicog = function (rootEl, state, onChange) {
        function person(t) { return who() === 'patient' ? t : String(t).replace(/\bpatient\b/g, who()); }
        const view0 = CAP.readMinicog(state);
        const wordsHtml = MINICOG.WORDS.map(function (w) {
            return '<label class="cap-word-opt' + (view0.words[w.key] ? ' selected' : '') + '">' +
                '<input type="checkbox" data-minicog-word="' + esc(w.key) + '"' + (view0.words[w.key] ? ' checked' : '') + '>' +
                '<span>' + esc(w.label) + '</span>' +
            '</label>';
        }).join('');
        const legacy = !view0.wordsTicked && view0.recall != null && !(state.words && typeof state.words === 'object');
        rootEl.innerHTML = panelHint(
            MINICOG.TITLE,
            'Rapid dementia screen (~3 min). Tick the words the ' + who() + ' recalled; the scores total automatically.',
            '<div class="cap-careplan-box">' +
                '<h4>Step 1 — 3-Word Registration</h4>' +
                '<p>1. ' + esc(person(MINICOG.STEPS[0])).replace(/Ocean Desk Tractor$/, '<strong style="font-size:15px;letter-spacing:0.5px;">Ocean · Desk · Tractor</strong>') + '</p>' +
            '</div>' +
            '<div class="cap-careplan-box">' +
                '<h4>Step 2 — Clock Drawing Test</h4>' +
                '<p class="cap-hint">2. ' + esc(person(MINICOG.STEPS[1])) + '</p>' +
                '<div class="cap-clock-wrap">' +
                    '<canvas id="capClockCanvas" width="400" height="400" aria-label="Clock drawing area" style="border:1px solid var(--clx-border);border-radius:4px;touch-action:none;display:block;margin:0 auto;max-width:100%;cursor:crosshair;background:#fff;"></canvas>' +
                    '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">' +
                        '<button type="button" class="cap-btn-sm" id="capClockClear">Clear drawing</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="cap-careplan-box">' +
                '<h4>Step 3 — Word Recall</h4>' +
                '<p>3. ' + esc(person(MINICOG.STEPS[2])) + '</p>' +
            '</div>' +
            '<div class="cap-careplan-box">' +
                '<h4>Scoring</h4>' +
                '<p>1. ' + esc(MINICOG.SCORE_WORDS) + '</p>' +
                '<div class="cap-word-opts" role="group" aria-label="Words remembered">' + wordsHtml + '</div>' +
                (legacy ? '<p class="cap-fineprint" id="capMinicogLegacy">A recall score of ' + esc(view0.recall) + ' was entered earlier without the words. Tick the words remembered to record which ones — the score then follows the ticks.</p>' : '') +
                '<div class="cap-grid g2" style="margin-top:10px;">' +
                    field(MINICOG.RECALL_LABEL, 'recall', { tag: 'select', optionsHtml:
                        '<option value="">—</option>' +
                        '<option value="0">0</option>' +
                        '<option value="1">1</option>' +
                        '<option value="2">2</option>' +
                        '<option value="3">3</option>'
                    }) +
                '</div>' +
                '<p style="margin-top:10px;">2. ' + esc(MINICOG.SCORE_CLOCK) + '</p>' +
                '<div class="cap-grid g2" style="margin-top:8px;">' +
                    field(MINICOG.CLOCK_LABEL, 'clock', { tag: 'select', optionsHtml:
                        '<option value="">—</option>' +
                        '<option value="2">2 — Normal</option>' +
                        '<option value="0">0 — Abnormal</option>'
                    }) +
                '</div>' +
            '</div>' +
            '<div id="capMinicogScore"></div>' +
            field('Additional observations / notes', 'notes', { rows: 3 })
        );
        bindFields(rootEl, state, onChange);
        const recallSel = rootEl.querySelector('[data-cap-field="recall"]');

        function syncRecall() {
            const v = CAP.readMinicog(state);
            if (recallSel) {
                // The ticks decide the score once any word is ticked
                recallSel.disabled = v.wordsTicked;
                // With no word ticked the dropdown is in charge: show what is stored
                recallSel.value = v.wordsTicked ? String(v.recall) : (state.recall == null ? '' : String(state.recall));
            }
        }
        function updateScore() {
            const v = CAP.readMinicog(state);
            const block = document.getElementById('capMinicogScore');
            if (!block) return;
            if (v.total == null) { block.innerHTML = '<p class="cap-fineprint">' + esc(MINICOG.TOTAL_LABEL) + ': —</p>'; return; }
            block.innerHTML = scoreBlock(v.total, 'Mini-Cog Total (0–5)', v.label, v.cls) +
                '<p class="cap-fineprint">' + esc(MINICOG.TOTAL_LABEL) + '</p>';
        }
        rootEl.querySelectorAll('input[type="checkbox"][data-minicog-word]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                if (!state.words || typeof state.words !== 'object') state.words = {};
                MINICOG.WORDS.forEach(function (w) { if (state.words[w.key] == null) state.words[w.key] = false; });
                const before = MINICOG.WORDS.filter(function (w) { return state.words[w.key]; }).length;
                // First tick: keep the recall number the dropdown held (e.g. a
                // legacy score) so unticking every word gives it back.
                if (before === 0 && cb.checked) state.recallLegacy = state.recall == null ? '' : String(state.recall);
                state.words[cb.getAttribute('data-minicog-word')] = cb.checked;
                const lbl = cb.closest('.cap-word-opt');
                if (lbl) lbl.classList.toggle('selected', cb.checked);
                const n = MINICOG.WORDS.filter(function (w) { return state.words[w.key]; }).length;
                state.recall = n ? String(n) : (state.recallLegacy == null ? '0' : String(state.recallLegacy));
                const note = document.getElementById('capMinicogLegacy');
                if (note) note.remove();
                syncRecall();
                updateScore();
                if (typeof onChange === 'function') onChange();
            });
        });
        ['recall', 'clock'].forEach(function (k) {
            const el = rootEl.querySelector('[data-cap-field="' + k + '"]');
            if (el) el.addEventListener('change', updateScore);
        });
        syncRecall();
        updateScore();

        // Canvas drawing. A light circle guide is drawn like the printed
        // form's; it becomes part of the saved drawing once the student draws.
        const canvas = document.getElementById('capClockCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            function guide() {
                ctx.save();
                ctx.strokeStyle = '#9aa7b6';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 24, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#1a3a5c';
            // Restore from state if present
            if (state.clockPng) {
                const img = new Image();
                img.onload = function () { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
                img.src = state.clockPng;
            } else {
                guide();
            }
            let drawing = false;
            function pos(ev) {
                const rect = canvas.getBoundingClientRect();
                const x = ((ev.clientX || (ev.touches && ev.touches[0].clientX)) - rect.left) * (canvas.width / rect.width);
                const y = ((ev.clientY || (ev.touches && ev.touches[0].clientY)) - rect.top) * (canvas.height / rect.height);
                return { x, y };
            }
            function start(ev) { ev.preventDefault(); drawing = true; const p = pos(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
            function move(ev)  { if (!drawing) return; ev.preventDefault(); const p = pos(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); }
            function end(ev)   { if (!drawing) return; drawing = false; saveClockPng(); }
            canvas.addEventListener('mousedown', start);
            canvas.addEventListener('mousemove', move);
            canvas.addEventListener('mouseup', end);
            canvas.addEventListener('mouseleave', end);
            canvas.addEventListener('touchstart', start, { passive: false });
            canvas.addEventListener('touchmove', move, { passive: false });
            canvas.addEventListener('touchend', end);
            function saveClockPng() {
                try {
                    state.clockPng = canvas.toDataURL('image/png');
                    if (typeof onChange === 'function') onChange();
                } catch (e) {}
            }
            const clearBtn = document.getElementById('capClockClear');
            if (clearBtn) clearBtn.addEventListener('click', function () {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                guide();
                state.clockPng = null;
                if (typeof onChange === 'function') onChange();
            });
        }
    };

    // ---------- SBAR ----------
    R.sbar = function (rootEl, state, onChange) {
        rootEl.innerHTML = panelHint(
            'SBAR Report Sheet',
            'Situation · Background · Assessment · Recommendation. Used for shift handoff or provider update.',
            // S
            '<section class="cap-sbar-block"><h4><span class="cap-sbar-letter">S</span>Situation</h4>' +
                field('Situation of concern (brief overview, clear and succinct)', 'situation', { rows: 3 }) +
            '</section>' +
            // B
            '<section class="cap-sbar-block"><h4><span class="cap-sbar-letter">B</span>Background</h4>' +
                field('Brief Hx (reason for admission, diagnoses, etc.)', 'background', { rows: 3 }) +
                '<div class="cap-grid g2">' +
                    field('Allergies', 'allergies', { tag: 'input' }) +
                    field('Code status', 'code', { tag: 'input' }) +
                '</div>' +
            '</section>' +
            // A
            '<section class="cap-sbar-block"><h4><span class="cap-sbar-letter">A</span>Assessment</h4>' +
                '<div class="cap-grid cap-vitals">' +
                    field('BP', 'bp', { tag: 'input' }) +
                    field('HR', 'hr', { tag: 'input' }) +
                    field('RR', 'rr', { tag: 'input' }) +
                    field('Temp', 'temp', { tag: 'input' }) +
                    field('SpO₂', 'spo2', { tag: 'input' }) +
                '</div>' +
                '<div class="cap-grid g2">' +
                    field('O₂ Requirements', 'o2', { tag: 'input' }) +
                    field('Nausea', 'nausea', { tag: 'input' }) +
                '</div>' +
                '<div class="cap-grid g3">' +
                    field('Pain (0–10)', 'pain_level', { tag: 'input', type: 'number', min: 0, max: 10 }) +
                    field('Pain location', 'pain_location', { tag: 'input' }) +
                    field(Who() + ' description', 'pain_description', { tag: 'input' }) +
                '</div>' +
                '<div class="cap-grid g2">' +
                    field('IV access', 'iv', { tag: 'input' }) +
                    field('Fluids running / rate', 'fluids', { tag: 'input' }) +
                '</div>' +
                field('Procedures / scans done', 'procedures', { rows: 2 }) +
                field('Labs drawn & significant results', 'labs', { rows: 2 }) +
                '<div class="cap-grid g3">' +
                    field('Ambulatory status', 'ambulatory', { tag: 'select', optionsHtml:
                        '<option value="">—</option><option>Independent</option><option>Cane</option><option>Walker</option><option>Crutches</option><option>Wheelchair</option><option>Bedbound</option>'
                    }) +
                    field('Fall risk', 'fall_risk', { tag: 'select', optionsHtml:
                        '<option value="">—</option><option>No</option><option>Yes</option>'
                    }) +
                    field('LOC', 'loc', { tag: 'input' }) +
                '</div>' +
                field('Wounds / dressings / ostomies / drains', 'wounds', { rows: 2 }) +
                field('Other assessments', 'other', { rows: 2 }) +
                field('Care plan interventions implemented', 'interventions', { rows: 2 }) +
            '</section>' +
            // R
            '<section class="cap-sbar-block"><h4><span class="cap-sbar-letter">R</span>Recommendations</h4>' +
                field('Recommended action (What would you like the physician to do?)', 'recommendation', { rows: 3 }) +
                field('Other thoughts · Orders received (and repeated back)', 'orders', { rows: 3 }) +
            '</section>'
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- Placeholders for not-yet-implemented modules ----------
    function placeholder(label) {
        return function (rootEl, state, onChange) {
            rootEl.innerHTML = '<div class="cap-tab-empty">' +
                '<strong>' + esc(label) + ' renderer coming in a later commit.</strong>' +
                'A sandbox textarea autosaves to <code>state._sandboxText</code> for now.' +
                '<textarea id="capSandboxTa" rows="6" data-cap-field="_sandboxText" class="cap-tf" style="margin-top:14px;"></textarea>' +
            '</div>';
            bindFields(rootEl, state, onChange);
        };
    }
    R.notes = function (rootEl, state, onChange) {
        rootEl.innerHTML = panelHint(
            'General Notes',
            'Free-form space for shift observations, preceptor feedback, questions for your instructor, etc.',
            '<textarea data-cap-field="text" rows="22" class="cap-tf" style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.7;"></textarea>'
        );
        bindFields(rootEl, state, onChange);
    };
    // ---------- BEHAVIOR (ABC) ----------
    R.behavior = function (rootEl, state, onChange) {
        if (!Array.isArray(state.events)) state.events = [emptyBehavior()];
        function emptyBehavior() {
            return {
                date:'', time:'', location:'',
                ant_going_on:'', ant_what_else:'',
                behavior:'', duration:'',
                cons_interaction:'', cons_what_else:'',
                interventions:'', effect:''
            };
        }
        function render() {
            const eventsHtml = state.events.map(function (ev, i) {
                return '<div class="cap-behavior-event">' +
                    '<div class="cap-behavior-head">' +
                        '<span class="cap-behavior-num">Event ' + (i + 1) + '</span>' +
                        '<button class="cap-row-del" data-del="' + i + '" title="Delete event">&times;</button>' +
                    '</div>' +
                    '<div class="cap-grid g3">' +
                        ev_field('Date', i, 'date', { tag: 'input', type: 'date' }) +
                        ev_field('Time', i, 'time', { tag: 'input', type: 'time' }) +
                        ev_field('Location', i, 'location', { tag: 'input' }) +
                    '</div>' +
                    '<h5 class="cap-behavior-section">B — Behavior (fill out first)</h5>' +
                    '<div class="cap-grid g2">' +
                        ev_field('Behavior — what happened?', i, 'behavior', { rows: 2 }) +
                        ev_field('Duration', i, 'duration', { tag: 'input' }) +
                    '</div>' +
                    '<h5 class="cap-behavior-section">A — Antecedents (what was happening before)</h5>' +
                    '<div class="cap-grid g2">' +
                        ev_field('What was going on?', i, 'ant_going_on', { rows: 2 }) +
                        ev_field('What else?', i, 'ant_what_else', { rows: 2 }) +
                    '</div>' +
                    '<h5 class="cap-behavior-section">C — Consequences (what happened immediately after)</h5>' +
                    '<div class="cap-grid g2">' +
                        ev_field('Interaction with staff/peers', i, 'cons_interaction', { rows: 2 }) +
                        ev_field('What else?', i, 'cons_what_else', { rows: 2 }) +
                    '</div>' +
                    '<div class="cap-grid g2">' +
                        ev_field('Interventions tried', i, 'interventions', { rows: 2 }) +
                        ev_field('Effect of interventions', i, 'effect', { rows: 2 }) +
                    '</div>' +
                '</div>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'Behavioral Assessment Form (ABC)',
                'One entry per event. <strong>B</strong> first (clearly describe), then <strong>A</strong> (what was happening before), then <strong>C</strong> (what happened after, before intervention).',
                eventsHtml +
                '<button class="cap-add-row" id="cap-behavior-add">+ Add behavioral event</button>'
            );
            rootEl.querySelectorAll('textarea[data-ev], input[data-ev]').forEach(function (el) {
                el.addEventListener('input', function () {
                    const i = parseInt(el.dataset.ev, 10);
                    const col = el.dataset.col;
                    if (state.events[i]) {
                        state.events[i][col] = el.value;
                        if (typeof onChange === 'function') onChange();
                    }
                });
            });
            rootEl.querySelectorAll('[data-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.dataset.del, 10);
                    state.events.splice(i, 1);
                    if (!state.events.length) state.events.push(emptyBehavior());
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            const addBtn = rootEl.querySelector('#cap-behavior-add');
            if (addBtn) addBtn.addEventListener('click', function () {
                state.events.push(emptyBehavior());
                if (typeof onChange === 'function') onChange();
                render();
            });
        }
        function ev_field(label, i, col, opts) {
            opts = opts || {};
            const tag = opts.tag || 'textarea';
            const rows = opts.rows || 2;
            const type = opts.type ? ' type="' + opts.type + '"' : '';
            const v = (state.events[i] && state.events[i][col]) || '';
            const ctl = tag === 'textarea'
                ? '<textarea data-ev="' + i + '" data-col="' + col + '" rows="' + rows + '" class="cap-tf">' + esc(v) + '</textarea>'
                : '<input data-ev="' + i + '" data-col="' + col + '"' + type + ' value="' + esc(v) + '" class="cap-tf">';
            return '<div class="cap-field"><label class="cap-label">' + esc(label) + '</label>' + ctl + '</div>';
        }
        render();
    };

    // ---------- NCSBN CLINICAL JUDGMENT MODEL ----------
    // Seven answer boxes, one per row of the Word form's TABLE 6
    // (FORM.NCSBN_ROWS). Stored as state.boxes{s1..s6b} with state._schema = 3.
    // Packets saved with the old six boxes (state.steps[0..5]) are shown
    // through CAP_MODULES.readNcsbn() and only rewritten in the new shape
    // when the student edits a box; state.steps itself is left untouched.
    R.ncsbn = function (rootEl, state, onChange) {
        const isNew = state._schema >= 3 || (state.boxes && typeof state.boxes === 'object');
        const view = CAP.readNcsbn ? CAP.readNcsbn(state) : {};
        const migrated = !isNew && NCSBN_ROWS.some(function (r) { return String(view[r.key] || '').trim(); });
        const stepsHtml = NCSBN_ROWS.map(function (s) {
            return '<div class="cap-ncsbn-step">' +
                '<div class="cap-ncsbn-num' + (s.num.length > 1 ? ' wide' : '') + '">' + esc(s.num) + '</div>' +
                '<div class="cap-ncsbn-body">' +
                    '<h4>' + esc(s.step) + '</h4>' +
                    '<p class="cap-hint" style="margin-bottom:6px;">' + esc(s.prompt) + '</p>' +
                    '<textarea data-ncsbn="' + esc(s.key) + '" rows="3" class="cap-tf" aria-label="' + esc(s.step + ' — ' + s.prompt) + '"></textarea>' +
                '</div>' +
            '</div>';
        }).join('');
        rootEl.innerHTML = panelHint(
            'Six Steps of the NCSBN Clinical Judgment Model',
            'Work through the six steps for this ' + who() + '. One box per row of the program form.',
            (migrated
                ? '<p class="cap-fineprint cap-ncsbn-migrated">Your earlier answers were moved into the matching rows of the program form. ' +
                  'The old Step 3 answer is in the first Step 3 box, Step 4 and Step 5 share one box, and the old Evaluate answer is in the first Step 6 box.</p>'
                : '') +
            stepsHtml
        );
        rootEl.querySelectorAll('textarea[data-ncsbn]').forEach(function (el) {
            const key = el.getAttribute('data-ncsbn');
            el.value = view[key] || '';
            el.addEventListener('input', function () {
                // First edit: write the whole migrated set in the new shape
                if (!state.boxes || typeof state.boxes !== 'object') state.boxes = Object.assign({}, view);
                state._schema = 3;
                state.boxes[key] = el.value;
                view[key] = el.value;
                if (typeof onChange === 'function') onChange();
            });
        });
    };

    // ---------- PROGRESS NOTES (multi-format) ----------
    const NOTE_FORMATS = {
        DAR:       { fields: [ {k:'d',label:'Data'},{k:'a',label:'Action'},{k:'r',label:'Response'} ] },
        DARP:      { fields: [ {k:'d',label:'Data'},{k:'a',label:'Action'},{k:'r',label:'Response'},{k:'p',label:'Plan'} ] },
        Narrative: { fields: [ {k:'narrative',label:'Narrative',rows:6} ] },
        SOAP:      { fields: [ {k:'s',label:'Subjective'},{k:'o',label:'Objective'},{k:'a',label:'Assessment'},{k:'p',label:'Plan'} ] },
        PIE:       { fields: [ {k:'p',label:'Problem'},{k:'i',label:'Intervention'},{k:'e',label:'Evaluation'} ] },
        SOAPIE:    { fields: [ {k:'s',label:'Subjective'},{k:'o',label:'Objective'},{k:'a',label:'Assessment'},{k:'p',label:'Plan'},{k:'i',label:'Intervention'},{k:'e',label:'Evaluation'} ] }
    };
    R.progressNotes = function (rootEl, state, onChange) {
        if (!Array.isArray(state.notes)) state.notes = [emptyNote()];
        function emptyNote() {
            return { format:'DARP', focus:'', date:'', time:'',
                d:'', a:'', r:'', p:'', narrative:'', s:'', o:'', i:'', e:'' };
        }
        function render() {
            const notesHtml = state.notes.map(function (n, i) {
                const fmt = NOTE_FORMATS[n.format] || NOTE_FORMATS.DARP;
                const showFocus = n.format === 'DAR' || n.format === 'DARP';
                const fieldsHtml = fmt.fields.map(function (f) {
                    return '<div class="cap-pn-row">' +
                        '<div class="cap-pn-letter">' + (f.label[0] || '') + '<small>' + esc(f.label) + '</small></div>' +
                        '<textarea data-note="' + i + '" data-col="' + f.k + '" rows="' + (f.rows || 2) + '" class="cap-tf">' + esc(n[f.k] || '') + '</textarea>' +
                    '</div>';
                }).join('');
                return '<div class="cap-pn-note">' +
                    '<div class="cap-pn-head">' +
                        '<span class="cap-pn-num">Note ' + (i + 1) + '</span>' +
                        '<select data-note="' + i + '" data-col="format" class="cap-tf cap-pn-format">' +
                            Object.keys(NOTE_FORMATS).map(function (k) {
                                return '<option' + (k === n.format ? ' selected' : '') + '>' + k + '</option>';
                            }).join('') +
                        '</select>' +
                        '<button class="cap-row-del" data-del="' + i + '" title="Delete note">&times;</button>' +
                    '</div>' +
                    '<div class="cap-grid g3">' +
                        '<div class="cap-field"><label class="cap-label">Date</label><input type="date" data-note="' + i + '" data-col="date" class="cap-tf" value="' + esc(n.date) + '"></div>' +
                        '<div class="cap-field"><label class="cap-label">Time</label><input type="time" data-note="' + i + '" data-col="time" class="cap-tf" value="' + esc(n.time) + '"></div>' +
                        (showFocus
                            ? '<div class="cap-field"><label class="cap-label">Focus</label><input type="text" data-note="' + i + '" data-col="focus" class="cap-tf" value="' + esc(n.focus) + '"></div>'
                            : '<div></div>') +
                    '</div>' +
                    fieldsHtml +
                '</div>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'Nurses Progress Notes',
                'Required per shift: 2 notes for 8-hour, 3 notes for 12-hour shifts. Pick a format per note. Format reference at the bottom.',
                notesHtml +
                '<button class="cap-add-row" id="cap-pn-add">+ Add progress note</button>' +
                '<details class="cap-pn-help"><summary>Format reference</summary>' +
                    '<p><strong>DAR</strong> — Data · Action · Response</p>' +
                    '<p><strong>DARP</strong> — Data · Action · Response · Plan</p>' +
                    '<p><strong>Narrative</strong> — Chronological free-text note</p>' +
                    '<p><strong>SOAP</strong> — Subjective · Objective · Assessment · Plan</p>' +
                    '<p><strong>PIE</strong> — Problem · Intervention · Evaluation</p>' +
                    '<p><strong>SOAPIE</strong> — SOAP + Intervention · Evaluation</p>' +
                '</details>'
            );
            // Wire field inputs
            rootEl.querySelectorAll('[data-note]').forEach(function (el) {
                const i = parseInt(el.dataset.note, 10);
                const col = el.dataset.col;
                const evt = (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time') ? 'change' : 'input';
                el.addEventListener(evt, function () {
                    if (!state.notes[i]) return;
                    state.notes[i][col] = el.value;
                    if (typeof onChange === 'function') onChange();
                    if (col === 'format') render(); // re-render to swap fields
                });
            });
            // Wire delete
            rootEl.querySelectorAll('[data-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.dataset.del, 10);
                    state.notes.splice(i, 1);
                    if (!state.notes.length) state.notes.push(emptyNote());
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            // Wire add
            const addBtn = rootEl.querySelector('#cap-pn-add');
            if (addBtn) addBtn.addEventListener('click', function () {
                state.notes.push(emptyNote());
                if (typeof onChange === 'function') onChange();
                render();
            });
        }
        render();
    };

    // ---------- CARE PLAN (NANDA, single-plan) ----------
    R.carePlan = function (rootEl, state, onChange) {
        function box(title, hint, inner) {
            return '<div class="cap-cp-box">' +
                '<h4>' + esc(title) + '</h4>' +
                (hint ? '<p class="cap-hint">' + hint + '</p>' : '') +
                inner +
            '</div>';
        }
        function intervention(tag, prefix) {
            return '<div class="cap-cp-iv">' +
                '<h5><span class="cap-cp-iv-tag">' + tag + '</span>' + tag + ' Intervention</h5>' +
                field('Intervention', prefix + '_intervention', { rows: 2 }) +
                field('Rationale',    prefix + '_rationale',    { rows: 2 }) +
            '</div>';
        }
        rootEl.innerHTML = panelHint(
            'Nursing Care Plan',
            'NANDA diagnostic structure with SMART goals and Assess / Do / Teach interventions.',
            box('OMEGA-7 / Assessment Finding',
                'Identified issue that can be modified to help ' + who() + ' outcome.<br><em>Example: Air — ' + Who() + ' is on 2L O₂, normally on room air at home.</em>',
                field('', 'finding', { rows: 2 })) +
            box('Nursing Diagnostic Statement',
                'NANDA Dx r/t problem [secondary to medical Dx] aeb signs/symptoms.<br><em>Example: Impaired gas exchange r/t airway obstruction secondary to COPD aeb wheezing, fatigue after 10 ft walking, SpO₂ &lt;88% with exertion.</em>',
                field('', 'dx', { rows: 2 })) +
            box('Short-Term Goal',
                'End of shift or within a week. Begin with the ' + who() + '. SMART: Specific, Measurable, Achievable, Relevant, Timebound.',
                field('Goal', 'st_goal', { rows: 2 }) +
                intervention('Assess', 'st_assess') +
                intervention('Do',     'st_do') +
                intervention('Teach',  'st_teach')) +
            box('Long-Term Goal',
                'Weeks to months. Begin with the ' + who() + '. SMART.',
                field('Goal', 'lt_goal', { rows: 2 }) +
                intervention('Assess', 'lt_assess') +
                intervention('Do',     'lt_do') +
                intervention('Teach',  'lt_teach')) +
            box('Summary of Care',
                'Current interventions/treatments moving ' + who() + ' toward discharge, focused on primary dx.',
                field('', 'summary', { rows: 4 }))
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- HEAD-TO-TOE ASSESSMENT ----------
    // The Word form's regions and items (FORM.H2T in cap-modules.js) in its
    // two-column layout (stacked on phones), with the body diagram in Skin.
    // Each item is stored under its own key (schema 5; state._schema = 5 is
    // stamped on the first edit). An old packet's 9 free-text systems stay
    // under their old keys and show — still editable — as "Previous notes"
    // in the matching region (CAP.readHeadToToe), so nothing is lost.
    // ctx (4th arg) is set when called for the Day 2 instance (headToToe2):
    // ctx.title is the heading, ctx.moduleId keeps element ids distinct.
    const H2T = FORM.H2T || { REGIONS: [], LEGACY: [], BODY: { VIEWS: [], VIEW_BY_KEY: {} } };
    // Where each body view sits in the editor's SVG (viewBox 230 × 352)
    let h2tResizeHandler = null;  // the open H2T editor's resize listener
    const BODY_POS = { front: { x: 5, y: 4 }, back: { x: 125, y: 4 }, head: { x: 5, y: 236 }, feet: { x: 125, y: 236 } };
    function svgNum(n) { return String(Math.round(n * 100) / 100); }
    function bodyShapeSvg(sh) {
        if (sh.e) {
            return '<ellipse class="cap-body-line" cx="' + svgNum(sh.e[0]) + '" cy="' + svgNum(sh.e[1]) + '" rx="' + svgNum(sh.e[2]) + '" ry="' + svgNum(sh.e[3]) + '"/>';
        }
        if (sh.l) {
            return '<polyline class="cap-body-line" points="' + sh.l.map(function (p) { return svgNum(p[0]) + ',' + svgNum(p[1]); }).join(' ') + '"/>';
        }
        if (sh.p && CAP.bodyCurves) {
            const d = 'M' + svgNum(sh.p[0][0]) + ' ' + svgNum(sh.p[0][1]) + CAP.bodyCurves(sh.p, sh.closed).map(function (s) {
                return ' C' + svgNum(s.c1[0]) + ' ' + svgNum(s.c1[1]) + ' ' + svgNum(s.c2[0]) + ' ' + svgNum(s.c2[1]) + ' ' + svgNum(s.p[0]) + ' ' + svgNum(s.p[1]);
            }).join('') + (sh.closed ? ' Z' : '');
            return '<path class="cap-body-line" d="' + d + '"/>';
        }
        return '';
    }
    R.headToToe = function (rootEl, state, onChange, ctx) {
        ctx = ctx || {};
        const uid = 'h2t' + (ctx.moduleId ? '-' + String(ctx.moduleId).replace(/[^A-Za-z0-9_-]/g, '') : '');
        const view = CAP.readHeadToToe ? CAP.readHeadToToe(state) : { values: {}, markers: [], legacy: [], isNew: false };
        const vals = view.values;
        const markers = view.markers;
        const VIEWS = H2T.BODY.VIEWS;
        const legacyByRegion = {};
        view.legacy.forEach(function (l) { (legacyByRegion[l.region] = legacyByRegion[l.region] || []).push(l); });
        const regionTitle = {};
        H2T.REGIONS.forEach(function (r) { regionTitle[r.id] = r.title; });

        function changed() {
            state._schema = 5;
            if (typeof onChange === 'function') onChange();
        }
        // Grow a textarea to its content (border included) so answers never clip
        function grow(ta) {
            if (!ta || ta.tagName !== 'TEXTAREA') return;
            ta.style.height = 'auto';
            const border = ta.offsetHeight - ta.clientHeight;
            if (ta.scrollHeight) ta.style.height = (ta.scrollHeight + Math.max(0, border)) + 'px';
        }
        // Column widths settle after the first layout (and change on resize /
        // rotation), so size every box again then.
        function regrowAll() { rootEl.querySelectorAll('textarea.cap-h2t-tf').forEach(grow); }
        if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(regrowAll);
        const onResize = function () {
            if (!rootEl.querySelector('.cap-h2t-cols')) { window.removeEventListener('resize', onResize); return; }
            regrowAll();
        };
        if (h2tResizeHandler) window.removeEventListener('resize', h2tResizeHandler);
        h2tResizeHandler = onResize;
        window.addEventListener('resize', onResize);
        function fid(key) { return uid + '-' + key; }
        function tf(id, ariaLabel, cls) {
            return '<textarea id="' + fid(id) + '" rows="1" class="cap-tf cap-h2t-tf' + (cls ? ' ' + cls : '') + '" data-h2t="' + esc(id) + '"' +
                (ariaLabel ? ' aria-label="' + esc(ariaLabel) + '"' : '') + '>' + esc(vals[id] || '') + '</textarea>';
        }
        // ctxLabel: region (and group) name, so a screen reader hears
        // "Upper Extremities, ROM: Left" rather than just "Left".
        function textHtml(it, sub) {
            return '<div class="cap-h2t-item' + (sub || it.sub ? ' sub' : '') + '">' +
                '<label class="cap-h2t-lbl" for="' + fid(it.id) + '">' + esc(it.label) + '</label>' +
                tf(it.id) +
            '</div>';
        }
        function checksHtml(it, sub, ctxLabel) {
            const v = vals[it.id];
            const name = [ctxLabel, it.label || it.opts.map(function (o) { return o.label; }).join(' / ')].filter(Boolean).join(', ') +
                (it.single ? ' (choose one)' : '');
            return '<div class="cap-h2t-item' + (sub || it.sub ? ' sub' : '') + '">' +
                '<span class="cap-h2t-lbl" aria-hidden="true">' + esc(it.label) + '</span>' +
                '<div class="cap-h2t-checks" role="group" aria-label="' + esc(name) + '">' +
                    it.opts.map(function (o) {
                        const on = it.single ? v === o.key : !!(v && v[o.key]);
                        return '<label class="cap-h2t-chk' + (on ? ' selected' : '') + '">' +
                            '<input type="checkbox" data-h2t-chk="' + esc(it.id) + '" data-opt="' + esc(o.key) + '"' +
                                (it.single ? ' data-single="1"' : '') + (on ? ' checked' : '') + '>' +
                            '<span>' + esc(o.label) + '</span>' +
                        '</label>';
                    }).join('') +
                '</div>' +
            '</div>';
        }
        function inlineHtml(it) {
            return '<div class="cap-h2t-item cap-h2t-inline">' +
                '<span class="cap-h2t-lbl">' + esc(it.label) + '</span>' +
                '<div class="cap-h2t-fields">' + it.fields.map(function (f) {
                    if (f.ids) {
                        const aria = f.aria || [f.label, f.label];
                        return '<span class="cap-h2t-mini cap-h2t-split"><label for="' + fid(f.ids[0]) + '">' + esc(f.label) + '</label>' +
                            tf(f.ids[0], aria[0]) + '<span class="cap-h2t-sep" aria-hidden="true">' + esc(f.sep || '/') + '</span>' + tf(f.ids[1], aria[1]) +
                        '</span>';
                    }
                    return '<span class="cap-h2t-mini"><label for="' + fid(f.id) + '">' + esc(f.label) + '</label>' + tf(f.id) + '</span>';
                }).join('') + '</div>' +
            '</div>';
        }
        function gridHtml(it, ctxLabel) {
            return '<div class="cap-h2t-group" role="group" aria-label="' + esc(ctxLabel + ', ' + it.label) + '">' +
                '<div class="cap-h2t-lbl cap-h2t-grouplbl" aria-hidden="true">' + esc(it.label) + '</div>' +
                '<div class="cap-h2t-grid2">' + it.fields.map(function (f) {
                    return '<div class="cap-h2t-cell"><label class="cap-h2t-lbl" for="' + fid(f.id) + '">' + esc(f.label) + '</label>' + tf(f.id) + '</div>';
                }).join('') + '</div>' +
            '</div>';
        }
        function itemHtml(it, ctxLabel, sub) {
            if (it.type === 'text') return textHtml(it, sub);
            if (it.type === 'checks') return checksHtml(it, sub, ctxLabel);
            if (it.type === 'inline') return inlineHtml(it);
            if (it.type === 'grid') return gridHtml(it, ctxLabel);
            if (it.type === 'group') {
                return '<div class="cap-h2t-group">' +
                    '<div class="cap-h2t-lbl cap-h2t-grouplbl">' + esc(it.label) + '</div>' +
                    it.items.map(function (x) { return itemHtml(x, ctxLabel + ', ' + it.label.replace(/:$/, ''), true); }).join('') +
                '</div>';
            }
            if (it.type === 'body') return '<div class="cap-body" id="' + fid('body') + '"></div>';
            return '';
        }
        function legacyHtml(regionId) {
            return (legacyByRegion[regionId] || []).map(function (l) {
                return '<div class="cap-h2t-prev">' +
                    '<label class="cap-h2t-lbl" for="' + fid('prev-' + l.key) + '">Previous notes — ' + esc(l.label) + '</label>' +
                    '<textarea id="' + fid('prev-' + l.key) + '" rows="2" class="cap-tf cap-h2t-tf" data-h2t="' + esc(l.key) + '">' + esc(l.text) + '</textarea>' +
                '</div>';
            }).join('');
        }
        function regionHtml(r) {
            return '<section class="cap-h2t-region" aria-labelledby="' + fid('r-' + r.id) + '">' +
                '<h4 id="' + fid('r-' + r.id) + '">' + esc(r.title) + '</h4>' +
                r.items.map(function (it) { return itemHtml(it, r.title, false); }).join('') +
                legacyHtml(r.id) +
            '</section>';
        }
        function colHtml(col) {
            return '<div class="cap-h2t-col">' + H2T.REGIONS.filter(function (r) { return r.col === col; }).map(regionHtml).join('') + '</div>';
        }
        const migratedNote = (view.legacy.length && !view.isNew)
            ? '<p class="cap-fineprint cap-ncsbn-migrated">This Head-to-Toe now follows the program\'s form. What you wrote earlier is kept as "Previous notes" in the matching section: ' +
              esc(view.legacy.map(function (l) { return l.label + ' → ' + (regionTitle[l.region] || l.region); }).join(' · ')) + '.</p>'
            : '';

        rootEl.innerHTML = panelHint(
            ctx.title || H2T.TITLE || 'Head-to-Toe Assessment',
            (ctx.hint ? esc(ctx.hint) + ' ' : '') + 'Laid out like the program\'s form. Tick what applies and fill in the blanks — anything left empty prints as a blank line for your instructor.',
            migratedNote +
            '<div class="cap-h2t-cols">' + colHtml('L') + colHtml('R') + '</div>'
        );

        // ---- text fields (incl. "Previous notes", bound to their old keys) ----
        rootEl.querySelectorAll('textarea[data-h2t]').forEach(function (ta) {
            grow(ta);
            ta.addEventListener('input', function () {
                state[ta.getAttribute('data-h2t')] = ta.value;
                grow(ta);
                changed();
            });
        });
        // ---- checkboxes: single-select groups behave like radios that can be
        // cleared again; multi-select store { option: true } ----
        rootEl.querySelectorAll('input[type="checkbox"][data-h2t-chk]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                const id = cb.getAttribute('data-h2t-chk');
                const opt = cb.getAttribute('data-opt');
                const group = rootEl.querySelectorAll('input[type="checkbox"][data-h2t-chk="' + id + '"]');
                if (cb.hasAttribute('data-single')) {
                    group.forEach(function (o) { if (o !== cb) o.checked = false; });
                    state[id] = cb.checked ? opt : '';
                } else {
                    const cur = (state[id] && typeof state[id] === 'object') ? state[id] : {};
                    const next = {};
                    Object.keys(cur).forEach(function (k) { if (cur[k]) next[k] = true; });
                    if (cb.checked) next[opt] = true; else delete next[opt];
                    if (Object.keys(next).length) state[id] = next; else delete state[id];
                }
                group.forEach(function (o) {
                    const lbl = o.closest('.cap-h2t-chk');
                    if (lbl) lbl.classList.toggle('selected', o.checked);
                });
                changed();
            });
        });

        // ---- body diagram (Skin) ----
        const bodyItem = (function () {
            let found = null;
            H2T.REGIONS.forEach(function (r) { r.items.forEach(function (it) { if (it.type === 'body') found = it; }); });
            return found;
        })();
        const bodyEl = document.getElementById(fid('body'));
        if (!bodyItem || !bodyEl) return;

        function commitMarkers() {
            state[bodyItem.id] = markers.map(function (m) { return { view: m.view, x: m.x, y: m.y, note: m.note }; });
            changed();
        }
        function round4(n) { return Math.round(Math.max(0, Math.min(1, n)) * 10000) / 10000; }
        function viewLabel(key) { const v = H2T.BODY.VIEW_BY_KEY[key]; return v ? v.label : key; }
        function svgHtml() {
            let s = '<svg class="cap-body-svg" viewBox="0 0 230 352" xmlns="http://www.w3.org/2000/svg" role="img" aria-describedby="' + fid('body-help') + '"' +
                ' aria-label="Body diagram: front, back, top of head and soles of feet, with ' + markers.length + ' marker' + (markers.length === 1 ? '' : 's') + '">';
            VIEWS.forEach(function (v) {
                const o = BODY_POS[v.key] || { x: 0, y: 0 };
                s += '<g transform="translate(' + o.x + ' ' + o.y + ')">' +
                    '<rect class="cap-body-hit" x="0" y="0" width="' + v.w + '" height="' + v.h + '"/>' +
                    v.shapes.map(bodyShapeSvg).join('') +
                    (v.sides ? '<text class="cap-body-side" x="3" y="60">' + esc(v.sides[0]) + '</text>' +
                               '<text class="cap-body-side" x="' + (v.w - 3) + '" y="60" text-anchor="end">' + esc(v.sides[1]) + '</text>' : '') +
                    '<text class="cap-body-lbl" x="' + (v.w / 2) + '" y="' + (v.h + 8) + '" text-anchor="middle">' + esc(v.label) + '</text>' +
                '</g>';
            });
            markers.forEach(function (m, i) {
                const v = H2T.BODY.VIEW_BY_KEY[m.view];
                const o = BODY_POS[m.view];
                if (!v || !o || m.x == null || m.y == null) return; // list-only marker
                const cx = svgNum(o.x + m.x * v.w), cy = svgNum(o.y + m.y * v.h);
                s += '<g class="cap-body-marker" data-mk="' + i + '">' +
                    '<circle cx="' + cx + '" cy="' + cy + '" r="5.5"/>' +
                    '<text x="' + cx + '" y="' + cy + '" dy="2.1" text-anchor="middle">' + (i + 1) + '</text>' +
                '</g>';
            });
            return s + '</svg>';
        }
        function listHtml() {
            const opts = function (sel) {
                return VIEWS.map(function (v) {
                    return '<option value="' + esc(v.key) + '"' + (v.key === sel ? ' selected' : '') + '>' + esc(v.label) + '</option>';
                }).join('');
            };
            return (markers.length
                ? '<ol class="cap-body-list">' + markers.map(function (m, i) {
                    const n = i + 1;
                    const off = m.x == null || m.y == null;
                    return '<li class="cap-body-mk' + (off ? ' unplaced' : '') + '" data-mk-row="' + i + '">' +
                        '<span class="cap-body-num" aria-hidden="true"' + (off ? ' title="Not on the diagram — listed only"' : '') + '>' + n + '</span>' +
                        '<select class="cap-tf" data-mk-view="' + i + '" aria-label="Marker ' + n + ' — view' + (off ? ' (not on the diagram)' : '') + '">' + opts(m.view) + '</select>' +
                        '<textarea class="cap-tf cap-h2t-tf" rows="1" data-mk-note="' + i + '" aria-label="Marker ' + n + ' — finding"' +
                            ' placeholder="Finding, e.g. stage 2 pressure injury 2 × 3 cm">' + esc(m.note) + '</textarea>' +
                        '<button type="button" class="cap-row-del" data-mk-del="' + i + '" title="Remove marker ' + n + '" aria-label="Remove marker ' + n + '">&times;</button>' +
                    '</li>';
                }).join('') + '</ol>'
                : '<p class="cap-fineprint">No markers yet.</p>') +
                '<button type="button" class="cap-add-row" data-mk-add>+ Add a marker without the diagram</button>';
        }
        function setActive(i) {
            bodyEl.querySelectorAll('.cap-body-marker').forEach(function (g) {
                g.classList.toggle('active', g.getAttribute('data-mk') === String(i));
            });
        }
        function focusNote(i) {
            const ta = bodyEl.querySelector('textarea[data-mk-note="' + i + '"]');
            if (ta) { ta.focus(); setActive(i); }
        }
        function renderBody() {
            bodyEl.innerHTML =
                '<div class="cap-h2t-lbl cap-h2t-grouplbl">' + esc(bodyItem.label) + '</div>' +
                '<p class="cap-fineprint" id="' + fid('body-help') + '">Tap the diagram where a finding is to place a numbered marker, then describe it below. ' +
                    'Without the diagram: add a marker, pick its view and describe where it is — it is listed (dashed number) but not drawn on the figure.</p>' +
                svgHtml() +
                listHtml();
            const svg = bodyEl.querySelector('svg');
            svg.addEventListener('click', function (ev) {
                const hit = ev.target && ev.target.closest ? ev.target.closest('[data-mk]') : null;
                if (hit) { focusNote(parseInt(hit.getAttribute('data-mk'), 10)); return; }
                const rect = svg.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const px = (ev.clientX - rect.left) * 230 / rect.width;
                const py = (ev.clientY - rect.top) * 352 / rect.height;
                let placed = null;
                VIEWS.forEach(function (v) {
                    const o = BODY_POS[v.key];
                    if (!o || placed) return;
                    if (px >= o.x && px <= o.x + v.w && py >= o.y && py <= o.y + v.h) {
                        placed = { view: v.key, x: round4((px - o.x) / v.w), y: round4((py - o.y) / v.h), note: '' };
                    }
                });
                if (!placed) return;
                markers.push(placed);
                commitMarkers();
                renderBody();
                focusNote(markers.length - 1);
            });
            bodyEl.querySelectorAll('textarea[data-mk-note]').forEach(function (ta) {
                grow(ta);
                const i = parseInt(ta.getAttribute('data-mk-note'), 10);
                ta.addEventListener('focus', function () { setActive(i); });
                ta.addEventListener('input', function () {
                    if (!markers[i]) return;
                    markers[i].note = ta.value;
                    grow(ta);
                    commitMarkers();
                });
            });
            bodyEl.querySelectorAll('select[data-mk-view]').forEach(function (sel) {
                const i = parseInt(sel.getAttribute('data-mk-view'), 10);
                sel.addEventListener('focus', function () { setActive(i); });
                sel.addEventListener('change', function () {
                    if (!markers[i] || !H2T.BODY.VIEW_BY_KEY[sel.value]) return;
                    markers[i].view = sel.value;
                    commitMarkers();
                    renderBody();
                    const again = bodyEl.querySelector('select[data-mk-view="' + i + '"]');
                    if (again) { again.focus(); setActive(i); }
                });
            });
            bodyEl.querySelectorAll('[data-mk-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.getAttribute('data-mk-del'), 10);
                    if (!markers[i]) return;
                    function remove() {
                        markers.splice(i, 1);
                        commitMarkers();
                        renderBody();
                        const next = bodyEl.querySelector('[data-mk-del="' + Math.min(i, markers.length - 1) + '"]') || bodyEl.querySelector('[data-mk-add]');
                        if (next) next.focus();
                    }
                    if (String(markers[i].note || '').trim() && typeof window.showConfirmModal === 'function') {
                        window.showConfirmModal('Remove marker ' + (i + 1) + '?', 'Its note (' + viewLabel(markers[i].view) + ') will be deleted and the markers after it renumbered.', remove, { confirmText: 'Remove', danger: true });
                    } else {
                        remove();
                    }
                });
            });
            const add = bodyEl.querySelector('[data-mk-add]');
            if (add) add.addEventListener('click', function () {
                // No position: a list-only marker is never drawn on the figure,
                // so it can't point the instructor at the wrong spot.
                markers.push({ view: 'front', x: null, y: null, note: '' });
                commitMarkers();
                renderBody();
                focusNote(markers.length - 1);
            });
        }
        renderBody();
    };

    // ---------- HENDRICH II FALL MODEL ----------
    // Factor checkboxes with a findings column beside each (state.notes[id],
    // additive — older packets simply have none), then the Get Up & Go Test.
    R.hendrich = function (rootEl, state, onChange) {
        if (!state.factors) state.factors = {};
        if (state.getUpGo == null) state.getUpGo = '';
        function render() {
            const notes = (state.notes && typeof state.notes === 'object') ? state.notes : {};
            const factorsHtml = HENDRICH.FACTORS.map(function (f) {
                const isOn = !!state.factors[f.id];
                return '<div class="cap-hendrich-item">' +
                    '<label class="cap-hendrich-row' + (isOn ? ' selected' : '') + '">' +
                        '<input type="checkbox" data-hendrich="' + f.id + '"' + (isOn ? ' checked' : '') + '>' +
                        '<span class="cap-hendrich-label">' + esc(f.label) + '</span>' +
                        '<span class="cap-hendrich-pts">' + f.pts + '</span>' +
                    '</label>' +
                    '<textarea class="cap-tf cap-hendrich-note" rows="1" data-hnote="' + f.id + '" placeholder="Findings" aria-label="' + esc('Findings — ' + f.label) + '">' + esc(notes[f.id]) + '</textarea>' +
                '</div>';
            }).join('');
            const ugHtml = HENDRICH.GUG.map(function (o) {
                const isOn = state.getUpGo !== '' && state.getUpGo != null && String(state.getUpGo) === String(o.val);
                return '<label class="cap-morse-opt' + (isOn ? ' selected' : '') + '">' +
                    '<input type="radio" name="cap-hendrich-ug" value="' + o.val + '" data-ug' + (isOn ? ' checked' : '') + '>' +
                    '<span>' + esc(o.label) +
                        (o.qualifier ? '<small class="cap-ug-qual">' + esc(o.qualifier) + '</small>' : '') +
                        (o.note ? '<small class="cap-ug-qual">' + esc(o.note) + '</small>' : '') +
                    '</span>' +
                    '<span class="cap-morse-pts">' + o.val + '</span>' +
                '</label>';
            }).join('');
            const sc = CAP.scoreHendrich(state);
            rootEl.innerHTML = panelHint(
                HENDRICH.TITLE,
                'Check each risk factor present and note the findings beside it, then score the Get Up &amp; Go Test. ' + esc(HENDRICH.HIGH) + '.',
                '<div class="cap-hendrich-head" aria-hidden="true"><span>Risk factor · points</span><span>Findings</span></div>' +
                '<div class="cap-hendrich-list">' + factorsHtml + '</div>' +
                '<h4 style="margin:14px 0 6px;font-size:13px;color:var(--clx-text-primary);">' + esc(HENDRICH.GUG_TITLE) + '</h4>' +
                '<div class="cap-morse-opts" role="radiogroup" aria-label="' + esc(HENDRICH.GUG_TITLE) + '">' + ugHtml + '</div>' +
                scoreBlock(sc.scored ? sc.total : '—', 'Total Score', sc.label, sc.cls) +
                '<p class="cap-fineprint">' + esc(HENDRICH.HIGH) + '</p>'
            );
            rootEl.querySelectorAll('input[type="checkbox"][data-hendrich]').forEach(function (cb) {
                cb.addEventListener('change', function () {
                    const id = cb.dataset.hendrich;
                    state.factors[id] = cb.checked;
                    if (typeof onChange === 'function') onChange();
                    render();
                    refocus(rootEl, 'input[type="checkbox"][data-hendrich]', { 'data-hendrich': id });
                });
            });
            rootEl.querySelectorAll('input[type="radio"][data-ug]').forEach(function (r) {
                r.addEventListener('change', function () {
                    const val = r.value;
                    state.getUpGo = val;
                    if (typeof onChange === 'function') onChange();
                    render();
                    refocus(rootEl, 'input[type="radio"][data-ug]', { value: val });
                });
            });
            rootEl.querySelectorAll('textarea[data-hnote]').forEach(function (ta) {
                autoGrow(ta);
                ta.addEventListener('input', function () {
                    if (!state.notes || typeof state.notes !== 'object') state.notes = {};
                    state.notes[ta.getAttribute('data-hnote')] = ta.value;
                    autoGrow(ta);
                    if (typeof onChange === 'function') onChange();
                });
            });
        }
        render();
    };

    // ---------- APA REFERENCES ----------
    R.references = function (rootEl, state, onChange) {
        if (!Array.isArray(state.refs)) state.refs = [''];
        function render() {
            const rowsHtml = state.refs.map(function (r, i) {
                return '<div class="cap-ref-row">' +
                    '<span class="cap-ref-num">' + (i + 1) + '.</span>' +
                    '<textarea data-ref="' + i + '" rows="3" class="cap-tf" placeholder="Author, A. A. (Year). Title of work. Journal Name, Volume(Issue), pages. https://doi.org/...">' + esc(r) + '</textarea>' +
                    '<button class="cap-row-del" data-del="' + i + '" title="Delete reference">&times;</button>' +
                '</div>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'APA References',
                'Hanging-indent format. Minimum 2 references published within the last 5 years (typical NUR requirement). For URL-based citations, use the <a href="/apa/" target="_blank" style="color:var(--clx-accent);">APA Generator</a> tool to autobuild and paste here.',
                rowsHtml +
                '<button class="cap-add-row" id="cap-ref-add">+ Add reference</button>'
            );
            rootEl.querySelectorAll('textarea[data-ref]').forEach(function (ta) {
                ta.addEventListener('input', function () {
                    const i = parseInt(ta.dataset.ref, 10);
                    state.refs[i] = ta.value;
                    if (typeof onChange === 'function') onChange();
                });
            });
            rootEl.querySelectorAll('[data-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.dataset.del, 10);
                    state.refs.splice(i, 1);
                    if (!state.refs.length) state.refs.push('');
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            const addBtn = rootEl.querySelector('#cap-ref-add');
            if (addBtn) addBtn.addEventListener('click', function () {
                state.refs.push('');
                if (typeof onChange === 'function') onChange();
                render();
            });
        }
        render();
    };

    // ---------- NURSING CONCEPT MAP (Word form, page 1) ----------
    // The form's boxes (FORM.CONCEPT_MAP) laid out as the map on wide screens
    // (each box placed on a 3 x 3 grid, Diagnosis / PMH / HPI in the centre,
    // connectors drawn in an SVG overlay), stacked row by row on phones.
    // Below it, the optional "Care plan detail" block: the pre-6/24 problem
    // list (state.problems), unchanged.
    // Old packets are read through CAP.readConceptMap(): nothing is written
    // until the student edits; the first edit adopts the migrated values in
    // the new shape (state._schema = 6). state.problems / state.center are
    // never deleted — center shows as "Previous notes" in the Diagnosis box.
    const CONCEPT_MAP = FORM.CONCEPT_MAP || { BOXES: [], CONNECT: [], TEXT_KEYS: [], PROBLEM_FIELDS: [] };
    R.conceptMap = function (rootEl, state, onChange) {
        const CM = CONCEPT_MAP;
        let view = null;
        let m = null;            // { dx: [], problems: [] } — the lists the inputs edit
        let detailOpen = null;   // remembered across re-renders once toggled
        let ro = null;
        let mapEl = null;
        function changed() { if (typeof onChange === 'function') onChange(); }
        function emptyProblem() {
            return { name:'', data:'', dx:'', goals:'', interventions:'', evaluation:'' };
        }
        function strv(v) { return v == null ? '' : String(v); }
        // Another module's state slice (Patient Info, Medications), when the
        // editor provides it
        function other(id) {
            const s = typeof CTX.getState === 'function' ? CTX.getState(id) : null;
            return s && typeof s === 'object' ? s : {};
        }
        // First edit of an old-shape slice: write the migrated view in the
        // new shape. Old keys are left as they are.
        function adopt() {
            if (state._schema >= 6) return;
            CM.TEXT_KEYS.forEach(function (k) {
                if (state[k] == null) state[k] = view.fields[k];
            });
            state.nursingDx = m.dx;
            state.problems = m.problems;
            state._schema = 6;
        }
        function problemHasData(p) {
            return ['name'].concat(CM.PROBLEM_FIELDS.map(function (f) { return f.key; }))
                .some(function (k) { return strv(p[k]).trim() !== ''; });
        }
        function medNames() {
            const rows = other('meds').rows;
            const list = Array.isArray(rows) ? rows : (rows && typeof rows === 'object'
                ? Object.keys(rows).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return rows[k]; }) : []);
            return list.map(function (r) {
                return r && typeof r === 'object' ? strv(r.order).split('\n')[0].trim() : '';
            }).filter(function (t) { return t !== ''; });
        }

        function fieldHtml(f) {
            const id = 'capCm-' + f.key;
            if (f.multi) {
                return '<div class="cap-cm-lbl" id="' + id + '-lbl">' + esc(f.label) + '</div>' +
                    '<ol class="cap-cm-list" aria-labelledby="' + id + '-lbl">' +
                    m.dx.map(function (t, i) {
                        return '<li class="cap-cm-item">' +
                            '<span class="cap-cm-num" aria-hidden="true">' + (i + 1) + '.</span>' +
                            '<textarea data-cmdx="' + i + '" rows="2" class="cap-tf cap-cm-tf" aria-label="Nursing diagnosis ' + (i + 1) + '">' + esc(t) + '</textarea>' +
                            '<button type="button" class="cap-row-del" data-cmdx-del="' + i + '" title="Remove nursing diagnosis" aria-label="Remove nursing diagnosis ' + (i + 1) + '">&times;</button>' +
                        '</li>';
                    }).join('') +
                    '</ol>' +
                    '<button type="button" class="cap-add-row cap-cm-add" data-cmdx-add="1">+ Add nursing diagnosis</button>';
            }
            let extra = '';
            const cur = view.fields[f.key] || '';
            if (f.key === 'diagnosis' && !cur.trim()) {
                const dx = strv(other('info').res_dx).trim();
                if (dx) {
                    extra = '<button type="button" class="cap-btn-sm cap-cm-copy" data-cm-copy="diagnosis">' +
                        '<span>Use Primary Diagnosis from Patient Info: <strong>' + esc(dx.length > 60 ? dx.slice(0, 57) + '…' : dx) + '</strong></span></button>';
                }
            }
            if (f.key === 'medications' && !cur.trim()) {
                const n = medNames().length;
                if (n) {
                    extra = '<button type="button" class="cap-btn-sm cap-cm-copy" data-cm-copy="medications">' +
                        'Copy names from Medications (' + n + ')</button>';
                }
            }
            return '<label class="cap-cm-lbl" for="' + id + '">' + esc(f.label) + '</label>' +
                '<textarea id="' + id + '" data-cmf="' + esc(f.key) + '" rows="3" class="cap-tf cap-cm-tf">' + esc(cur) + '</textarea>' +
                extra;
        }

        function boxHtml(b) {
            let inner = b.fields.map(fieldHtml).join('');
            if (b.center && view.center.trim()) {
                inner += '<div class="cap-cm-prev">' +
                    '<label class="cap-cm-lbl" for="capCm-center">' + esc(CM.PREVIOUS_CENTER) + '</label>' +
                    '<textarea id="capCm-center" data-cmc="1" rows="2" class="cap-tf cap-cm-tf">' + esc(view.center) + '</textarea>' +
                '</div>';
            }
            return '<div class="cap-cm-box' + (b.center ? ' center' : '') + '" data-box="' + esc(b.id) + '"' +
                ' style="--cm-row:' + (b.row | 0) + ';--cm-col:' + (b.col | 0) + ';">' + inner + '</div>';
        }

        function problemHtml(p, i) {
            return '<div class="cap-cm-problem">' +
                '<div class="cap-cm-head">' +
                    '<input type="text" data-cm="' + i + '" data-col="name" value="' + esc(p.name) + '" placeholder="Problem name (e.g., Impaired Skin Integrity)" class="cap-tf cap-cm-name" aria-label="Problem ' + (i + 1) + ' name">' +
                    '<button type="button" class="cap-row-del" data-cm-del="' + i + '" title="Remove problem" aria-label="Remove problem ' + (i + 1) + '">&times;</button>' +
                '</div>' +
                '<div class="cap-cm-grid">' +
                    CM.PROBLEM_FIELDS.map(function (f) {
                        const id = 'capCmP' + i + '-' + f.key;
                        return '<div class="cap-field"><label class="cap-label" for="' + id + '">' + esc(f.label) + '</label>' +
                            '<textarea id="' + id + '" data-cm="' + i + '" data-col="' + esc(f.key) + '" rows="2" class="cap-tf">' + esc(p[f.key]) + '</textarea></div>';
                    }).join('') +
                '</div>' +
            '</div>';
        }

        // Connectors between the boxes (wide layout only). Each line runs
        // centre to centre, clipped at both boxes' borders.
        function drawLinks() {
            const map = mapEl;
            const svg = map && map.querySelector('.cap-cm-links');
            if (!map || !svg || !map.isConnected) { if (ro) ro.disconnect(); return; }
            if (window.getComputedStyle(svg).display === 'none') return;
            const mr = map.getBoundingClientRect();
            const boxes = {};
            map.querySelectorAll('.cap-cm-box[data-box]').forEach(function (el) {
                const r = el.getBoundingClientRect();
                boxes[el.getAttribute('data-box')] = { cx: r.left - mr.left + r.width / 2, cy: r.top - mr.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
            });
            function edge(b, dx, dy) {
                const t = Math.min(dx ? b.hw / Math.abs(dx) : Infinity, dy ? b.hh / Math.abs(dy) : Infinity);
                return [b.cx + dx * t, b.cy + dy * t];
            }
            let lines = '';
            (CM.CONNECT || []).forEach(function (c) {
                const a = boxes[c[0]], b = boxes[c[1]];
                if (!a || !b) return;
                const dx = b.cx - a.cx, dy = b.cy - a.cy;
                if (!dx && !dy) return;
                const p = edge(a, dx, dy), q = edge(b, -dx, -dy);
                lines += '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"' +
                    (c[2] ? ' marker-end="url(#capCmArrow)"' : '') + '></line>';
            });
            svg.setAttribute('viewBox', '0 0 ' + Math.max(1, mr.width).toFixed(0) + ' ' + Math.max(1, mr.height).toFixed(0));
            svg.innerHTML = '<defs><marker id="capCmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
                '<path d="M0,0 L10,5 L0,10 z" class="cap-cm-arrowhead"></path></marker></defs>' + lines;
        }

        function render() {
            if (ro) { ro.disconnect(); ro = null; }
            view = CAP.readConceptMap ? CAP.readConceptMap(state)
                : { fields: {}, nursingDx: [], problems: [], center: '', isNew: true, migrated: false };
            if (view.isNew) {
                // Normalised in memory (RTDB may hand lists back as objects)
                state.nursingDx = view.nursingDx.slice();
                state.problems = view.problems;
                m = { dx: state.nursingDx, problems: state.problems };
            } else {
                m = { dx: view.nursingDx.slice(), problems: view.problems };
            }
            if (!m.dx.length) m.dx.push('');
            const anyDetail = m.problems.some(problemHasData);
            const open = detailOpen != null ? detailOpen : anyDetail;

            rootEl.innerHTML = panelHint(
                CM.TITLE || 'Nursing Concept Map',
                'Put the ' + who() + '\'s primary diagnosis at the center and fill in each box of the program form. ' +
                'The map prints on its own landscape page; anything too long for a box continues on the next page.',
                (view.migrated
                    ? '<p class="cap-fineprint cap-ncsbn-migrated">This concept map now follows the program\'s form. ' +
                      'Your earlier nursing diagnoses and interventions were copied into <strong>Nursing Diagnoses</strong> and <strong>Nursing Interventions</strong>; ' +
                      'every problem you wrote is still below under <strong>Care plan detail</strong>.</p>'
                    : '') +
                '<div class="cap-cm-map">' +
                    '<svg class="cap-cm-links" aria-hidden="true" focusable="false"></svg>' +
                    // Row by row, as the wide map (and the printed form)
                    // reads, so Tab / screen-reader order follows the layout
                    CM.BOXES.slice().sort(function (a, b) { return (a.row - b.row) || (a.col - b.col); }).map(boxHtml).join('') +
                '</div>' +
                '<details class="cap-cm-detail"' + (open ? ' open' : '') + '>' +
                    '<summary>' + esc(CM.DETAIL_TITLE || 'Care plan detail') + ' <span class="cap-cm-opt">(optional)</span></summary>' +
                    '<div class="cap-cm-detail-body">' +
                        '<p class="cap-hint">For each problem: supporting data → NANDA diagnosis → goals → interventions and rationales → evaluation criteria. Prints after the map.</p>' +
                        m.problems.map(problemHtml).join('') +
                        '<button type="button" class="cap-add-row" data-cm-add="1">+ Add problem</button>' +
                    '</div>' +
                '</details>'
            );

            // Map text boxes
            rootEl.querySelectorAll('textarea[data-cmf]').forEach(function (ta) {
                const key = ta.getAttribute('data-cmf');
                autoGrow(ta);
                ta.addEventListener('input', function () {
                    adopt();
                    state[key] = ta.value;
                    autoGrow(ta);
                    changed();
                });
            });
            // Nursing Diagnoses entries
            rootEl.querySelectorAll('textarea[data-cmdx]').forEach(function (ta) {
                const i = parseInt(ta.getAttribute('data-cmdx'), 10);
                autoGrow(ta);
                ta.addEventListener('input', function () {
                    adopt();
                    m.dx[i] = ta.value;
                    autoGrow(ta);
                    changed();
                });
            });
            rootEl.querySelectorAll('[data-cmdx-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.getAttribute('data-cmdx-del'), 10);
                    adopt();
                    m.dx.splice(i, 1);
                    changed();
                    render();
                });
            });
            const dxAdd = rootEl.querySelector('[data-cmdx-add]');
            if (dxAdd) dxAdd.addEventListener('click', function () {
                adopt();
                m.dx.push('');
                changed();
                render();
                const last = rootEl.querySelector('textarea[data-cmdx="' + (m.dx.length - 1) + '"]');
                if (last) last.focus();
            });
            // Previous notes (old center summary), bound to its old key
            const prev = rootEl.querySelector('textarea[data-cmc]');
            if (prev) {
                autoGrow(prev);
                prev.addEventListener('input', function () {
                    adopt();
                    state.center = prev.value;
                    autoGrow(prev);
                    changed();
                });
            }
            // Copy from Patient Info / Medications
            rootEl.querySelectorAll('[data-cm-copy]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const key = btn.getAttribute('data-cm-copy');
                    const text = key === 'diagnosis' ? strv(other('info').res_dx).trim() : medNames().join('\n');
                    if (!text) return;
                    adopt();
                    state[key] = text;
                    changed();
                    render();
                });
            });
            // Care plan detail
            const det = rootEl.querySelector('.cap-cm-detail');
            if (det) det.addEventListener('toggle', function () { detailOpen = det.open; });
            rootEl.querySelectorAll('[data-cm][data-col]').forEach(function (el) {
                const i = parseInt(el.getAttribute('data-cm'), 10);
                const col = el.getAttribute('data-col');
                el.addEventListener('input', function () {
                    if (!m.problems[i]) return;
                    adopt();
                    m.problems[i][col] = el.value;
                    changed();
                });
            });
            rootEl.querySelectorAll('[data-cm-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.getAttribute('data-cm-del'), 10);
                    adopt();
                    m.problems.splice(i, 1);
                    changed();
                    render();
                });
            });
            const addBtn = rootEl.querySelector('[data-cm-add]');
            if (addBtn) addBtn.addEventListener('click', function () {
                adopt();
                m.problems.push(emptyProblem());
                detailOpen = true;
                changed();
                render();
            });

            // Connectors: redraw whenever a box changes size
            mapEl = rootEl.querySelector('.cap-cm-map');
            drawLinks();
            if (typeof window.ResizeObserver === 'function') {
                ro = new window.ResizeObserver(function (entries) {
                    // A box that changed width (breakpoint, rotation, sidebar)
                    // re-wraps its text: size its text boxes again, next frame
                    // so the observer can't loop.
                    let rewrap = false;
                    entries.forEach(function (en) {
                        const t = en.target;
                        if (!t.classList || !t.classList.contains('cap-cm-box')) return;
                        const w = String(Math.round(en.contentRect.width));
                        const was = t.getAttribute('data-cm-w');
                        if (was != null && was !== w) rewrap = true;
                        t.setAttribute('data-cm-w', w);
                    });
                    drawLinks();
                    if (rewrap && typeof window.requestAnimationFrame === 'function') {
                        window.requestAnimationFrame(function () {
                            if (!mapEl || !mapEl.isConnected) return;
                            mapEl.querySelectorAll('textarea.cap-cm-tf').forEach(autoGrow);
                            drawLinks();
                        });
                    }
                });
                if (mapEl) {
                    ro.observe(mapEl);
                    mapEl.querySelectorAll('.cap-cm-box').forEach(function (el) { ro.observe(el); });
                }
            }
        }
        render();
    };

    // ---------- CASE STUDY (8-section academic format) ----------
    R.caseStudy = function (rootEl, state, onChange) {
        rootEl.innerHTML = panelHint(
            'Case Study (Patient Care Assignment)',
            'Academic case-study assignment. Some sections may be longer than what fits on screen — sections are collapsible.',
            // 1
            '<details class="cap-cs-section" open>' +
                '<summary><span class="cap-cs-num">1</span>Assessment</summary>' +
                '<div class="cap-cs-body">' +
                    field('Subjective Data', 'subjective', { rows: 4 }) +
                    field('Objective Data',  'objective',  { rows: 4 }) +
                '</div>' +
            '</details>' +
            // 2
            '<details class="cap-cs-section" open>' +
                '<summary><span class="cap-cs-num">2</span>Nursing Diagnoses</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">Three priority diagnoses, one from each category (NANDA-I format).</p>' +
                    field('Skin Integrity', 'dx_skin', { rows: 2 }) +
                    field('Mobility',       'dx_mobility', { rows: 2 }) +
                    field('Psychosocial / Emotional Health', 'dx_psych', { rows: 2 }) +
                '</div>' +
            '</details>' +
            // 3
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">3</span>Planning (Goals / Outcomes)</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">Short-term and long-term goals for each diagnosis.</p>' +
                    field('Skin — short-term',   'plan_skin_st', { rows: 2 }) +
                    field('Skin — long-term',    'plan_skin_lt', { rows: 2 }) +
                    field('Mobility — short-term', 'plan_mobility_st', { rows: 2 }) +
                    field('Mobility — long-term',  'plan_mobility_lt', { rows: 2 }) +
                    field('Psychosocial — short-term', 'plan_psych_st', { rows: 2 }) +
                    field('Psychosocial — long-term',  'plan_psych_lt', { rows: 2 }) +
                '</div>' +
            '</details>' +
            // 4
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">4</span>Nursing Interventions and Rationales</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">At least 3 evidence-based interventions per diagnosis; include rationale and expected outcome.</p>' +
                    field('Skin Integrity — interventions, rationales, outcomes', 'iv_skin', { rows: 5 }) +
                    field('Mobility — interventions, rationales, outcomes',       'iv_mobility', { rows: 5 }) +
                    field('Psychosocial — interventions, rationales, outcomes',   'iv_psych', { rows: 5 }) +
                '</div>' +
            '</details>' +
            // 5
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">5</span>Evaluation</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">How would you evaluate the effectiveness of your interventions? What data would indicate improvement? What might require modification of the care plan?</p>' +
                    field('Evaluation plan', 'evaluation', { rows: 4 }) +
                '</div>' +
            '</details>' +
            // 6
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">6</span>Interdisciplinary Collaboration</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">Members of the healthcare team to involve and their roles (PT/OT, RD, SW, WOCN, MH, etc.).</p>' +
                    field('Team members + roles', 'collaboration', { rows: 3 }) +
                '</div>' +
            '</details>' +
            // 7
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">7</span>Patient and Family Education</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">Teaching points for the ' + who() + ' and family.</p>' +
                    field('Pressure injury prevention / repositioning', 'edu_skin', { rows: 2 }) +
                    field('Nutrition and hydration', 'edu_nutrition', { rows: 2 }) +
                    field('Emotional health and social engagement', 'edu_psych', { rows: 2 }) +
                    field('Medication management / chronic disease control', 'edu_meds', { rows: 2 }) +
                '</div>' +
            '</details>' +
            // 8
            '<details class="cap-cs-section">' +
                '<summary><span class="cap-cs-num">8</span>Reflection</summary>' +
                '<div class="cap-cs-body">' +
                    '<p class="cap-hint">Reflect on the experience: what you learned, how psychosocial factors affect recovery, how to promote dignity, what risk factors are present, and how the team should collaborate.</p>' +
                    field('Reflection', 'reflection', { rows: 6 }) +
                '</div>' +
            '</details>'
        );
        bindFields(rootEl, state, onChange);
    };

    // ============================================================
    // SCREENING TOOL RENDERERS (PHQ-9, GAD-7, C-SSRS, CAGE, CAM)
    // Mirror the renderer pattern used by Morse/Braden — radios per row,
    // auto-tally, risk box, optional date + signature.
    // ============================================================
    function renderScored04(rootEl, state, onChange, opts) {
        // opts: { id, title, hint, questions:[strings], optsList:[{val,label}], severityFn, footnoteHtml }
        if (!state.choices) state.choices = {};
        function render() {
            let total = 0;
            const rowsHtml = opts.questions.map(function (q, idx) {
                const optsHtml = opts.optsList.map(function (o) {
                    const isOn = state.choices[idx] === o.val;
                    if (isOn) total += o.val;
                    return '<label class="cap-morse-opt' + (isOn ? ' selected' : '') + '">' +
                        '<input type="radio" name="' + opts.id + '_q' + idx + '" value="' + o.val + '" data-screen-q="' + idx + '"' + (isOn ? ' checked' : '') + '>' +
                        '<span>' + esc(o.label) + '</span>' +
                        '<span class="cap-morse-pts">+' + o.val + '</span>' +
                    '</label>';
                }).join('');
                return '<div class="cap-morse-var">' +
                    '<h4>' + (idx + 1) + '. ' + esc(q) + '</h4>' +
                    '<div class="cap-morse-opts">' + optsHtml + '</div>' +
                '</div>';
            }).join('');
            const answered = Object.keys(state.choices).length;
            const sev = answered ? opts.severityFn(total) : { label: 'Not scored', cls: '' };
            rootEl.innerHTML = panelHint(
                opts.title,
                opts.hint,
                rowsHtml +
                scoreBlock(answered ? total : '—', 'Total ' + opts.title.split(' ')[0] + ' Score', sev.label, sev.cls) +
                (opts.footnoteHtml || '') +
                '<div class="cap-grid g2" style="margin-top:14px;">' +
                    field('Date', 'date', { tag: 'input', type: 'date' }) +
                    field('Notes', 'notes', { tag: 'textarea', rows: 2, placeholder: 'Clinical context, plan, follow-up…' }) +
                '</div>'
            );
            rootEl.querySelectorAll('input[type="radio"][data-screen-q]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.choices[parseInt(r.dataset.screenQ, 10)] = parseInt(r.value, 10);
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            bindFields(rootEl, state, onChange);
        }
        render();
    }

    R.phq9 = function (rootEl, state, onChange) {
        renderScored04(rootEl, state, onChange, {
            id: 'phq9',
            title: 'PHQ-9 — Depression Screening',
            hint: 'Over the last 2 weeks, how often has the ' + who() + ' been bothered by the following? 0–4 None · 5–9 Mild · 10–14 Moderate · 15–19 Mod-Severe · 20+ Severe.',
            questions: PHQ9_QUESTIONS,
            optsList: PHQ9_OPTS,
            severityFn: phq9Severity,
            footnoteHtml: '<p class="cap-fineprint" style="color:var(--clx-danger,#c62828);font-weight:600;">⚠ Question 9 (suicidal ideation): if scored ≥1, perform an immediate safety assessment and notify provider.</p>'
        });
    };

    R.gad7 = function (rootEl, state, onChange) {
        renderScored04(rootEl, state, onChange, {
            id: 'gad7',
            title: 'GAD-7 — Anxiety Screening',
            hint: 'Over the last 2 weeks, how often has the ' + who() + ' been bothered by the following? 0–4 Minimal · 5–9 Mild · 10–14 Moderate · 15+ Severe.',
            questions: GAD7_QUESTIONS,
            optsList: PHQ9_OPTS,  // same 0-3 scale
            severityFn: gad7Severity
        });
    };

    R.cssrs = function (rootEl, state, onChange) {
        if (!state.answers) state.answers = {};
        function render() {
            const rowsHtml = CSSRS_QUESTIONS.map(function (q, idx) {
                const a = state.answers[q.id];
                const yesOn = a === 'yes', noOn = a === 'no';
                return '<div class="cap-morse-var">' +
                    '<h4>' + (idx + 1) + '. ' + esc(q.text) + '</h4>' +
                    '<div class="cap-morse-opts">' +
                        '<label class="cap-morse-opt' + (yesOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cssrs_' + q.id + '" value="yes" data-cssrs="' + q.id + '"' + (yesOn ? ' checked' : '') + '>' +
                            '<span>Yes</span>' +
                        '</label>' +
                        '<label class="cap-morse-opt' + (noOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cssrs_' + q.id + '" value="no" data-cssrs="' + q.id + '"' + (noOn ? ' checked' : '') + '>' +
                            '<span>No</span>' +
                        '</label>' +
                    '</div>' +
                '</div>';
            }).join('');
            const tri = cssrsTriage(state.answers);
            rootEl.innerHTML = panelHint(
                'C-SSRS — Suicide Severity Rating',
                'Six yes/no questions asked of the ' + who() + '. Use the most-severe positive answer to drive the triage level. Document immediately if any escalating answer is positive.',
                rowsHtml +
                '<div class="cap-score-block ' + tri.cls + '" style="margin-top:14px;">' +
                    '<span class="cap-score-num">⚠</span>' +
                    '<span class="cap-score-label">Triage Level</span>' +
                    '<span class="cap-score-risk">' + esc(tri.label) + '</span>' +
                '</div>' +
                '<div class="cap-grid g2" style="margin-top:14px;">' +
                    field('Date', 'date', { tag: 'input', type: 'date' }) +
                    field('Action / Notification', 'action', { tag: 'textarea', rows: 2, placeholder: 'Provider notified, safety plan, monitoring level…' }) +
                '</div>'
            );
            rootEl.querySelectorAll('input[type="radio"][data-cssrs]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.answers[r.dataset.cssrs] = r.value;
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            bindFields(rootEl, state, onChange);
        }
        render();
    };

    R.cage = function (rootEl, state, onChange) {
        if (!state.answers) state.answers = {};
        function render() {
            let yesCount = 0;
            const rowsHtml = CAGE_QUESTIONS.map(function (q) {
                const a = state.answers[q.id];
                const yesOn = a === 'yes', noOn = a === 'no';
                if (yesOn) yesCount += 1;
                return '<div class="cap-morse-var">' +
                    '<h4><strong>' + q.letter + '</strong> — ' + esc(q.text) + '</h4>' +
                    '<div class="cap-morse-opts">' +
                        '<label class="cap-morse-opt' + (yesOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cage_' + q.id + '" value="yes" data-cage="' + q.id + '"' + (yesOn ? ' checked' : '') + '>' +
                            '<span>Yes</span><span class="cap-morse-pts">+1</span>' +
                        '</label>' +
                        '<label class="cap-morse-opt' + (noOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cage_' + q.id + '" value="no" data-cage="' + q.id + '"' + (noOn ? ' checked' : '') + '>' +
                            '<span>No</span>' +
                        '</label>' +
                    '</div>' +
                '</div>';
            }).join('');
            const answered = Object.keys(state.answers).length;
            const sev = answered ? cageSeverity(yesCount) : { label: 'Not scored', cls: '' };
            rootEl.innerHTML = panelHint(
                'CAGE — Alcohol Screening',
                'Four yes/no questions. ≥2 "yes" answers = clinically significant; consider AUDIT or further assessment.',
                rowsHtml +
                scoreBlock(answered ? yesCount : '—', 'Total CAGE Score (0–4)', sev.label, sev.cls) +
                '<div class="cap-grid g2" style="margin-top:14px;">' +
                    field('Date', 'date', { tag: 'input', type: 'date' }) +
                    field('Notes', 'notes', { tag: 'textarea', rows: 2, placeholder: 'Drinking history, frequency, last drink, plan…' }) +
                '</div>'
            );
            rootEl.querySelectorAll('input[type="radio"][data-cage]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.answers[r.dataset.cage] = r.value;
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            bindFields(rootEl, state, onChange);
        }
        render();
    };

    R.cam = function (rootEl, state, onChange) {
        if (!state.features) state.features = {};
        function render() {
            const rowsHtml = CAM_FEATURES.map(function (f) {
                const a = state.features[f.id];
                const yesOn = a === 'yes', noOn = a === 'no';
                return '<div class="cap-braden-factor">' +
                    '<h4>' + esc(f.id) + ' — ' + esc(f.name) + '</h4>' +
                    '<p class="cap-braden-defn">' + esc(f.defn) + '</p>' +
                    '<div class="cap-morse-opts" style="margin-top:8px;">' +
                        '<label class="cap-morse-opt' + (yesOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cam_' + f.id + '" value="yes" data-cam="' + f.id + '"' + (yesOn ? ' checked' : '') + '>' +
                            '<span>Present</span>' +
                        '</label>' +
                        '<label class="cap-morse-opt' + (noOn ? ' selected' : '') + '">' +
                            '<input type="radio" name="cam_' + f.id + '" value="no" data-cam="' + f.id + '"' + (noOn ? ' checked' : '') + '>' +
                            '<span>Absent</span>' +
                        '</label>' +
                    '</div>' +
                '</div>';
            }).join('');
            const result = camResult(state.features);
            rootEl.innerHTML = panelHint(
                'CAM — Confusion Assessment Method',
                'Diagnostic algorithm for delirium. POSITIVE if Feature 1 AND Feature 2 are present, AND either Feature 3 OR Feature 4 is present. Rule out reversible causes immediately.',
                rowsHtml +
                '<div class="cap-score-block ' + result.cls + '" style="margin-top:14px;">' +
                    '<span class="cap-score-num">' + (result.cls === 'high' ? '⚠' : '✓') + '</span>' +
                    '<span class="cap-score-label">Algorithm Result</span>' +
                    '<span class="cap-score-risk">' + esc(result.label) + '</span>' +
                '</div>' +
                '<div class="cap-grid g2" style="margin-top:14px;">' +
                    field('Date / Time', 'date', { tag: 'input', type: 'datetime-local' }) +
                    field('Suspected Cause(s)', 'cause', { tag: 'textarea', rows: 2, placeholder: 'Infection, dehydration, meds (anticholinergics, opioids), pain, sleep deprivation…' }) +
                '</div>'
            );
            rootEl.querySelectorAll('input[type="radio"][data-cam]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.features[r.dataset.cam] = r.value;
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            bindFields(rootEl, state, onChange);
        }
        render();
    };

    // ---------- LAB VALUES (TABLE 3) ----------
    // Fixed rows in Word order (FORM.LAB_GROUPS) stored as
    // state.rows[labId] = { normal, date, result, interp }; rows the student
    // adds under Other are state.extra[] = { lab, normal, date, result, interp }.
    // Notes typed into the earlier placeholder (state._sandboxText) stay
    // visible and editable as "Previous notes".
    // Fit a textarea to its text (border included, as grow() does in the
    // H2T editor). Every box sized this way is sized again when the window
    // width changes: rotation or a breakpoint re-wraps the text, and these
    // boxes are overflow:hidden.
    function autoGrow(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        el.setAttribute('data-cap-grow', '');
        bindRegrow();
        el.style.height = 'auto';
        const border = el.offsetHeight - el.clientHeight;
        if (el.scrollHeight) el.style.height = (el.scrollHeight + Math.max(0, border)) + 'px';
    }
    let regrowBound = false;
    function bindRegrow() {
        if (regrowBound || typeof window.addEventListener !== 'function') return;
        regrowBound = true;
        let lastW = window.innerWidth, pending = false;
        function regrow() {
            pending = false;
            document.querySelectorAll('textarea[data-cap-grow]').forEach(autoGrow);
        }
        window.addEventListener('resize', function () {
            // Height-only resizes (mobile URL bar) re-wrap nothing
            if (window.innerWidth === lastW || pending) return;
            lastW = window.innerWidth;
            pending = true;
            if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(regrow);
            else setTimeout(regrow, 50);
        });
    }
    R.labs = function (rootEl, state, onChange) {
        function emptyExtra() { return { lab:'', normal:'', date:'', result:'', interp:'' }; }
        // RTDB can hand an array back as an integer-keyed object (or with
        // null gaps); normalise without dropping anything.
        if (state.extra && !Array.isArray(state.extra) && typeof state.extra === 'object') {
            const e = state.extra;
            state.extra = Object.keys(e).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return e[k]; });
        }
        if (Array.isArray(state.extra)) state.extra = state.extra.filter(function (r) { return r && typeof r === 'object'; });
        function cellsHtml(attr, labLabel, vals) {
            return LAB_COLUMNS.map(function (c) {
                return '<td data-label="' + esc(c.title) + '"><textarea rows="1" class="cap-tf" ' + attr + ' data-col="' + esc(c.key) + '" aria-label="' +
                    esc((labLabel || 'Added lab') + ' — ' + c.title) + '">' + esc(vals[c.key]) + '</textarea></td>';
            }).join('');
        }
        function render() {
            const rows = (state.rows && typeof state.rows === 'object') ? state.rows : {};
            const extra = Array.isArray(state.extra) ? state.extra : [];
            let body = '';
            LAB_GROUPS.forEach(function (g, gi) {
                body += '<tr class="cap-labs-group"><th colspan="' + (LAB_COLUMNS.length + 2) + '" scope="colgroup">' + esc(g.group) + '</th></tr>';
                g.rows.forEach(function (r) {
                    body += '<tr><th scope="row" class="cap-labs-name">' + esc(r.label) + '</th>' +
                        cellsHtml('data-lab="' + esc(r.id) + '"', r.label, rows[r.id] || {}) +
                        '<td class="cap-labs-act"></td></tr>';
                });
                if (gi === LAB_GROUPS.length - 1) {
                    extra.forEach(function (x, i) {
                        body += '<tr class="cap-labs-extra"><th scope="row" class="cap-labs-name">' +
                            '<textarea rows="1" class="cap-tf" data-extra="' + i + '" data-col="lab" placeholder="Lab name" aria-label="Added lab ' + (i + 1) + ' — Lab">' + esc(x.lab) + '</textarea></th>' +
                            cellsHtml('data-extra="' + i + '"', x.lab || ('Added lab ' + (i + 1)), x) +
                            '<td class="cap-labs-act"><button type="button" class="cap-row-del" data-del-extra="' + i + '" title="Delete row" aria-label="Delete added lab ' + (i + 1) + '">&times;</button></td></tr>';
                    });
                    body += '<tr class="cap-labs-addrow"><td colspan="' + (LAB_COLUMNS.length + 2) + '"><button type="button" class="cap-add-row" id="capLabsAdd">+ Add lab under Other</button></td></tr>';
                }
            });
            const prev = String(state._sandboxText || '').trim()
                ? '<div class="cap-field" style="margin-top:14px;"><label class="cap-label" for="capLabsPrev">Previous notes</label>' +
                  '<textarea id="capLabsPrev" data-cap-field="_sandboxText" rows="4" class="cap-tf"></textarea></div>'
                : '';
            rootEl.innerHTML = panelHint(
                'Lab Values',
                'Use your facility\'s normal values. Blank rows print as blank lines for your instructor.',
                '<div class="cap-labs-wrap"><table class="cap-labs-table">' +
                    '<thead><tr><th scope="col">Lab</th>' +
                        LAB_COLUMNS.map(function (c) { return '<th scope="col">' + esc(c.title) + '</th>'; }).join('') +
                        '<th scope="col" class="cap-labs-act"><span class="cap-sr">Actions</span></th></tr></thead>' +
                    '<tbody>' + body + '</tbody>' +
                '</table></div>' +
                prev
            );
            bindFields(rootEl, state, onChange);
            rootEl.querySelectorAll('.cap-labs-table textarea').forEach(function (ta) {
                autoGrow(ta);
                ta.addEventListener('input', function () {
                    const col = ta.getAttribute('data-col');
                    if (ta.hasAttribute('data-lab')) {
                        const id = ta.getAttribute('data-lab');
                        if (!state.rows || typeof state.rows !== 'object') state.rows = {};
                        if (!state.rows[id] || typeof state.rows[id] !== 'object') state.rows[id] = {};
                        state.rows[id][col] = ta.value;
                    } else {
                        const i = parseInt(ta.getAttribute('data-extra'), 10);
                        if (!Array.isArray(state.extra) || !state.extra[i]) return;
                        state.extra[i][col] = ta.value;
                    }
                    autoGrow(ta);
                    if (typeof onChange === 'function') onChange();
                });
            });
            rootEl.querySelectorAll('[data-del-extra]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.getAttribute('data-del-extra'), 10);
                    if (!Array.isArray(state.extra)) return;
                    state.extra.splice(i, 1);
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            const add = rootEl.querySelector('#capLabsAdd');
            if (add) add.addEventListener('click', function () {
                if (!Array.isArray(state.extra)) state.extra = [];
                state.extra.push(emptyExtra());
                if (typeof onChange === 'function') onChange();
                render();
                const last = rootEl.querySelector('textarea[data-extra="' + (state.extra.length - 1) + '"][data-col="lab"]');
                if (last) last.focus();
            });
        }
        render();
    };

    // ---------- Second instances (catalog `base`) ----------
    // Looked up at call time so a later rebuild of the base renderer applies
    // to its Day 2 copy too.
    (CAP.MODULE_CATALOG || []).forEach(function (m) {
        if (!m.base || R[m.id]) return;
        R[m.id] = function (rootEl, state, onChange) {
            const base = R[m.base];
            if (typeof base !== 'function') return;
            return base(rootEl, state, onChange, {
                moduleId: m.id,
                title: m.label,
                day: m.day || 2,
                hint: 'Second assessment day (Disregard for Five-Week Courses).'
            });
        };
    });

    // Wording context, set by the editor before rendering.
    R.setContext = function (c) {
        CTX = Object.assign({ person: 'patient' }, c || {});
    };

    window.CAP_RENDERERS = R;
})();
