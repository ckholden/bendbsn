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
            'OMEGA-7 Assessment',
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
    const NCSBN_STEPS = [
        { step:'Step 1: Recognize Cues',         prompt:'What data are RELEVANT and must be interpreted as clinically significant?' },
        { step:'Step 2: Analyze Cues',           prompt:'Interpret relevant clinical data and identify the most likely problem(s). Is additional data needed?' },
        { step:'Step 3: Prioritize Hypotheses',  prompt:'Rank the most likely problems by urgency. Which problem is most likely present? Most concerning? Why?' },
        { step:'Step 4: Generate Solutions',     prompt:'Based on the most pressing problem, what are the priority actions?' },
        { step:'Step 5: Take Action',            prompt:'What actions did you take?' },
        { step:'Step 6: Evaluate Outcomes',      prompt:'Evaluate the resident\'s response. Has status improved, declined, or remained unchanged? If not improved, what else may be present and what interventions should be considered?' }
    ];
    R.ncsbn = function (rootEl, state, onChange) {
        if (!state.steps) state.steps = {};
        const stepsHtml = NCSBN_STEPS.map(function (s, i) {
            return '<div class="cap-ncsbn-step">' +
                '<div class="cap-ncsbn-num">' + (i + 1) + '</div>' +
                '<div class="cap-ncsbn-body">' +
                    '<h4>' + esc(s.step) + '</h4>' +
                    '<p class="cap-hint" style="margin-bottom:6px;">' + esc(s.prompt) + '</p>' +
                    '<textarea data-cap-field="step_' + i + '" rows="3" class="cap-tf"></textarea>' +
                '</div>' +
            '</div>';
        }).join('');
        rootEl.innerHTML = panelHint(
            'Six Steps of the NCSBN Clinical Judgment Model',
            'Work through the six steps for this resident.',
            stepsHtml
        );
        // Map step_0..step_5 fields to state.steps[0..5]
        rootEl.querySelectorAll('[data-cap-field]').forEach(function (el) {
            const k = el.getAttribute('data-cap-field'); // step_N
            const idx = k.replace('step_', '');
            if (state.steps[idx] != null) el.value = state.steps[idx];
            el.addEventListener('input', function () {
                state.steps[idx] = el.value;
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
                'Identified issue that can be modified to help resident outcome.<br><em>Example: Air — Resident is on 2L O₂, normally on room air at home.</em>',
                field('', 'finding', { rows: 2 })) +
            box('Nursing Diagnostic Statement',
                'NANDA Dx r/t problem [secondary to medical Dx] aeb signs/symptoms.<br><em>Example: Impaired gas exchange r/t airway obstruction secondary to COPD aeb wheezing, fatigue after 10 ft walking, SpO₂ &lt;88% with exertion.</em>',
                field('', 'dx', { rows: 2 })) +
            box('Short-Term Goal',
                'End of shift or within a week. Begin with the resident. SMART: Specific, Measurable, Achievable, Relevant, Timebound.',
                field('Goal', 'st_goal', { rows: 2 }) +
                intervention('Assess', 'st_assess') +
                intervention('Do',     'st_do') +
                intervention('Teach',  'st_teach')) +
            box('Long-Term Goal',
                'Weeks to months. Begin with the resident. SMART.',
                field('Goal', 'lt_goal', { rows: 2 }) +
                intervention('Assess', 'lt_assess') +
                intervention('Do',     'lt_do') +
                intervention('Teach',  'lt_teach')) +
            box('Summary of Care',
                'Current interventions/treatments moving resident toward discharge, focused on primary dx.',
                field('', 'summary', { rows: 4 }))
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- HEAD-TO-TOE ASSESSMENT ----------
    const H2T_SYSTEMS = [
        { key:'neuro',      label:'Neurological',      hint:'LOC, orientation, pupils (PERRLA), EOM, cranial nerves, MAE, GCS, sensation/motor.' },
        { key:'heent',      label:'HEENT',              hint:'Hair/scalp, eyes, ears, nose/smell, mouth/oral mucosa, dentition.' },
        { key:'cardio',     label:'Cardiovascular',     hint:'Heart sounds (S1/S2 RRR), apical pulse, peripheral pulses (radial/DP/PT), edema, cap refill.' },
        { key:'resp',       label:'Respiratory',        hint:'Breath sounds (CTA bilat), effort, O2/SpO₂, cough/sputum, chest expansion.' },
        { key:'gi',         label:'Gastrointestinal',   hint:'Bowel sounds (BS x4 quads), abdomen (soft / NT / ND), last BM, diet/intake, N/V.' },
        { key:'gu',         label:'Genitourinary',      hint:'Voiding pattern, Foley if applicable, urine color/clarity, output.' },
        { key:'msk',        label:'Musculoskeletal',    hint:'ROM (active/passive), gait, grip strength, balance, fall risk, ambulation.' },
        { key:'skin',       label:'Skin / Integumentary', hint:'Color, warmth, turgor, intact / wounds / pressure injuries, IV sites, Braden score reference.' },
        { key:'psych',      label:'Psychosocial',       hint:'Mood, affect, behavior, support system, cognition (ref Mini-Cog), safety concerns.' }
    ];
    R.headToToe = function (rootEl, state, onChange) {
        const sysHtml = H2T_SYSTEMS.map(function (s) {
            return '<div class="cap-h2t-row">' +
                '<label class="cap-label">' + esc(s.label) + '</label>' +
                '<p class="cap-fineprint" style="margin:-2px 0 4px;">' + esc(s.hint) + '</p>' +
                '<textarea data-cap-field="' + s.key + '" rows="3" class="cap-tf"></textarea>' +
            '</div>';
        }).join('');
        rootEl.innerHTML = panelHint(
            'Head-to-Toe Assessment',
            'Comprehensive systems assessment. One textarea per system — paste your assessment findings (normal + abnormal).',
            sysHtml
        );
        bindFields(rootEl, state, onChange);
    };

    // ---------- HENDRICH II FALL MODEL ----------
    const HENDRICH_FACTORS = [
        { id:'confusion',      label:'Confusion / Disorientation / Impulsivity', pts:4 },
        { id:'depression',     label:'Symptomatic Depression',                   pts:2 },
        { id:'elimination',    label:'Altered Elimination',                      pts:1 },
        { id:'dizziness',      label:'Dizziness / Vertigo',                      pts:1 },
        { id:'male',           label:'Male Gender',                              pts:1 },
        { id:'antiepileptics', label:'Any Administered Antiepileptics',          pts:2 },
        { id:'benzos',         label:'Any Administered Benzodiazepines',         pts:1 }
    ];
    const GET_UP_GO_OPTS = [
        { val:0, label:'Able to rise in a single movement — no loss of balance with steps' },
        { val:1, label:'Pushes up, successful in one attempt' },
        { val:3, label:'Multiple attempts, but successful' },
        { val:4, label:'Unable to rise without assistance during test' }
    ];
    R.hendrich = function (rootEl, state, onChange) {
        if (!state.factors) state.factors = {};
        if (state.getUpGo == null) state.getUpGo = '';
        function render() {
            let total = 0;
            const factorsHtml = HENDRICH_FACTORS.map(function (f) {
                const isOn = !!state.factors[f.id];
                if (isOn) total += f.pts;
                return '<label class="cap-hendrich-row' + (isOn ? ' selected' : '') + '">' +
                    '<input type="checkbox" data-hendrich="' + f.id + '"' + (isOn ? ' checked' : '') + '>' +
                    '<span class="cap-hendrich-label">' + esc(f.label) + '</span>' +
                    '<span class="cap-hendrich-pts">+' + f.pts + '</span>' +
                '</label>';
            }).join('');
            const ugVal = parseInt(state.getUpGo, 10);
            if (!isNaN(ugVal)) total += ugVal;
            const ugHtml = GET_UP_GO_OPTS.map(function (o) {
                const isOn = state.getUpGo == String(o.val);
                return '<label class="cap-morse-opt' + (isOn ? ' selected' : '') + '">' +
                    '<input type="radio" name="cap-hendrich-ug" value="' + o.val + '" data-ug' + (isOn ? ' checked' : '') + '>' +
                    '<span>' + esc(o.label) + '</span>' +
                    '<span class="cap-morse-pts">+' + o.val + '</span>' +
                '</label>';
            }).join('');
            const risk = total >= 5 ? { label: 'High Risk for Falling (≥5)', cls: 'high' } : { label: 'Lower Risk (<5)', cls: 'low' };
            rootEl.innerHTML = panelHint(
                'Hendrich II Fall Risk Model',
                'Check applicable risk factors and pick a Get-Up-and-Go score. Total ≥5 = High Risk for falling.',
                '<div class="cap-hendrich-list">' + factorsHtml + '</div>' +
                '<h4 style="margin:14px 0 6px;font-size:13px;color:var(--clx-text-primary);">Get-Up-and-Go Test</h4>' +
                '<div class="cap-morse-opts">' + ugHtml + '</div>' +
                scoreBlock(total, 'Total Hendrich II Score', risk.label, risk.cls) +
                '<p class="cap-fineprint">Score interpretation: 0–4 lower risk · ≥5 high risk for falling.</p>'
            );
            rootEl.querySelectorAll('input[type="checkbox"][data-hendrich]').forEach(function (cb) {
                cb.addEventListener('change', function () {
                    state.factors[cb.dataset.hendrich] = cb.checked;
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            rootEl.querySelectorAll('input[type="radio"][data-ug]').forEach(function (r) {
                r.addEventListener('change', function () {
                    state.getUpGo = r.value;
                    if (typeof onChange === 'function') onChange();
                    render();
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

    // ---------- CONCEPT MAP ----------
    R.conceptMap = function (rootEl, state, onChange) {
        if (!Array.isArray(state.problems)) state.problems = [emptyProblem()];
        function emptyProblem() {
            return { name:'', data:'', dx:'', goals:'', interventions:'', evaluation:'' };
        }
        function render() {
            const problemsHtml = state.problems.map(function (p, i) {
                return '<div class="cap-cm-problem">' +
                    '<div class="cap-cm-head">' +
                        '<input type="text" data-cm="' + i + '" data-col="name" value="' + esc(p.name) + '" placeholder="Problem name (e.g., Impaired Skin Integrity)" class="cap-tf cap-cm-name">' +
                        '<button class="cap-row-del" data-del="' + i + '" title="Remove problem">&times;</button>' +
                    '</div>' +
                    '<div class="cap-cm-grid">' +
                        '<div class="cap-field"><label class="cap-label">Supporting Data (assessment cues)</label><textarea data-cm="' + i + '" data-col="data" rows="2" class="cap-tf">' + esc(p.data) + '</textarea></div>' +
                        '<div class="cap-field"><label class="cap-label">NANDA Diagnosis</label><textarea data-cm="' + i + '" data-col="dx" rows="2" class="cap-tf">' + esc(p.dx) + '</textarea></div>' +
                        '<div class="cap-field"><label class="cap-label">Goals / Outcomes</label><textarea data-cm="' + i + '" data-col="goals" rows="2" class="cap-tf">' + esc(p.goals) + '</textarea></div>' +
                        '<div class="cap-field"><label class="cap-label">Interventions &amp; Rationales</label><textarea data-cm="' + i + '" data-col="interventions" rows="2" class="cap-tf">' + esc(p.interventions) + '</textarea></div>' +
                        '<div class="cap-field"><label class="cap-label">Evaluation Criteria</label><textarea data-cm="' + i + '" data-col="evaluation" rows="2" class="cap-tf">' + esc(p.evaluation) + '</textarea></div>' +
                    '</div>' +
                '</div>';
            }).join('');
            rootEl.innerHTML = panelHint(
                'Concept Map',
                'Place the resident at the center; map their key problems. For each: supporting data → NANDA dx → goals → interventions + rationales → evaluation criteria. (For a hand-drawn map, use PPT/Canva/Word and submit alongside the packet.)',
                '<div class="cap-cm-center">' +
                    '<label class="cap-label">Resident summary (center node)</label>' +
                    '<textarea data-cap-field="center" rows="2" class="cap-tf" placeholder="e.g., 78 y/o male, post-CVA with L-sided hemiplegia, T2DM, Stage II sacral pressure injury. Resides in LTC."></textarea>' +
                '</div>' +
                problemsHtml +
                '<button class="cap-add-row" id="cap-cm-add">+ Add problem</button>'
            );
            // bind center
            const center = rootEl.querySelector('[data-cap-field="center"]');
            if (center) {
                center.value = state.center || '';
                center.addEventListener('input', function () {
                    state.center = center.value;
                    if (typeof onChange === 'function') onChange();
                });
            }
            // problem rows
            rootEl.querySelectorAll('[data-cm]').forEach(function (el) {
                const i = parseInt(el.dataset.cm, 10);
                const col = el.dataset.col;
                el.addEventListener('input', function () {
                    if (!state.problems[i]) return;
                    state.problems[i][col] = el.value;
                    if (typeof onChange === 'function') onChange();
                });
            });
            rootEl.querySelectorAll('[data-del]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const i = parseInt(btn.dataset.del, 10);
                    state.problems.splice(i, 1);
                    if (!state.problems.length) state.problems.push(emptyProblem());
                    if (typeof onChange === 'function') onChange();
                    render();
                });
            });
            const addBtn = rootEl.querySelector('#cap-cm-add');
            if (addBtn) addBtn.addEventListener('click', function () {
                state.problems.push(emptyProblem());
                if (typeof onChange === 'function') onChange();
                render();
            });
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
                    '<p class="cap-hint">Teaching points for the resident and family.</p>' +
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

    window.CAP_RENDERERS = R;
})();
