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
*/
(function () {
    'use strict';
    if (window.CAP_RENDERERS) return;

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
    const OMEGA_ROWS = [
        { key:'O', letter:'O', label:'Orientation' },
        { key:'M', letter:'M', label:'Medication' },
        { key:'E', letter:'E', label:'Emergency' },
        { key:'G', letter:'G', label:'Gait' },
        { key:'A', letter:'A', label:'Allergies' },
        { key:'1', letter:'1', label:'Air' },
        { key:'2', letter:'2', label:'Food' },
        { key:'3', letter:'3', label:'Water' },
        { key:'4', letter:'4', label:'Safety' },
        { key:'5', letter:'5', label:'Hygiene' },
        { key:'6', letter:'6', label:'Pain' },
        { key:'7', letter:'7', label:'Sleep' }
    ];

    const MORSE_VARS = [
        { id:'history',      name:'History of Falling', opts:[ { val:0,  label:'No' }, { val:25, label:'Yes' } ] },
        { id:'secondary_dx', name:'Secondary Diagnosis', opts:[ { val:0,  label:'No' }, { val:15, label:'Yes' } ] },
        { id:'ambulatory',   name:'Ambulatory Aid', opts:[ { val:0,  label:'None / bedrest / nurse assist' }, { val:15, label:'Crutches / cane / walker' }, { val:30, label:'Furniture' } ] },
        { id:'iv',           name:'IV or IV Access', opts:[ { val:0,  label:'No' }, { val:20, label:'Yes' } ] },
        { id:'gait',         name:'Gait', opts:[ { val:0,  label:'Normal / bedrest / wheelchair' }, { val:10, label:'Weak' }, { val:20, label:'Impaired' } ] },
        { id:'mental',       name:'Mental Status', opts:[ { val:0,  label:'Knows own limits' }, { val:15, label:'Overestimates or forgets limits' } ] }
    ];

    const BRADEN_FACTORS = [
        { id:'sensory', name:'Sensory Perception', defn:'Ability to respond meaningfully to pressure-related discomfort',
          opts:[
            { val:1, title:'Completely Limited', desc:'Unresponsive (does not moan, flinch, or grasp) to painful stimuli, due to diminished LOC or sedation, OR limited ability to feel pain over most of body surface.' },
            { val:2, title:'Very Limited', desc:'Responds only to painful stimuli. Cannot communicate discomfort except by moaning/restlessness, OR sensory impairment limiting ability to feel pain over ½ of body.' },
            { val:3, title:'Slightly Limited', desc:'Responds to verbal commands but cannot always communicate discomfort or need to be turned, OR some sensory impairment in 1–2 extremities.' },
            { val:4, title:'No Impairment', desc:'Responds to verbal commands. No sensory deficit that would limit ability to feel or voice pain.' }
          ] },
        { id:'moisture', name:'Moisture', defn:'Degree to which skin is exposed to moisture',
          opts:[
            { val:1, title:'Constantly Moist', desc:'Skin kept moist almost constantly by perspiration, urine, etc. Dampness detected every time resident is moved or turned.' },
            { val:2, title:'Often Moist', desc:'Skin often but not always moist. Linen must be changed at least once a shift.' },
            { val:3, title:'Occasionally Moist', desc:'Skin occasionally moist, requiring an extra linen change approximately once a day.' },
            { val:4, title:'Rarely Moist', desc:'Skin usually dry; linen only requires changing at routine intervals.' }
          ] },
        { id:'activity', name:'Activity', defn:'Degree of physical activity',
          opts:[
            { val:1, title:'Bedfast', desc:'Confined to bed.' },
            { val:2, title:'Chairfast', desc:'Ability to walk severely limited or nonexistent. Cannot bear own weight and/or must be assisted into chair or wheelchair.' },
            { val:3, title:'Walks Occasionally', desc:'Walks occasionally during day but very short distances, with or without assistance. Majority of shift in bed or chair.' },
            { val:4, title:'Walks Frequently', desc:'Walks outside the room ≥2x/day and inside room at least once every 2 hours during waking hours.' }
          ] },
        { id:'mobility', name:'Mobility', defn:'Ability to change and control body position',
          opts:[
            { val:1, title:'Completely Immobile', desc:'Does not make even slight changes in body or extremity position without assistance.' },
            { val:2, title:'Very Limited', desc:'Makes occasional slight changes in body or extremity position but unable to make frequent or significant changes independently.' },
            { val:3, title:'Slightly Limited', desc:'Makes frequent though slight changes in body or extremity position independently.' },
            { val:4, title:'No Limitations', desc:'Makes major and frequent changes in position without assistance.' }
          ] },
        { id:'nutrition', name:'Nutrition', defn:'Usual food intake pattern',
          opts:[
            { val:1, title:'Very Poor', desc:'Never eats a complete meal. Rarely eats more than ⅓ of any food offered. ≤2 servings protein/day. Takes fluids poorly. No liquid supplement, OR NPO/clear liquids/IV >5 days.' },
            { val:2, title:'Probably Inadequate', desc:'Rarely eats complete meal; ½ of food offered. 3 servings protein/day. Occasional supplement OR less than optimum liquid diet/tube feeding.' },
            { val:3, title:'Adequate', desc:'Eats over half of most meals. 4 servings protein/day. Occasionally refuses a meal but will usually take supplement, OR tube feeding/TPN meeting most needs.' },
            { val:4, title:'Excellent', desc:'Eats most of every meal. Never refuses. Usually ≥4 servings meat/dairy. Occasionally eats between meals. No supplementation required.' }
          ] },
        { id:'friction', name:'Friction and Shear', defn:'Movement and positioning',
          opts:[
            { val:1, title:'Problem', desc:'Requires moderate to maximum assistance moving. Complete lifting without sliding impossible. Frequently slides down in bed/chair. Spasticity/contractures/agitation → near-constant friction.' },
            { val:2, title:'Potential Problem', desc:'Moves feebly or requires minimum assistance. Skin probably slides to some extent against sheets/chair/restraints. Maintains relatively good position most of the time, occasionally slides down.' },
            { val:3, title:'No Apparent Problem', desc:'Moves in bed and chair independently with sufficient muscle strength to lift up completely during move. Maintains good position at all times.' }
          ] }
    ];

    function morseRiskLabel(score) {
        if (score >= 45) return { label: 'High Risk (45+)', cls: 'high' };
        if (score >= 25) return { label: 'Moderate Risk (25–44)', cls: 'moderate' };
        return { label: 'Low Risk (0–24)', cls: 'low' };
    }
    function bradenRiskLabel(score) {
        if (!score) return { label: 'Not scored', cls: '' };
        if (score <= 9)  return { label: 'Severe Risk (≤9)', cls: 'high' };
        if (score <= 12) return { label: 'High Risk (10–12)', cls: 'high' };
        if (score <= 14) return { label: 'Moderate Risk (13–14)', cls: 'moderate' };
        if (score <= 18) return { label: 'Mild Risk (15–18)', cls: 'low' };
        return { label: 'No significant risk (19+)', cls: 'low' };
    }

    // ============================================================
    // RENDERERS
    // ============================================================
    const R = {};

    // ---------- INFO ----------
    R.info = function (rootEl, state, onChange) {
        rootEl.innerHTML = panelHint(
            'Student & Resident Information',
            'De-identify all resident data — initials only, no names. Saved to your Firebase account; never shared.',
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
            '<h4 class="cap-subhead">Resident</h4>' +
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
    R.omega = function (rootEl, state, onChange) {
        const rows = OMEGA_ROWS.map(function (r) {
            return '<tr>' +
                '<td class="cap-omega-key"><span class="cap-omega-letter">' + r.letter + '</span></td>' +
                '<td class="cap-omega-label">' + r.label + '</td>' +
                '<td><textarea data-cap-field="' + r.key + '" rows="2" class="cap-tf"></textarea></td>' +
            '</tr>';
        }).join('');
        rootEl.innerHTML = panelHint(
            'OMEGA 1234567 Assessment',
            'Systematic assessment framework. One row per domain.',
            '<table class="cap-omega-table"><tbody>' + rows + '</tbody></table>'
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- MEDICATIONS ----------
    R.meds = function (rootEl, state, onChange) {
        if (!Array.isArray(state.rows)) state.rows = [emptyMed()];
        function emptyMed() { return { order:'', time:'', class:'', indication:'', sideEffects:'', implications:'' }; }
        function render() {
            const rowsHtml = state.rows.map(function (r, i) {
                return '<tr>' +
                    '<td><textarea data-row="' + i + '" data-col="order"        rows="2" class="cap-tf">' + esc(r.order) + '</textarea></td>' +
                    '<td><textarea data-row="' + i + '" data-col="time"         rows="2" class="cap-tf">' + esc(r.time) + '</textarea></td>' +
                    '<td><textarea data-row="' + i + '" data-col="class"        rows="2" class="cap-tf">' + esc(r.class) + '</textarea></td>' +
                    '<td><textarea data-row="' + i + '" data-col="indication"   rows="2" class="cap-tf">' + esc(r.indication) + '</textarea></td>' +
                    '<td><textarea data-row="' + i + '" data-col="sideEffects"  rows="2" class="cap-tf">' + esc(r.sideEffects) + '</textarea></td>' +
                    '<td><textarea data-row="' + i + '" data-col="implications" rows="2" class="cap-tf">' + esc(r.implications) + '</textarea></td>' +
                    '<td class="cap-meds-del"><button class="cap-row-del" data-del="' + i + '" title="Delete row">&times;</button></td>' +
                '</tr>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'Medications',
                'Current medications the resident is on. One row per med.',
                '<div class="cap-meds-wrap">' +
                    '<table class="cap-meds-table">' +
                        '<thead><tr>' +
                            '<th style="width:18%">Physician\'s Order<br><small>(Trade &amp; Generic)</small></th>' +
                            '<th style="width:10%">Time Admin</th>' +
                            '<th style="width:14%">Drug Class</th>' +
                            '<th style="width:16%">Indication</th>' +
                            '<th style="width:18%">Major Side Effects</th>' +
                            '<th style="width:20%">Nursing Implications</th>' +
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

    // ---------- MORSE FALL SCALE ----------
    R.morse = function (rootEl, state, onChange) {
        if (!state.choices) state.choices = {};
        function render() {
            let total = 0;
            const rowsHtml = MORSE_VARS.map(function (v) {
                const optsHtml = v.opts.map(function (o) {
                    const isOn = state.choices[v.id] === o.val;
                    if (isOn) total += o.val;
                    return '<label class="cap-morse-opt' + (isOn ? ' selected' : '') + '">' +
                        '<input type="radio" name="morse_' + v.id + '" value="' + o.val + '" data-morse="' + v.id + '"' + (isOn ? ' checked' : '') + '>' +
                        '<span>' + esc(o.label) + '</span>' +
                        '<span class="cap-morse-pts">+' + o.val + '</span>' +
                    '</label>';
                }).join('');
                return '<div class="cap-morse-var">' +
                    '<h4>' + esc(v.name) + '</h4>' +
                    '<div class="cap-morse-opts">' + optsHtml + '</div>' +
                '</div>';
            }).join('');
            const risk = morseRiskLabel(total);
            rootEl.innerHTML = panelHint(
                'Morse Fall Scale',
                'Select one option per variable. Complete on admission, change of condition, transfer, or after a fall.',
                rowsHtml +
                scoreBlock(total, 'Total Morse Score', risk.label, risk.cls) +
                '<p class="cap-fineprint">0–24 Low Risk · 25–44 Moderate Risk · 45+ High Risk</p>' +
                '<div class="cap-grid g3" style="margin-top:14px;">' +
                    field('Admission Date', 'admit_date', { tag: 'input', type: 'date' }) +
                    field('Review Date', 'review1', { tag: 'input', type: 'date' }) +
                    field('Review Date 2', 'review2', { tag: 'input', type: 'date' }) +
                '</div>' +
                field('Signature & Status', 'signature', { tag: 'input' })
            );
            // Wire radio choices
            rootEl.querySelectorAll('input[type="radio"][data-morse]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.choices[r.dataset.morse] = parseInt(r.value, 10);
                    if (typeof onChange === 'function') onChange();
                    render();  // re-render to update score + selected styling
                });
            });
            // Bind regular fields
            bindFields(rootEl, state, onChange);
        }
        render();
    };

    // ---------- BRADEN SCALE ----------
    R.braden = function (rootEl, state, onChange) {
        if (!state.choices) state.choices = {};
        function render() {
            let total = 0;
            const factorsHtml = BRADEN_FACTORS.map(function (f) {
                const optsHtml = f.opts.map(function (o) {
                    const isOn = state.choices[f.id] === o.val;
                    if (isOn) total += o.val;
                    return '<label class="cap-braden-opt' + (isOn ? ' selected' : '') + '">' +
                        '<input type="radio" name="braden_' + f.id + '" value="' + o.val + '" data-braden="' + f.id + '"' + (isOn ? ' checked' : '') + '>' +
                        '<strong>' + o.val + ' — ' + esc(o.title) + '</strong>' +
                        '<span class="cap-braden-desc">' + esc(o.desc) + '</span>' +
                    '</label>';
                }).join('');
                return '<div class="cap-braden-factor">' +
                    '<h4>' + esc(f.name) + '</h4>' +
                    '<p class="cap-braden-defn">' + esc(f.defn) + '</p>' +
                    '<div class="cap-braden-opts cols-' + f.opts.length + '">' + optsHtml + '</div>' +
                '</div>';
            }).join('');
            const risk = bradenRiskLabel(total);
            rootEl.innerHTML = panelHint(
                'Braden Scale — Pressure Sore Risk',
                'Select one option per factor. Total auto-calculates. ≤12 = HIGH RISK.',
                factorsHtml +
                scoreBlock(total || '—', 'Total Braden Score', risk.label, risk.cls) +
                '<p class="cap-fineprint">9 Severe · 10–12 High · 13–14 Moderate · 15–18 Mild · 19+ No significant risk</p>' +
                '<div class="cap-grid g3" style="margin-top:14px;">' +
                    field('Assessment Date', 'date', { tag: 'input', type: 'date' }) +
                    field('Evaluator Signature / Title', 'evaluator', { tag: 'input' }) +
                '</div>' +
                '<p class="cap-fineprint" style="margin-top:14px;font-style:italic;">Source: Barbara Braden &amp; Nancy Bergstrom. Copyright 1988. Reprinted with permission. www.bradenscale.com</p>'
            );
            rootEl.querySelectorAll('input[type="radio"][data-braden]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.choices[r.dataset.braden] = parseInt(r.value, 10);
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            bindFields(rootEl, state, onChange);
        }
        render();
    };

    // ---------- MINI-COG ----------
    R.minicog = function (rootEl, state, onChange) {
        // state: { recall, clock, notes, clockPng (base64) }
        rootEl.innerHTML = panelHint(
            'Mini-Cog — Cognitive Assessment',
            'Rapid dementia screen (~3 min). Three steps: register three words, draw a clock, recall the words.',
            '<div class="cap-careplan-box">' +
                '<h4>Step 1 — 3-Word Registration</h4>' +
                '<p>Ask the resident to listen carefully, remember, and repeat back: ' +
                '<strong style="font-size:15px;letter-spacing:0.5px;">Ocean · Desk · Tractor</strong></p>' +
            '</div>' +
            '<div class="cap-careplan-box">' +
                '<h4>Step 2 — Clock Drawing Test</h4>' +
                '<p class="cap-hint">Instruct the resident to draw the face of a clock, including the <strong>numbers</strong>, with hands pointing to <strong>8:20</strong>. Move on after 3 minutes if incomplete.</p>' +
                '<div class="cap-clock-wrap">' +
                    '<canvas id="capClockCanvas" width="400" height="400" style="border:1px solid var(--clx-border);border-radius:4px;touch-action:none;display:block;margin:0 auto;max-width:100%;cursor:crosshair;background:#fff;"></canvas>' +
                    '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">' +
                        '<button type="button" class="cap-btn-sm" id="capClockClear">Clear drawing</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="cap-careplan-box">' +
                '<h4>Step 3 — Word Recall</h4>' +
                '<div class="cap-grid g2">' +
                    field('Word Recall Score (0–3) — 1 pt per word', 'recall', { tag: 'select', optionsHtml:
                        '<option value="">—</option>' +
                        '<option value="0">0 — none recalled</option>' +
                        '<option value="1">1 word recalled</option>' +
                        '<option value="2">2 words recalled</option>' +
                        '<option value="3">3 words recalled</option>'
                    }) +
                    field('Clock Drawing Score', 'clock', { tag: 'select', optionsHtml:
                        '<option value="">—</option>' +
                        '<option value="0">0 — Abnormal</option>' +
                        '<option value="2">2 — Normal</option>'
                    }) +
                '</div>' +
            '</div>' +
            '<div id="capMinicogScore"></div>' +
            field('Additional observations / notes', 'notes', { rows: 3 })
        );
        bindFields(rootEl, state, onChange);

        function updateScore() {
            const r = parseInt(state.recall || '', 10);
            const c = parseInt(state.clock || '', 10);
            const block = document.getElementById('capMinicogScore');
            if (isNaN(r) && isNaN(c)) { block.innerHTML = ''; return; }
            const total = (isNaN(r) ? 0 : r) + (isNaN(c) ? 0 : c);
            let risk = 'Not scored';
            let cls = '';
            if (!isNaN(r) && !isNaN(c)) {
                if (total <= 2) { risk = 'Positive screen for dementia (0–2)'; cls = 'high'; }
                else { risk = 'Negative screen (3–5)'; cls = 'low'; }
            }
            block.innerHTML = scoreBlock(total, 'Mini-Cog Total (0–5)', risk, cls) +
                '<p class="cap-fineprint">0–2 = Positive screen for dementia · 3–5 = Negative screen</p>';
        }
        ['recall', 'clock'].forEach(function (k) {
            const el = rootEl.querySelector('[data-cap-field="' + k + '"]');
            if (el) el.addEventListener('change', updateScore);
        });
        updateScore();

        // Canvas drawing
        const canvas = document.getElementById('capClockCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#1a3a5c';
            // Restore from state if present
            if (state.clockPng) {
                const img = new Image();
                img.onload = function () { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
                img.src = state.clockPng;
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
                '<div class="cap-grid g5">' +
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
                    field('Resident description', 'pain_description', { tag: 'input' }) +
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
    R.behavior      = placeholder('Behavior (ABC)');
    R.ncsbn         = placeholder('Clinical Judgment (NCSBN)');
    R.progressNotes = placeholder('Progress Notes');
    R.carePlan      = placeholder('Care Plan');
    R.caseStudy     = placeholder('Case Study');
    R.headToToe     = placeholder('Head-to-Toe Assessment');
    R.conceptMap    = placeholder('Concept Map');
    R.references    = placeholder('APA References');
    R.hendrich      = placeholder('Hendrich II Fall Model');

    window.CAP_RENDERERS = R;
})();
