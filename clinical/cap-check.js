/* BendBSN — Clinical Assessment Packet — pre-submit check
   ------------------------------------------------------------------
   "Completeness check against the rubric and template — not a grade."
   (CAP_CHECK.LABEL — the editor shows it on the Check drawer.)

   window.CAP_CHECK.checkPacket(packet, profile, opts) reads a packet
   ({ meta, state }) against a course profile (CAP.COURSE_PROFILES[id], or
   its id; omitted = the packet's own meta.profile) and returns:
     rows     one per profile.rubric row, in rubric order:
              { id, n, label, points, status, notes:[{ text, tab, sel }] }
              status 'complete' | 'partial' | 'missing' | 'na'
     issues   [{ severity, code, text, tab, sel, excerpt }], 'block' first,
              then 'warn', then 'info' (each group in the order found)
     blanks   [{ tab, sel, label }] — empty fields the rubric asks for
     summary  { complete, partial, missing, na, blocking }
              blocking = missing rows + 'block' issues
   tab = the module id whose tab holds the field; sel = a CSS selector for
   the field inside that tab, built only from known field keys
   ('[data-cap-field="p_patho"]', '[data-lab="na"][data-col="normal"]', …),
   or '' when there is no stable one.

   Thresholds come from profile.check (minWords per stored key — plus
   `intervention` / `rationale` for each of the six care-plan ones and
   `ncsbn` for each of the 7 boxes —, minRefs, recentYears, geriatricAge,
   h2tFill). Word counts are "aim for" guidance, never points: a written
   part counts once it reaches 75% of its aim (AIM_OK), so a goal one word
   short never holds a row back, and notes read "11 words (aim for ~12)".

   "Printed" = CAP.buildPrintPlan(packet, profile): a module left out of the
   PDF isn't scanned; one set to N/A counts as answered by its reason; a
   rubric module that is switched off or left out leaves its row missing.

   Pure and read-only: no DOM, never writes to the packet (reads go
   through CAP_MODULES' read-time helpers, which return fresh objects),
   never throws (every row and every cross-check is wrapped). Depends only
   on window.CAP_MODULES. opts.now (ms) pins "today" for the reference-age
   check (default Date.now()).

   Issue codes
     block  deid-initials, lab-contradiction
     warn   secondary-unrelated, dx-pes, dx-rt-medical, goal-timeframe,
            ref-no-year, cite-no-ref, ref-not-cited, deid-room,
            hendrich-male, na-no-reason
     info   essay-no-patient, hpi-no-duration, goal-subject, ref-old,
            lab-not-discussed, section-uncited, geriatric-hendrich, and the
            RULES codes (rule-*)
*/
(function () {
    'use strict';
    if (window.CAP_CHECK) return;

    const VERSION = 1;
    const LABEL = 'Completeness check against the rubric and template — not a grade.';
    const DEFAULTS = { minRefs: 2, recentYears: 5, geriatricAge: 65, h2tFill: 0.6 };
    const SEVERITY_ORDER = { block: 0, warn: 1, info: 2 };

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    function CAPM() { return (typeof window !== 'undefined' && window.CAP_MODULES) || {}; }
    function FORM() { return CAPM().FORM || {}; }
    function isObj(v) { return !!v && typeof v === 'object'; }
    function str(v) { return v == null || typeof v === 'object' ? '' : String(v); }
    function own(o, k) { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); }
    function countWords(s) {
        const C = CAPM();
        if (typeof C.countWords === 'function') return C.countWords(str(s));
        return str(s).split(/\s+/).filter(function (t) { return /[A-Za-z0-9]/.test(t); }).length;
    }
    // RTDB hands a list back as an array, an integer-keyed object, or with
    // null gaps: a plain array in index order, gaps dropped
    function listOf(v) {
        if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
        if (isObj(v)) {
            return Object.keys(v).filter(function (k) { return /^\d+$/.test(k); })
                .sort(function (a, b) { return Number(a) - Number(b); })
                .map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
        }
        return [];
    }
    // Row lists as the editor numbers them (meds rows, labs extra)
    function objRows(v) { return listOf(v).filter(isObj); }
    function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
    // CSS attribute selectors from known keys only ('' for anything else)
    function safe(v) { return /^[A-Za-z0-9_-]+$/.test(String(v)); }
    function attr(name, val) { return safe(val) ? '[' + name + '="' + val + '"]' : ''; }
    function attr2(n1, v1, n2, v2) { return safe(v1) && safe(v2) ? '[' + n1 + '="' + v1 + '"][' + n2 + '="' + v2 + '"]' : ''; }
    function field(key) { return attr('data-cap-field', key); }
    function note(text, tab, sel) { return { text: text, tab: tab || '', sel: sel || '' }; }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function clip(s, n) {
        const t = str(s).replace(/\s+/g, ' ').trim();
        if (t.length <= n) return t;
        const cut = t.slice(0, n - 1);
        return (cut.replace(/\s+\S*$/, '') || cut) + '…';
    }
    // A few words either side of a hit
    function excerptAt(text, at, len) {
        const t = str(text);
        const a = Math.max(0, at - 30), b = Math.min(t.length, at + len + 30);
        return (a > 0 ? '…' : '') + t.slice(a, b).replace(/\s+/g, ' ').trim() + (b < t.length ? '…' : '');
    }
    function moduleDef(id) { const m = (CAPM().MODULE_BY_ID || {})[id]; return m || null; }
    function baseOf(id) { const m = moduleDef(id); return (m && m.base) || id; }
    // The module's name as the Modules drawer shows it (without the Day-2
    // "(Disregard for Five-Week Courses)" tail)
    function modName(id) {
        const m = moduleDef(id);
        return m ? String(m.label).replace(/\s*\(Disregard[^)]*\)/i, '') : String(id);
    }
    function cap1(s) { s = str(s); return s.charAt(0).toUpperCase() + s.slice(1); }

    // ------------------------------------------------------------------
    // Context: everything one checkPacket() call reads, worked out once
    // ------------------------------------------------------------------
    function num(v, d) { const n = Number(v); return v != null && v !== '' && isFinite(n) ? n : d; }
    function makeCtx(packet, profile, opts) {
        const C = CAPM();
        const meta = isObj(packet && packet.meta) ? packet.meta : {};
        const state = isObj(packet && packet.state) ? packet.state : {};
        if (typeof profile === 'string') profile = own(C.COURSE_PROFILES, profile) ? C.COURSE_PROFILES[profile] : null;
        if (!isObj(profile)) profile = typeof C.profileFor === 'function' ? C.profileFor(meta) : null;
        const pc = profile && isObj(profile.check) ? profile.check : {};
        const cfg = {
            minWords: isObj(pc.minWords) ? pc.minWords : {},
            minRefs: Math.max(0, Math.round(num(pc.minRefs, DEFAULTS.minRefs))),
            recentYears: num(pc.recentYears, DEFAULTS.recentYears),
            geriatricAge: num(pc.geriatricAge, DEFAULTS.geriatricAge),
            h2tFill: Math.min(1, Math.max(0, num(pc.h2tFill, DEFAULTS.h2tFill)))
        };
        const now = opts && typeof opts.now === 'number' && isFinite(opts.now) ? opts.now : Date.now();
        const on = {};
        const en = meta.enabledModules;
        (Array.isArray(en) ? en : (isObj(en) ? Object.keys(en).map(function (k) { return en[k]; }) : []))
            .forEach(function (id) { if (typeof id === 'string') on[id] = true; });
        let plan = [];
        try { plan = typeof C.buildPrintPlan === 'function' ? C.buildPrintPlan({ meta: meta, state: state }, profile) : []; } catch (e) { plan = []; }
        const printed = {}, printedList = [], naBlocks = {};
        plan.forEach(function (b) {
            if (!b || !b.mod) return;
            if (b.kind === 'form' || b.kind === 'essay') {
                if (!printed[b.mod]) { printed[b.mod] = true; printedList.push(b.mod); }
            } else if (b.kind === 'na') naBlocks[b.mod] = str(b.reason).trim();
        });
        const info = isObj(state.info) ? state.info : {};
        const person = (profile && profile.person) || (typeof C.personWord === 'function' ? C.personWord(meta) : 'patient');
        return {
            C: C, meta: meta, state: state, profile: profile, cfg: cfg,
            nowYear: new Date(now).getFullYear(),
            on: on, plan: plan, printed: printed, printedList: printedList, naBlocks: naBlocks,
            info: info,
            sex: typeof C.patientSex === 'function' ? C.patientSex(info) : '',
            person: person === 'resident' ? 'resident' : 'patient',
            issues: [], blanks: [],
            st: function (id) { return isObj(state[id]) ? state[id] : {}; },
            _labs: null, _fields: null
        };
    }
    function issue(ctx, severity, code, text, tab, sel, excerpt) {
        ctx.issues.push({ severity: severity, code: code, text: text, tab: tab || '', sel: sel || '', excerpt: excerpt || '' });
    }
    function labRows(ctx) {
        if (!ctx._labs) {
            try { ctx._labs = typeof ctx.C.labView === 'function' ? ctx.C.labView(ctx.st('labs'), ctx.sex) : []; }
            catch (e) { ctx._labs = []; }
        }
        return ctx._labs;
    }
    // 'off' (not enabled) | 'include' | 'na' | 'omit'
    function modeOf(ctx, id) {
        if (!ctx.on[id]) return 'off';
        const C = ctx.C;
        return typeof C.printModeFor === 'function' ? C.printModeFor(ctx.meta, id, ctx.profile) : 'include';
    }
    function reasonOf(ctx, id) {
        const C = ctx.C;
        return typeof C.naReasonFor === 'function' ? C.naReasonFor(ctx.meta, id).trim() : '';
    }
    // Can a rubric row read this module? 'eval' when it prints; otherwise a
    // note says why not, and the caller treats it as 'na' / missing.
    function gate(ctx, mod, notes, offText) {
        const m = modeOf(ctx, mod);
        if (m === 'include') return 'eval';
        if (m === 'na') {
            const r = reasonOf(ctx, mod);
            notes.push(note(r ? modName(mod) + ' is marked N/A: ' + clip(r, 120)
                              : modName(mod) + ' is marked N/A — add an N/A reason in Modules.', mod, ''));
            return 'na';
        }
        if (m === 'omit') {
            notes.push(note(modName(mod) + ' is set to Leave out, so it won\'t print — set it to Include in Modules (or N/A with a reason).', mod, ''));
            return 'omit';
        }
        notes.push(note(offText || ('Turn on ' + modName(mod) + ' in Modules.'), mod, ''));
        return 'off';
    }
    // Row status from its parts' statuses ('na' parts don't count)
    function combine(list) {
        const s = list.filter(function (x) { return x !== 'na'; });
        if (!s.length) return 'na';
        if (s.every(function (x) { return x === 'complete'; })) return 'complete';
        if (s.every(function (x) { return x === 'missing'; })) return 'missing';
        return 'partial';
    }
    function minW(ctx, key) {
        const mw = ctx.cfg.minWords;
        let n = own(mw, key) ? mw[key] : null;
        if (n == null && /_intervention$/.test(key)) n = mw.intervention;
        if (n == null && /_rationale$/.test(key)) n = mw.rationale;
        n = Number(n);
        return isFinite(n) && n >= 1 ? Math.round(n) : 1;
    }

    // A part meets its "aim for" word count at 75% of it (12 → 9, 120 → 90):
    // the counts are guidance, so a part a word or two short isn't padding work
    const AIM_OK = 0.75;
    function aimMet(n, min) { return min <= 1 ? n >= 1 : n >= Math.ceil(min * AIM_OK); }
    // Text parts → status. parts: [{ label, min, text, tab, sel, blank }].
    // complete = every part meets its aim; partial = some text; missing =
    // none. Notes name each part still short ("Pathophysiology: 54 words
    // (aim for ~120)"); a row not started gets one note. Empty parts go to
    // blanks.
    function partsStatus(ctx, parts, notes, title) {
        let any = false, all = true;
        const w = parts.map(function (p) {
            const n = countWords(p.text);
            if (n > 0) any = true;
            if (!aimMet(n, p.min)) all = false;
            if (n === 0) ctx.blanks.push({ tab: p.tab, sel: p.sel, label: p.blank || p.label });
            return n;
        });
        if (!parts.length) return 'missing';
        if (!any) {
            notes.push(note(title + ': not started yet (' + plural(parts.length, 'part') + ' to write).', parts[0].tab, parts[0].sel));
            return 'missing';
        }
        if (all) return 'complete';
        parts.forEach(function (p, i) {
            if (aimMet(w[i], p.min)) return;
            notes.push(note(p.min <= 1 ? p.label + ' — not filled in yet'
                : (w[i] ? p.label + ': ' + plural(w[i], 'word') + ' (aim for ~' + p.min + ')'
                        : p.label + ': not written yet (aim for ~' + p.min + ' words)'), p.tab, p.sel));
        });
        return 'partial';
    }

    // ------------------------------------------------------------------
    // Rubric rows
    // ------------------------------------------------------------------
    const PATIENT_RE = /\b(patient|pt|client|resident|he|she|his|her|him)\b/i;
    // How long: "3 days", "3-day history", "x3 days", "two weeks", "a week
    // ago", "yesterday", "since", "for the past…", "diagnosed in 2019"
    const QTY_WORDS = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|few|a few|couple(?: of)?|a couple(?: of)?';
    const SPAN_UNITS = 'hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?';
    const DURATION_RE = new RegExp('\\b\\d+[-\\s]*(?:' + SPAN_UNITS + ')\\b|\\b(?:' + QTY_WORDS + ')[-\\s]+(?:' + SPAN_UNITS + ')\\b' +
        '|x\\s*\\d+\\s*(?:d|' + SPAN_UNITS + '|y)\\b|\\bago\\b|\\byesterday\\b|\\blast (?:night|week|month|year)\\b|\\bsince\\b' +
        '|\\bfor (?:the )?(?:past|last)\\b|\\b(?:in|diagnosed|dx\'?d)\\s+(?:(?:early|late|mid)[-\\s]+)?(?:19|20)\\d{2}\\b', 'i');
    const RT_RE = /\br\/t\b|\brelated to\b/i;
    const AEB_RE = /\baeb\b|\ba\.e\.b\.?|\b(as )?evidenced by\b|\b(as )?manifested by\b|\bamb\b|\ba\.m\.b\.?/i;
    // A risk diagnosis has risk factors, not signs and symptoms
    const RISK_DX_RE = /\b(?:at\s+)?risk (?:for|of)\b|\breadiness for enhanced\b|\bpotential for\b/i;
    // Goal timeframes, including the instructions' "within a couple hours or
    // this shift" and "in a couple of days or weeks"
    const TF_QTY = '(?:\\d+(?:\\s*(?:-|to)\\s*\\d+)?|' + QTY_WORDS + '|thirty|sixty|twenty|fourteen)';
    const TF_UNITS = '(?:min(?:ute)?s?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|shifts?)';
    const TIMEFRAME_RE = new RegExp([
        '\\b(?:by|within|before|in|over|after|for)\\s+(?:the\\s+)?(?:next\\s+|first\\s+|following\\s+|coming\\s+)?(?:' + TF_QTY + '\\s+)?' + TF_UNITS + '\\b',
        '\\b\\d+\\s*-?\\s*' + TF_UNITS + '\\b',
        '\\b(?:by|within|before)\\s+(?:the\\s+)?(?:end of|discharge|\\d+|one|two|three|four|five|six|seven)',
        '\\bend of (?:the\\s+|my\\s+|this\\s+)?(?:shift|day|week|visit|stay|clinical)',
        '\\b(?:throughout|during|through|for the (?:rest|remainder|duration) of)\\s+(?:the|my|this|her|his|their)\\s+(?:shift|stay|admission|visit|hospitali[sz]ation|hospital stay|clinical(?: day| shift)?)\\b',
        '\\b(?:this|my)\\s+(?:shift|clinical (?:day|shift))\\b',
        '\\b(?:prior to|before|by|at|upon|on|until|till|by the time of|following|after)\\s+(?:the\\s+|her\\s+|his\\s+|their\\s+)?(?:discharge|d\\/c|follow[- ]?up|next (?:visit|appointment|clinical(?: day)?|shift))\\b',
        '\\b(?:by|before|on)\\s+(?:\\w+day|tomorrow)\\b',
        '\\b(?:tomorrow|today|tonight)\\b'
    ].join('|'), 'i');
    const SUBJECT_RE = /^(the\s+)?(patient|pt|client|resident)\b/i;
    // Words of a diagnosis name that don't identify it
    const DX_STOP = {};
    ['acute', 'chronic', 'exacerbation', 'disease', 'disorder', 'syndrome', 'with', 'without', 'and', 'the',
     'due', 'secondary', 'primary', 'unspecified', 'type', 'left', 'right', 'bilateral', 'history', 'status',
     'post', 'severe', 'mild', 'moderate', 'new', 'onset', 'from', 'for', 'possible', 'suspected', 'likely']
        .forEach(function (w) { DX_STOP[w] = true; });

    function essaySection(id) {
        const E = FORM().ESSAY || {};
        return (E.SECTIONS || []).filter(function (s) { return s.id === id; })[0] || null;
    }
    // The words of a diagnosis name that identify it (COPD, CHF, MI, pneumonia…)
    function dxTokens(name) {
        return str(name).split(/[^A-Za-z0-9]+/).filter(function (w) {
            if (/^[A-Z0-9]{2,}$/.test(w) && /[A-Z]/.test(w)) return true;     // COPD, CHF, MI
            return w.length >= 3 && !DX_STOP[w.toLowerCase()];
        });
    }
    // Does the secondary's pathophysiology bring in the primary diagnosis?
    function relatesToPrimary(text, pname) {
        if (/\bprimary\b/i.test(text)) return true;
        const toks = dxTokens(pname);
        return toks.some(function (w) {
            if (/^[A-Z0-9]{2,}$/.test(w)) return new RegExp('(^|[^A-Za-z0-9])' + escRe(w) + '(?![A-Za-z])').test(text);
            return new RegExp('(^|[^A-Za-z0-9])' + escRe(w), 'i').test(text);
        });
    }
    function essayExtras(ctx, sec, st) {
        const who = ctx.person;
        const pfx = sec.id === 'primary' ? 'p_' : (sec.id === 'secondary' ? 's_' : '');
        if (pfx) {
            [['risk', 'Risk Factors', 'which risk factors YOUR ' + who + ' had'],
             ['signs', 'Signs and Symptoms', 'what YOUR ' + who + ' shows']].forEach(function (x) {
                const key = pfx + x[0], t = str(st[key]);
                if (t.trim() && !PATIENT_RE.test(t)) {
                    issue(ctx, 'info', 'essay-no-patient', x[1] + ' (' + sec.title + ') never mentions your ' + who +
                        ' — the template asks ' + x[2] + '.', 'essay', field(key), '');
                }
            });
        }
        if (sec.id === 'secondary') {
            const t = str(st.s_patho), pname = str(st.p_name).replace(/\s+/g, ' ').trim();
            if (t.trim() && !relatesToPrimary(t, pname)) {
                issue(ctx, 'warn', 'secondary-unrelated', 'Secondary Pathophysiology doesn\'t mention the primary diagnosis' +
                    (pname ? ' (' + clip(pname, 40) + ')' : '') +
                    ' — the template asks you to relate the two (development, exacerbation, or other factors).', 'essay', field('s_patho'), '');
            }
        }
        if (sec.id === 'hpi') {
            const t = str(st.hpi_explanation);
            if (t.trim() && !DURATION_RE.test(t)) {
                issue(ctx, 'info', 'hpi-no-duration', 'Patient Explanation or Chart Review gives no length of time — the template asks how long the ' +
                    who + ' has had the condition, if possible.', 'essay', field('hpi_explanation'), '');
            }
        }
    }
    function rowEssay(ctx, secId, notes) {
        const sec = essaySection(secId);
        const g = gate(ctx, 'essay', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval' || !sec) return 'missing';
        const st = ctx.st('essay');
        const parts = [];
        if (sec.nameKey) {
            parts.push({ label: 'Diagnosis name', min: 1, text: st[sec.nameKey], tab: 'essay', sel: field(sec.nameKey),
                         blank: sec.title + ' — name' });
        }
        sec.fields.forEach(function (f) {
            parts.push({ label: f.head, min: minW(ctx, f.key), text: st[f.key], tab: 'essay', sel: field(f.key),
                         blank: sec.title + ' — ' + f.head });
        });
        const status = partsStatus(ctx, parts, notes, sec.title);
        try { essayExtras(ctx, sec, st); } catch (e) { /* never throw */ }
        return status;
    }

    const CP_SLOTS = [['assess', 'Assess'], ['do', 'Do'], ['teach', 'Teach']];
    function carePlanParts(ctx, st) {
        const parts = [];
        function add(key, label) {
            parts.push({ label: label, min: minW(ctx, key), text: st[key], tab: 'carePlan', sel: field(key), blank: 'Care Plan — ' + label });
        }
        add('finding', 'OMEGA-7 / Assessment Finding');
        add('dx', 'Nursing Diagnostic Statement');
        [['st', 'Short-term'], ['lt', 'Long-term']].forEach(function (g) {
            add(g[0] + '_goal', g[1] + ' goal');
            CP_SLOTS.forEach(function (s) {
                add(g[0] + '_' + s[0] + '_intervention', g[1] + ' ' + s[1] + ' intervention');
                add(g[0] + '_' + s[0] + '_rationale', g[1] + ' ' + s[1] + ' rationale');
            });
        });
        return parts;
    }
    // The words after "r/t" / "related to", up to "secondary to", "aeb", a
    // comma or the end of the sentence
    function rtClause(dx) {
        const m = /\br\/t\b|\brelated to\b/i.exec(dx);
        if (!m) return '';
        const rest = dx.slice(m.index + m[0].length);
        const cut = rest.search(/[,;]|\bsecondary to\b|\bs\/t\b|\bdue to\b|\baeb\b|\ba\.e\.b|\bas (?:evidenced|manifested)\b|\b(?:evidenced|manifested) by\b|\bamb\b|\bcomplicated by\b|[.!?](?:\s|$)/i);
        return (cut === -1 ? rest : rest.slice(0, cut)).replace(/\s+/g, ' ').trim();
    }
    // Medical diagnosis names the packet gives (essay names, Patient Info
    // diagnosis, the concept map's diagnoses), as lowercase identifying words
    function medicalDxWords(ctx) {
        const out = {};
        const names = [ctx.st('essay').p_name, ctx.st('essay').s_name, ctx.info.res_dx];
        try {
            if (typeof ctx.C.readConceptMap === 'function') {
                const cm = ctx.C.readConceptMap(ctx.st('conceptMap')).fields || {};
                names.push(cm.diagnosis, cm.secondaryDx);
            }
        } catch (e) { /* never throw */ }
        names.forEach(function (n) { dxTokens(n).forEach(function (w) { out[w.toLowerCase()] = true; }); });
        return out;
    }
    function carePlanExtras(ctx, st) {
        const who = ctx.person;
        const dx = str(st.dx);
        if (dx.trim()) {
            const rt = RT_RE.test(dx), aeb = AEB_RE.test(dx);
            if (RISK_DX_RE.test(dx)) {
                // "Risk for falls r/t impaired mobility": no signs and symptoms yet
                if (!rt && !aeb) {
                    issue(ctx, 'warn', 'dx-pes', 'Nursing Diagnostic Statement has no "r/t" (related to) part — a risk diagnosis is written "Risk for … r/t risk factors" (it has no signs and symptoms yet).',
                        'carePlan', field('dx'), clip(dx, 90));
                }
            } else if (!rt || !aeb) {
                const what = !rt && !aeb ? 'has no "r/t" (related to) or "aeb" (as evidenced by) part'
                    : (!rt ? 'has no "r/t" (related to) part' : 'has no "aeb" (as evidenced by) part');
                issue(ctx, 'warn', 'dx-pes', 'Nursing Diagnostic Statement ' + what +
                    ' — template: "NANDA r/t problem [secondary to medical dx] aeb signs and symptoms".', 'carePlan', field('dx'), clip(dx, 90));
            }
            // r/t names the medical diagnosis ("r/t pneumonia")
            const cause = rt ? rtClause(dx) : '';
            const toks = dxTokens(cause);
            if (toks.length) {
                const med = medicalDxWords(ctx);
                if (toks.every(function (w) { return med[w.toLowerCase()]; })) {
                    const c = clip(cause, 40);
                    issue(ctx, 'warn', 'dx-rt-medical', 'Nursing Diagnostic Statement: "r/t ' + c + '" names the medical diagnosis — r/t should be the pathophysiological cause, not the medical diagnosis (instructions); put "' +
                        c + '" after "secondary to".', 'carePlan', field('dx'), clip(dx, 90));
                }
            }
        }
        [['st_goal', 'Short-term goal', 'e.g. "by the end of my shift"'],
         ['lt_goal', 'Long-term goal', 'e.g. "within 2 weeks" or "by discharge"']].forEach(function (g) {
            const t = str(st[g[0]]).trim();
            if (!t) return;
            if (!TIMEFRAME_RE.test(t)) {
                issue(ctx, 'warn', 'goal-timeframe', g[1] + ' has no timeframe — goals must be SMART (Timebound), ' + g[2] + '.',
                    'carePlan', field(g[0]), clip(t, 90));
            }
            if (!SUBJECT_RE.test(t)) {
                issue(ctx, 'info', 'goal-subject', g[1] + ' doesn\'t start with the ' + who + ' — the template says a goal should begin with the ' +
                    who + ' ("The ' + who + ' will…").', 'carePlan', field(g[0]), clip(t, 60));
            }
        });
    }
    const NCSBN_LABEL = {
        s1: 'NCSBN Step 1 (Recognize Cues)', s2: 'NCSBN Step 2 (Analyze Cues)',
        s3a: 'NCSBN Step 3 (rank the problems)', s3b: 'NCSBN Step 3 (most likely / most concerning)',
        s45: 'NCSBN Steps 4–5 (priority actions)', s6a: 'NCSBN Step 6 (response)', s6b: 'NCSBN Step 6 (if not improved)'
    };
    function rowCarePlan(ctx, notes) {
        const sts = [];
        const g1 = gate(ctx, 'carePlan', notes);
        if (g1 === 'eval') {
            const st = ctx.st('carePlan');
            sts.push(partsStatus(ctx, carePlanParts(ctx, st), notes, 'Nursing Care Plan'));
            try { carePlanExtras(ctx, st); } catch (e) { /* never throw */ }
        } else sts.push(g1 === 'na' ? 'na' : 'missing');
        const g2 = gate(ctx, 'ncsbn', notes, 'Turn on ' + modName('ncsbn') + ' in Modules — it is 6 of the care plan\'s 24 points.');
        if (g2 === 'eval') {
            const view = typeof ctx.C.readNcsbn === 'function' ? ctx.C.readNcsbn(ctx.st('ncsbn')) : {};
            const parts = (FORM().NCSBN_ROWS || []).map(function (r) {
                const label = NCSBN_LABEL[r.key] || ('NCSBN ' + r.step);
                return { label: label, min: minW(ctx, 'ncsbn'), text: view[r.key], tab: 'ncsbn', sel: attr('data-ncsbn', r.key), blank: label };
            });
            sts.push(partsStatus(ctx, parts, notes, 'NCSBN Clinical Judgment Model'));
        } else sts.push(g2 === 'na' ? 'na' : 'missing');
        return combine(sts);
    }
    function rowDischarge(ctx, notes) {
        const g = gate(ctx, 'carePlan', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval') return 'missing';
        const st = ctx.st('carePlan');
        return partsStatus(ctx, [
            { label: 'Summary of Care', min: minW(ctx, 'summary'), text: st.summary, tab: 'carePlan', sel: field('summary'), blank: 'Care Plan — Summary of Care' },
            { label: 'Discharge Plan', min: minW(ctx, 'discharge'), text: st.discharge, tab: 'carePlan', sel: field('discharge'), blank: 'Care Plan — Discharge Plan' }
        ], notes, 'Discharge Plan / Summary');
    }

    // ---- References ----
    // Entries as the editor numbers them (blank entries keep their number)
    function refItems(st) {
        const v = st && st.refs;
        const raw = Array.isArray(v) ? v : listOf(v);
        return raw.map(function (x, i) { return { i: i, text: str(x).replace(/\s+/g, ' ').trim() }; })
            .filter(function (r) { return r.text; });
    }
    // Year of a reference entry: '2023', '2023a', 'nd', or '' (none)
    function refYear(s) {
        const m = /\(\s*((?:19|20)\d{2}[a-z]?)(?![0-9A-Za-z])|\(\s*(n\.\s?d\.)/i.exec(str(s));
        return m ? (m[1] ? m[1].toLowerCase() : 'nd') : '';
    }
    function shortRef(text) {
        const s = str(text);
        const cut = s.search(/,| \(/);
        const head = (cut === -1 ? s : s.slice(0, cut)).replace(/[.\s]+$/, '');
        const y = refYear(s);
        return clip(head, 40) + ', ' + (y === 'nd' ? 'n.d.' : (y || 'no year'));
    }
    function rowReferences(ctx, notes) {
        const g = gate(ctx, 'references', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval') return 'missing';
        const items = refItems(ctx.st('references'));
        const min = ctx.cfg.minRefs;
        const cutoff = ctx.nowYear - ctx.cfg.recentYears;
        let noYear = 0;
        items.forEach(function (r) {
            const sel = attr('data-ref', r.i);
            const y = refYear(r.text);
            if (!y) {
                noYear++;
                notes.push(note('Reference ' + (r.i + 1) + ' has no (year) or (n.d.).', 'references', sel));
                issue(ctx, 'warn', 'ref-no-year', 'Reference ' + (r.i + 1) + ' has no publication year — APA puts "(year)" or "(n.d.)" after the author.',
                    'references', sel, clip(r.text, 80));
            } else if (y !== 'nd' && parseInt(y, 10) < cutoff) {
                issue(ctx, 'info', 'ref-old', 'Reference ' + (r.i + 1) + ' is from ' + parseInt(y, 10) + ' — more than ' + ctx.cfg.recentYears +
                    ' years old (aim for ' + cutoff + ' or later).', 'references', sel, clip(r.text, 80));
            }
        });
        if (!items.length) {
            notes.push(note('No references yet — add at least ' + min + '.', 'references', attr('data-ref', 0)));
            ctx.blanks.push({ tab: 'references', sel: attr('data-ref', 0), label: 'References — reference 1' });
            return 'missing';
        }
        if (items.length < min) notes.push(note(items.length + ' of ' + min + ' references — add at least ' + min + '.', 'references', ''));
        return items.length >= min && !noYear ? 'complete' : 'partial';
    }

    // ---- Head-to-Toe ----
    // Instructions: "2 copies of this assessment, one for each week you are
    // working with that patient"; the form's Day-2 copy says "Disregard for
    // Five-Week Courses" — so a one-week patient sets Day 2 to N/A.
    function day2H2t(who) { return 'Day 2 Head-to-Toe: one per week you had this ' + who + ' (instructions)'; }
    function day2Way(who) { return 'If you only had this ' + who + ' one week, set Day 2 to N/A with a reason in Modules.'; }
    // Items with a value / all items (text + checkboxes; the body diagram
    // is extra). An old packet's "Previous notes" fill their whole region.
    function h2tFill(ctx, mod) {
        const C = ctx.C;
        const view = C.readHeadToToe(ctx.st(mod));
        const items = C.h2tItems().filter(function (it) { return it.type === 'text' || it.type === 'checks'; });
        const legacy = {};
        (view.legacy || []).forEach(function (l) { legacy[l.region] = true; });
        let filled = 0, firstEmpty = '';
        items.forEach(function (it) {
            const v = view.values[it.id];
            let ok = !!legacy[it.region];
            if (!ok) {
                if (it.type === 'text') ok = str(v).trim() !== '';
                else if (it.single) ok = !!v;
                else ok = isObj(v) && Object.keys(v).some(function (k) { return v[k]; });
            }
            if (ok) filled++;
            else if (!firstEmpty && it.type === 'text') firstEmpty = it.id;
        });
        return { filled: filled, total: items.length, firstEmpty: firstEmpty };
    }
    function rowH2t(ctx, notes) {
        const fill = ctx.cfg.h2tFill;
        const sts = [];
        const who = ctx.person;
        [['headToToe', 'Day 1', ''], ['headToToe2', 'Day 2', day2H2t(who)]].forEach(function (d) {
            const g = gate(ctx, d[0], notes, d[2] ? d[2] + ' — turn on ' + modName(d[0]) + ' in Modules (only had this ' + who +
                ' one week? Turn it on and set it to N/A with a reason).' : '');
            if (g === 'na') { sts.push('na'); return; }
            if (g !== 'eval') { sts.push('missing'); return; }
            const f = h2tFill(ctx, d[0]);
            const sel = f.firstEmpty ? attr('data-h2t', f.firstEmpty) : '';
            if (!f.filled) {
                notes.push(note(d[2] ? d[2] + ' — it is still empty. ' + day2Way(who) : 'Head-to-Toe ' + d[1] + ' is empty.', d[0], sel));
                ctx.blanks.push({ tab: d[0], sel: sel, label: 'Head-to-Toe ' + d[1] });
                sts.push('missing');
                return;
            }
            const ratio = f.total ? f.filled / f.total : 1;
            if (ratio + 1e-9 >= fill) { sts.push('complete'); return; }
            notes.push(note('Head-to-Toe ' + d[1] + ': ' + f.filled + ' of ' + f.total + ' items filled (' + Math.round(ratio * 100) +
                '%) — aim for ' + Math.round(fill * 100) + '%+.', d[0], sel));
            sts.push('partial');
        });
        return combine(sts);
    }

    // ---- OMEGA ----
    function omegaRowName(r) { return r.letter + ' ' + r.label; }
    function rowOmega(ctx, notes) {
        const ROWS = FORM().OMEGA_ROWS || [];
        const sts = [];
        [['omega', 'Day 1'], ['omega2', 'Day 2']].forEach(function (d) {
            const day2 = d[0] === 'omega2';
            const g = gate(ctx, d[0], notes, day2
                ? 'OMEGA Day 2 is part of the form — turn on ' + modName('omega2') + ' in Modules (it has a "No change from Day 1" box).' : '');
            if (g === 'na') { sts.push('na'); return; }
            if (g !== 'eval') { sts.push('missing'); return; }
            const st = ctx.st(d[0]);
            if (day2 && st.noChange === true) { sts.push('complete'); return; }
            const empty = ROWS.filter(function (r) { return !str(st[r.key]).trim(); });
            empty.forEach(function (r) {
                ctx.blanks.push({ tab: d[0], sel: field(r.key), label: 'OMEGA ' + d[1] + ' — ' + omegaRowName(r) });
            });
            if (!empty.length) { sts.push('complete'); return; }
            const tick = day2 ? ', or tick "No change in assessment/condition from Day 1"' : '';
            if (empty.length === ROWS.length) {
                notes.push(note('OMEGA ' + d[1] + ' is empty — fill in every row' + tick + '.', d[0],
                    day2 ? 'input' + field('noChange') : field(ROWS[0].key)));
                sts.push('missing');
                return;
            }
            const names = empty.slice(0, 6).map(omegaRowName).join(', ') + (empty.length > 6 ? ', …' : '');
            notes.push(note('OMEGA ' + d[1] + ': ' + empty.length + ' of ' + ROWS.length + ' rows empty (' + names + ')' + tick + '.', d[0], field(empty[0].key)));
            sts.push('partial');
        });
        return combine(sts);
    }

    // ---- Labs ----
    const LAB_SHORT = {
        na: 'Na', k: 'K', cl: 'Cl', co2: 'CO2', bun: 'BUN', creatinine: 'Creatinine', cholesterol: 'Cholesterol',
        albumin: 'Albumin', rbc: 'RBC', wbc: 'WBC', hct: 'Hct', hgb: 'Hgb', pt: 'PT', ptt: 'PTT', inr: 'INR',
        tsh: 'TSH', alt: 'ALT', ast: 'AST'
    };
    function labName(r) { return r.isExtra ? clip(r.label, 30) : (LAB_SHORT[r.id] || r.label); }
    function labCell(r, col) { return r.isExtra ? attr2('data-extra', r.index, 'data-col', col) : attr2('data-lab', r.id, 'data-col', col); }
    function flagged(ctx) {
        return labRows(ctx).filter(function (r) { return r.flag === 'H' || r.flag === 'L'; });
    }
    function flagList(rows) {
        return rows.map(function (r) { return labName(r) + ' ' + clip(r.result, 20) + ' (' + r.flag + ')'; }).join(', ');
    }
    function rowLabs(ctx, notes) {
        const g = gate(ctx, 'labs', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval') return 'missing';
        const rows = labRows(ctx).filter(function (r) {
            return !r.isExtra || /\S/.test(r.normal + r.result + r.interp) || !/^Added lab \d+$/.test(r.label);
        });
        const noNormal = [], noInterp = [], noResult = [];
        rows.forEach(function (r) {
            if (!r.normal.trim()) noNormal.push(r);
            if (!r.interp.trim()) noInterp.push(r);
            if (!r.result.trim() && !r.notDrawn) noResult.push(r);
        });
        const any = rows.some(function (r) { return (r.normal + r.result + r.interp).trim() || r.notDrawn; }) ||
            !!str(ctx.st('labs')._sandboxText).trim();
        function blanksFor(list, col, title) {
            list.forEach(function (r) { ctx.blanks.push({ tab: 'labs', sel: labCell(r, col), label: 'Labs — ' + r.label + ': ' + title }); });
        }
        blanksFor(noNormal, 'normal', 'Normal Values');
        blanksFor(noResult, 'result', 'Patient Result');
        blanksFor(noInterp, 'interp', 'Interpretation');
        if (!rows.length || !any) {
            notes.push(note('The lab table is empty — every row needs Normal Values, a result (or Not drawn) and an Interpretation.', 'labs',
                rows.length ? labCell(rows[0], 'normal') : ''));
            return 'missing';
        }
        if (!noNormal.length && !noInterp.length && !noResult.length) return 'complete';
        if (noNormal.length) notes.push(note(plural(noNormal.length, 'row') + ' missing Normal Values.', 'labs', labCell(noNormal[0], 'normal')));
        if (noInterp.length) notes.push(note(plural(noInterp.length, 'row') + ' missing Interpretation (instructions: even if not drawn — why it would be drawn, what high or low would mean).', 'labs', labCell(noInterp[0], 'interp')));
        if (noResult.length) notes.push(note(plural(noResult.length, 'row') + ' missing a result — enter it or mark Not drawn.', 'labs', labCell(noResult[0], 'result')));
        return 'partial';
    }

    // ---- Medications ----
    function medCell(i, col) { return attr2('data-row', i, 'data-col', col); }
    function rowMeds(ctx, notes) {
        const g = gate(ctx, 'meds', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval') return 'missing';
        const cols = FORM().MED_COLUMNS || [];
        const rows = objRows(ctx.st('meds').rows);
        const used = rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
            return cols.some(function (c) { return str(x.r[c.key]).trim(); });
        });
        if (!used.length) {
            notes.push(note('No medications listed yet.', 'meds', medCell(0, 'order')));
            ctx.blanks.push({ tab: 'meds', sel: medCell(0, 'order'), label: 'Medications — row 1' });
            return 'missing';
        }
        let bad = 0;
        used.forEach(function (x) {
            const miss = cols.filter(function (c) { return !str(x.r[c.key]).trim(); });
            if (!miss.length) return;
            bad++;
            miss.forEach(function (c) {
                ctx.blanks.push({ tab: 'meds', sel: medCell(x.i, c.key), label: 'Medications row ' + (x.i + 1) + ' — ' + c.title });
            });
            if (bad > 8) return;
            const name = str(x.r.order).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean)[0] || '';
            notes.push(note('Row ' + (x.i + 1) + (name ? ' (' + clip(name, 40) + ')' : '') + ': missing ' +
                miss.map(function (c) { return c.title; }).join(', ') + '.', 'meds', medCell(x.i, miss[0].key)));
        });
        if (bad > 8) notes.push(note('…and ' + plural(bad - 8, 'more row') + ' with empty columns.', 'meds', ''));
        return bad ? 'partial' : 'complete';
    }

    // ---- Braden or Hendrich ----
    function ageOf(ctx) {
        const t = str(ctx.info.res_age).trim();
        return /^\d+(?:\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
    }
    function rowScales(ctx, notes) {
        const C = ctx.C;
        const mb = modeOf(ctx, 'braden'), mh = modeOf(ctx, 'hendrich');
        const local = [];
        let b = null, h = null;
        if (mb === 'include') {
            const v = C.readBraden(ctx.st('braden'));
            const scores = (FORM().BRADEN.COLS || []).map(function (c) { return C.scoreBraden(v.cols[c.key].choices); });
            const best = scores.reduce(function (a, s) { return s.n > a.n ? s : a; }, { n: 0, of: 6 });
            b = scores.some(function (s) { return s.complete; }) ? 'complete' : (best.n ? 'partial' : 'missing');
            if (b === 'partial') local.push(note('Braden Scale: ' + best.n + ' of ' + best.of + ' factors scored — finish one assessment column.', 'braden', ''));
        }
        const hs = C.scoreHendrich(ctx.st('hendrich'));
        if (mh === 'include') {
            h = hs.scored && hs.gug != null ? 'complete' : (hs.scored ? 'partial' : 'missing');
            if (h === 'partial') local.push(note('Hendrich II: score the Get Up & Go test.', 'hendrich', ''));
        }
        // Cross-checks with Patient Info
        const age = ageOf(ctx);
        if (age >= ctx.cfg.geriatricAge && !(mh === 'include' && hs.scored) && mh !== 'na') {
            issue(ctx, 'info', 'geriatric-hendrich', cap1(ctx.person) + ' is ' + age + ' — template: Hendrich II for geriatric ' + ctx.person +
                's (Morse for the general population).', 'hendrich', '', '');
        }
        if (ctx.sex === 'male' && mh === 'include' && hs.scored && !(ctx.st('hendrich').factors || {}).male) {
            issue(ctx, 'warn', 'hendrich-male', cap1(ctx.person) + ' Info says male, but Hendrich II Male Gender isn\'t ticked (+1 point).',
                'hendrich', 'input' + attr('data-hendrich', 'male'), '');
        }
        const inc = [b, h].filter(Boolean);
        if (inc.indexOf('complete') !== -1) return 'complete';
        if (inc.length) {
            local.forEach(function (n) { notes.push(n); });
            if (inc.indexOf('partial') !== -1) return 'partial';
            notes.push(note('Score a Braden Scale (all 6 factors in one column) or the Hendrich II Fall Model (with the Get Up & Go test) — the rubric takes either.',
                mb === 'include' ? 'braden' : 'hendrich', ''));
            return 'missing';
        }
        // Neither prints
        if (mb === 'na' || mh === 'na') {
            if (mb === 'na') gate(ctx, 'braden', notes);
            if (mh === 'na') gate(ctx, 'hendrich', notes);
            return 'na';
        }
        if (mb === 'omit' || mh === 'omit') {
            if (mb === 'omit') gate(ctx, 'braden', notes);
            if (mh === 'omit') gate(ctx, 'hendrich', notes);
        } else {
            notes.push(note('Turn on ' + modName('braden') + ' or ' + modName('hendrich') + ' in Modules.', 'braden', ''));
        }
        return 'missing';
    }

    // ---- Mini-Cog ----
    function rowCognitive(ctx, notes) {
        const g = gate(ctx, 'minicog', notes);
        if (g === 'na') return 'na';
        if (g !== 'eval') return 'missing';
        const st = ctx.st('minicog');
        const v = ctx.C.readMinicog(st);
        const scored = v.recall != null && v.clock != null;
        const status = st.status === 'patient' || st.status === 'practice' ? st.status : '';
        const reason = str(st.reason).trim();
        const who = ctx.person;
        const statusSel = 'input[data-mc-status]';
        if (scored && (status === 'patient' || (status === 'practice' && reason))) return 'complete';
        if (scored) {
            notes.push(status === 'practice'
                ? note('Explain why it couldn\'t be done (or wasn\'t appropriate) with your ' + who + '.', 'minicog', 'textarea' + field('reason'))
                : note('Say who it was done with — your ' + who + ', or a fellow nursing student (practice).', 'minicog', statusSel));
            return 'partial';
        }
        if (status === 'practice' && reason) {
            notes.push(note('Score the Mini-Cog from the practice run — template: perform it with a fellow nursing student.', 'minicog', field('recall')));
            return 'partial';
        }
        const started = status || reason || str(st.notes).trim() || v.recall != null || v.clock != null || (typeof st.clockPng === 'string' && st.clockPng);
        if (started) {
            notes.push(note('Not scored yet — score word recall and the clock drawing. If it can\'t be done with your ' + who +
                ', explain why and perform it with a fellow nursing student (template).', 'minicog', statusSel));
            return 'partial';
        }
        notes.push(note('Mini-Cog: not started yet.', 'minicog', statusSel));
        return 'missing';
    }

    const ROW_FNS = {
        primary:    function (ctx, notes) { return rowEssay(ctx, 'primary', notes); },
        secondary:  function (ctx, notes) { return rowEssay(ctx, 'secondary', notes); },
        hpi:        function (ctx, notes) { return rowEssay(ctx, 'hpi', notes); },
        data:       function (ctx, notes) { return rowEssay(ctx, 'data', notes); },
        careplan:   rowCarePlan,
        discharge:  rowDischarge,
        references: rowReferences,
        h2t:        rowH2t,
        omega:      rowOmega,
        labs:       rowLabs,
        meds:       rowMeds,
        scales:     rowScales,
        cognitive:  rowCognitive
    };

    // ------------------------------------------------------------------
    // Printed text — every string the PDF prints, with where it lives
    // ------------------------------------------------------------------
    // Keys whose string value is a date, a time stamp or a stored option
    // key, never prose
    const SKIP_STRING = {
        date: 1, res_dob: 1, admit_date: 1, review1: 1, review2: 1, createdAt: 1, updatedAt: 1,
        status: 1, sex: 1, shift: 1, format: 1, getUpGo: 1, recall: 1, clock: 1, recallLegacy: 1, view: 1
    };
    // Modules whose plain keys are bound with data-cap-field
    const BIND = { info: 1, omega: 1, carePlan: 1, essay: 1, minicog: 1, notes: 1, sbar: 1 };
    function selFor(mod, path) {
        const base = baseOf(mod);
        const k = path[0];
        if (path.length === 1) {
            if (BIND[base]) return field(k);
            if (base === 'headToToe') return attr('data-h2t', k);
            if (base === 'conceptMap') return attr('data-cmf', k);
            return '';
        }
        if (path.length === 2) {
            if (base === 'ncsbn' && k === 'boxes') return attr('data-ncsbn', path[1]);
            if (base === 'references' && k === 'refs') return attr('data-ref', path[1]);
            if (base === 'hendrich' && k === 'notes') return attr('data-hnote', path[1]);
            if (base === 'conceptMap' && k === 'nursingDx') return attr('data-cmdx', path[1]);
        }
        if (path.length === 3) {
            if (base === 'meds' && k === 'rows') return attr2('data-row', path[1], 'data-col', path[2]);
            if (base === 'labs' && k === 'rows') return attr2('data-lab', path[1], 'data-col', path[2]);
            if (base === 'labs' && k === 'extra') return attr2('data-extra', path[1], 'data-col', path[2]);
            if (base === 'conceptMap' && k === 'problems') return attr2('data-cm', path[1], 'data-col', path[2]);
        }
        return '';
    }
    // The module's data as the editor and the PDF read it (migrated shapes,
    // lists numbered as the editor numbers them) — fresh objects only
    function readable(ctx, mod) {
        const C = ctx.C, base = baseOf(mod), st = ctx.st(mod);
        if (base === 'ncsbn' && typeof C.readNcsbn === 'function') return { boxes: C.readNcsbn(st) };
        if (base === 'conceptMap' && typeof C.readConceptMap === 'function') {
            const v = C.readConceptMap(st);
            return Object.assign({}, v.fields, { nursingDx: v.nursingDx, problems: v.problems });
        }
        if (base === 'meds') return Object.assign({}, st, { rows: objRows(st.rows) });
        if (base === 'labs') return Object.assign({}, st, { extra: objRows(st.extra) });
        if (base === 'references') return { refs: Array.isArray(st.refs) ? st.refs : listOf(st.refs) };
        return st;
    }
    function printedFields(ctx) {
        if (!ctx._fields) ctx._fields = fieldsOf(ctx, ctx.printedList);
        return ctx._fields;
    }
    // Text in modules that are switched on but don't print (left out / N/A)
    function unprintedFields(ctx) {
        return fieldsOf(ctx, Object.keys(ctx.on).filter(function (id) { return !ctx.printed[id] && moduleDef(id); }));
    }
    function fieldsOf(ctx, mods) {
        const out = [];
        mods.forEach(function (mod) {
            try {
                (function rec(v, path, depth) {
                    if (depth > 8) return;
                    if (typeof v === 'string') {
                        if (v.trim()) out.push({ mod: mod, path: path, key: path[path.length - 1], text: v, sel: selFor(mod, path) });
                        return;
                    }
                    if (!isObj(v)) return;
                    Object.keys(v).forEach(function (k) {
                        if (k === 'clockPng' || k === '_schema') return;
                        if (typeof v[k] === 'string' && SKIP_STRING[k]) return;
                        rec(v[k], path.concat(k), depth + 1);
                    });
                })(readable(ctx, mod), [], 0);
            } catch (e) { /* never throw */ }
        });
        return out;
    }
    // A printed field's name as its tab shows it ('' when there's no good one)
    const CP_LABEL = { finding: 'OMEGA-7 / Assessment Finding', dx: 'Nursing Diagnostic Statement', summary: 'Summary of Care', discharge: 'Discharge Plan' };
    [['st', 'Short-term'], ['lt', 'Long-term']].forEach(function (g) {
        CP_LABEL[g[0] + '_goal'] = g[1] + ' goal';
        [['assess', 'Assess'], ['do', 'Do'], ['teach', 'Teach']].forEach(function (s) {
            CP_LABEL[g[0] + '_' + s[0] + '_intervention'] = g[1] + ' ' + s[1] + ' intervention';
            CP_LABEL[g[0] + '_' + s[0] + '_rationale'] = g[1] + ' ' + s[1] + ' rationale';
        });
    });
    function fieldLabel(ctx, f) {
        try {
            const base = baseOf(f.mod), p = f.path, k = f.key;
            if (base === 'carePlan' && p.length === 1) return CP_LABEL[k] || '';
            if (base === 'essay' && p.length === 1) {
                const sec = ((FORM().ESSAY || {}).SECTIONS || []).filter(function (s) {
                    return s.nameKey === k || s.fields.some(function (x) { return x.key === k; });
                })[0];
                if (!sec) return '';
                const fd = sec.fields.filter(function (x) { return x.key === k; })[0];
                return sec.title + ' — ' + (fd ? fd.head : 'name');
            }
            if (base === 'ncsbn' && p[0] === 'boxes') return NCSBN_LABEL[p[1]] || '';
            if (base === 'omega' && p.length === 1) {
                const r = (FORM().OMEGA_ROWS || []).filter(function (x) { return x.key === k; })[0];
                return r ? 'OMEGA ' + omegaRowName(r) : '';
            }
            if (base === 'headToToe' && p.length === 1 && typeof ctx.C.h2tItems === 'function') {
                const it = ctx.C.h2tItems().filter(function (x) { return x.id === k; })[0];
                return it && it.label ? 'Head-to-Toe ' + str(it.label).replace(/[:\s]+$/, '') : '';
            }
            if (base === 'meds' && p[0] === 'rows' && p.length === 3) {
                const c = (FORM().MED_COLUMNS || []).filter(function (x) { return x.key === p[2]; })[0];
                return 'Medications row ' + (Number(p[1]) + 1) + (c ? ' ' + c.title : '');
            }
            if (base === 'references' && p[0] === 'refs') return 'Reference ' + (Number(p[1]) + 1);
        } catch (e) { /* never throw */ }
        return '';
    }
    // "A", "A and B", "A, B and C", "A, B, C and 2 more"
    function joinNames(list) {
        const shown = list.slice(0, 3), more = list.length - shown.length;
        if (more > 0) return shown.join(', ') + ' and ' + more + ' more';
        return shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : shown.join('');
    }

    // ------------------------------------------------------------------
    // Consistency rules — applied to every printed string field.
    // scope: 'all' = any printed module; 'meds' = the Medications table and
    // the essay's Medications part; 'text' = Medications, the essay, the
    // care plan and NCSBN. `say(hit)` words the message for the text found;
    // `both` = a pair that must not both appear (one issue).
    // ------------------------------------------------------------------
    const DO_NOT_USE = { qd: 'daily', qod: 'every other day', iu: 'units / international units', mso4: 'morphine sulfate', mgso4: 'magnesium sulfate' };
    const RULES = [
        { code: 'rule-edl', re: /\bEDL\b/, scope: 'all', severity: 'info',
          msg: 'Use "WDL" (within defined limits) — "EDL" isn\'t a standard abbreviation.' },
        { code: 'rule-canula', re: /\bcanul(a|ar|ae)\b/i, scope: 'all', severity: 'info',
          msg: 'Spelling: "cannula" (two n\'s).' },
        { code: 'rule-hob', re: /(rais|elevat)\w*\s+(the\s+)?height of (the\s+)?bed/i, scope: 'all', severity: 'info',
          msg: 'Say "raised the head of bed (HOB)" — "height of bed" means how high the bed sits, not the head of it.' },
        { code: 'rule-qnoc', re: /\bq\.?\s?NOC\b/i, scope: 'all', severity: 'info',
          msg: 'Write it out — "nightly at bedtime" — instead of "qNOC".' },
        { code: 'rule-leading-zero', re: /(^|[\s(:=])\.\d+/, scope: 'all', severity: 'info',
          msg: 'Leading zero: write 0.72, not .72 (ISMP).',
          hit: function (m) { return m[0].slice(m[1].length); },
          say: function (h) { return 'Leading zero: write 0' + h + ', not ' + h + ' (ISMP).'; } },
        // (not a lab value the essay's Medications part watches: "Hgb 8.0 g/dL")
        { code: 'rule-trailing-zero', re: /\b\d+\.0\s?(mg|mcg|g|mL|units?)\b(?!\s*\/\s*(?:dL|L|mL)\b)/, scope: 'meds', severity: 'info',
          msg: 'Trailing zero: write 5 mg, not 5.0 mg (ISMP).',
          say: function (h) { return 'Trailing zero: write ' + h.replace('.0', '') + ', not ' + h + ' (ISMP).'; } },
        { code: 'rule-do-not-use', re: /\b(?:QD|QOD|IU|MSO4|MgSO4)\b|\bq\.(?:o\.)?d\.(?![A-Za-z])/i, scope: 'text', severity: 'info',
          msg: 'Do Not Use abbreviation (Joint Commission / ISMP) — write the word out.',
          say: function (h) {
              const k = h.toLowerCase().replace(/\./g, '');
              return '"' + h + '" is on the Do Not Use list (Joint Commission / ISMP) — write "' + (DO_NOT_USE[k] || 'the word') + '" instead.';
          } },
        { code: 'rule-nka-nkda', re: /\bNKD?A\b/, both: [/\bNKA\b/, /\bNKDA\b/], scope: 'all', severity: 'info',
          msg: 'Both "NKA" and "NKDA" appear — use one allergy term consistently.' }
    ];
    const TEXT_MODS = { meds: 1, essay: 1, carePlan: 1, ncsbn: 1 };
    function inScope(rule, f) {
        if (rule.scope === 'meds') return baseOf(f.mod) === 'meds' || (baseOf(f.mod) === 'essay' && f.key === 'data_meds');
        if (rule.scope === 'text') return !!TEXT_MODS[baseOf(f.mod)];
        return true;
    }
    function plainRe(re) { return new RegExp(re.source, re.flags.replace('g', '')); }
    function runRules(ctx) {
        const fields = printedFields(ctx);
        RULES.forEach(function (rule) {
            try {
                if (rule.both) {
                    const a = plainRe(rule.both[0]), b = plainRe(rule.both[1]);
                    const fa = fields.filter(function (f) { return inScope(rule, f) && a.test(f.text); })[0];
                    const fb = fields.filter(function (f) { return inScope(rule, f) && b.test(f.text); })[0];
                    if (fa && fb) {
                        const m = b.exec(fb.text);
                        issue(ctx, rule.severity, rule.code, rule.msg, fb.mod, fb.sel, excerptAt(fb.text, m.index, m[0].length));
                    }
                    return;
                }
                const re = plainRe(rule.re);
                const byMod = {}, order = [];
                fields.forEach(function (f) {
                    if (!inScope(rule, f)) return;
                    const m = re.exec(f.text);
                    if (!m) return;
                    if (!byMod[f.mod]) { byMod[f.mod] = { f: f, m: m, n: 0, more: [] }; order.push(f.mod); }
                    else byMod[f.mod].more.push(f);
                    byMod[f.mod].n++;
                });
                order.forEach(function (mod) {
                    const x = byMod[mod];
                    const hit = typeof rule.hit === 'function' ? rule.hit(x.m) : x.m[0];
                    let text = typeof rule.say === 'function' ? rule.say(hit) : rule.msg;
                    if (x.n > 1) {
                        // Name the other boxes so they can be found ("— also in
                        // Short-term goal and Long-term Assess intervention")
                        const names = x.more.map(function (f) { return fieldLabel(ctx, f); });
                        text = text.replace(/\.$/, '') + (names.every(Boolean) ? ' — also in ' + joinNames(names) + '.' : ' — ' + x.n + ' boxes on this tab.');
                    }
                    const at = x.m.index + (x.m[0].length - hit.length);
                    issue(ctx, rule.severity, rule.code, text, mod, x.f.sel, excerptAt(x.f.text, at, hit.length));
                });
            } catch (e) { /* never throw */ }
        });
    }

    // ------------------------------------------------------------------
    // Labs vs prose
    // ------------------------------------------------------------------
    // "No abnormal / alarming / significant …", "all labs … normal",
    // "within normal / defined limits". Each hit is judged on its own clause
    // (the sentence split at , ; but / which / while / except … and at
    // "and there / and all / and no …"):
    //   · skipped when negated ("not within normal limits", "wasn't …") or
    //     not about labs ("no significant change", "no abnormal bleeding",
    //     "vital signs within normal limits", "SpO2 levels …"). Outside the
    //     lab fields (Abnormal Lab Results, the concept map's Diagnostics)
    //     the clause must say labs / lab work / CBC / BMP … or name a
    //     lab-table row; inside them results / values / levels count too;
    //   · a clause that names labs and says nothing general ("Hgb was within
    //     normal limits") is about those labs: it contradicts the table only
    //     when one of them is flagged, and the message names those;
    //   · otherwise it is about the labs as a whole ("labs were within normal
    //     limits", "all other labs …"): the flagged labs it leaves out — not
    //     named in the sentence, or earlier in the field for "other" — count.
    // Work stays bounded: a sentence is read at most 300 characters either
    // side of the hit, and a field's first 200 hits are judged.
    const CONTRA_RE = /no (abnormal|alarming|significant)\b|all (results|labs|values|findings)[^.]{0,40}(normal|expected|WNL|WDL|unremarkable)|within (normal|defined) limits/gi;
    const CONTRA_SKIP_AFTER = /^\s+(?:changes?|changed|improvements?|improved|differences?|increases?|decreases?|distress|events?)\b/i;
    const NEGATED_RE = /(?:\bnot|n't|\bnever|\boutside(?:\s+of)?)\s+(?:[\w'-]+\s+){0,2}$/i;
    const LAB_WORDS = /\b(labs?|laboratory|lab\s*work|results?|values?|levels?|findings?|cbc|bmp|cmp|panels?|diagnostics?|blood\s*work|bloodwork|electrolytes?|chemistry)\b/i;
    const LAB_SPECIFIC = /\b(labs?|laboratory|lab\s*(?:work|values?|results?|tests?)|cbc|bmp|cmp|(?:metabolic|blood)\s+panels?|blood\s*work|bloodwork|blood\s+counts?|electrolytes?|blood\s+chemistry)\b/i;
    const BEDSIDE_RE = /\b(spo2|sp\s?o2|o2|sats?|saturations?|pulse\s*ox\w*|bp|blood\s+pressures?|hr|heart\s+rates?|pulses?|rr|resp(?:iratory|irations)?(?:\s+rates?)?|temp(?:erature)?s?|vitals?|vital\s+signs?|vs|pain|glucose|blood\s+sugars?|cbg|poc|fsbs|accu-?chek|x-?rays?|cxr|ct|mri|imaging|ultrasound|ekg|ecg|bowel\s+sounds|lung\s+sounds|breath\s+sounds|heart\s+sounds|i&o|intake|output|weights?)\b/i;
    const ALL_WORDS = /\b(all|every|any|everything)\b/i;
    const OTHER_WORDS = /\b(other|others|otherwise|rest|remaining|remainder|else)\b/i;
    const CLAUSE_RE = /[,;]|\b(?:but|which|while|whereas|although|though|however|yet|except(?: for)?|apart from|other than|besides)\b|\band\s+(?=(?:there|it|she|he|they|this|that|these|those|her|his|their|the patient|pt|no|all|other|labs?|results?|values?)\b)/gi;
    // A list item before a claim ("Hgb, Hct, and RBC were …") vs a clause
    // with its own predicate ("Hgb low, vital signs …")
    const LIST_PRED = /\b(low|high|elevated|decreased|increased|abnormal|critical|was|were|is|are|remained|stayed|showed)\b|\(\s*[HL]\s*\)/i;
    const SENT_WIN = 300, OTHER_WIN = 1500, MAX_HITS = 200;
    // The sentence (or line) around [at, end), read at most SENT_WIN chars
    // either side
    function sentenceBounds(t, at, end) {
        let s = at;
        const sMin = Math.max(0, at - SENT_WIN);
        while (s > sMin) {
            const c = t.charAt(s - 1);
            if (c === '\n' || (/[.!?]/.test(c) && /\s/.test(t.charAt(s)))) break;
            s--;
        }
        let e = end;
        const eMax = Math.min(t.length, end + SENT_WIN);
        while (e < eMax) {
            const c = t.charAt(e);
            if (c === '\n') break;
            e++;
            if (/[.!?]/.test(c) && (e >= t.length || /\s/.test(t.charAt(e)))) break;
        }
        return [s, e];
    }
    function isFlag(r) { return r.flag === 'H' || r.flag === 'L'; }
    // One CONTRA_RE hit → null (fine) or { sentence, cite, also }
    function judgeHit(t, m, labField, mentions, flags) {
        const at = m.index, end = at + m[0].length;
        const sb = sentenceBounds(t, at, end);
        const sent = t.slice(sb[0], sb[1]);
        const ma = at - sb[0], me = end - sb[0];
        if (NEGATED_RE.test(sent.slice(Math.max(0, ma - 40), ma))) return null;
        if (/^no /i.test(m[0]) && CONTRA_SKIP_AFTER.test(sent.slice(me, me + 30))) return null;
        const segs = [];
        const cre = new RegExp(CLAUSE_RE.source, 'gi');
        let c, last = 0;
        while ((c = cre.exec(sent))) {
            if (!c[0].length) { cre.lastIndex++; continue; }
            segs.push([last, c.index]);
            last = c.index + c[0].length;
        }
        segs.push([last, sent.length]);
        let i = 0;
        while (i + 1 < segs.length && segs[i + 1][0] <= ma) i++;
        let j = i;
        while (j + 1 < segs.length && segs[j][1] < me) j++;
        let clause = sent.slice(segs[i][0], segs[j][1]);
        const bedside = BEDSIDE_RE.test(clause);
        if (!bedside) {
            let k = i;
            while (k > 0) {
                const prev = sent.slice(segs[k - 1][0], segs[k - 1][1]);
                if (!prev.trim() || prev.trim().split(/\s+/).length > 3 || LIST_PRED.test(prev) || !mentions(prev).length) break;
                k--;
            }
            if (k !== i) clause = sent.slice(segs[k][0], segs[j][1]);
        }
        const specific = LAB_SPECIFIC.test(clause);
        const named = mentions(clause);
        if (bedside && !specific && !named.length) return null;
        if (!specific && !named.length && !(labField && (LAB_WORDS.test(clause) || /\b(everything|all else|otherwise)\b/i.test(clause)))) return null;
        let cite, also = false;
        if (named.length && !ALL_WORDS.test(clause) && !OTHER_WORDS.test(clause)) {
            cite = named.filter(isFlag);              // about the labs it names
        } else {
            const ex = OTHER_WORDS.test(clause) ? mentions(t.slice(Math.max(0, sb[0] - OTHER_WIN), sb[1])) : mentions(sent);
            cite = flags.filter(function (r) { return ex.indexOf(r) === -1; });
            also = ex.some(isFlag);
        }
        return cite.length ? { sentence: sent, cite: cite, also: also } : null;
    }
    function checkLabProse(ctx) {
        const flags = flagged(ctx);
        const rows = labRows(ctx);
        const C = ctx.C;
        const mentions = function (t) {
            return typeof C.labMentioned === 'function' && str(t).trim() ? rows.filter(function (r) { return C.labMentioned(t, r); }) : [];
        };
        if (flags.length) {
            printedFields(ctx).forEach(function (f) {
                const base = baseOf(f.mod);
                const prose = base === 'essay' || base === 'carePlan' || base === 'ncsbn';
                const diag = base === 'conceptMap' && f.path.length === 1 && f.key === 'diagnostics';
                if (!prose && !diag) return;
                const labField = diag || (base === 'essay' && f.key === 'data_labs');
                const re = new RegExp(CONTRA_RE.source, 'gi');
                let m, hits = 0;
                while (hits++ < MAX_HITS && (m = re.exec(f.text))) {
                    let v = null;
                    try { v = judgeHit(f.text, m, labField, mentions, flags); } catch (e) { v = null; }
                    if (!v) continue;
                    const ex = clip(v.sentence, 160);
                    issue(ctx, 'block', 'lab-contradiction', 'Your text says \'' + ex + '\' but the lab table ' + (v.also ? 'also flags ' : 'flags ') +
                        flagList(v.cite) + '.', f.mod, f.sel, ex);
                    break;
                }
            });
        }
        // Flagged labs the Abnormal Lab Results part never names
        if (ctx.printed.essay && flags.length) {
            const text = str(ctx.st('essay').data_labs);
            const left = flags.filter(function (r) { return !(text.trim() && typeof C.labMentioned === 'function' && C.labMentioned(text, r)); });
            if (left.length) {
                issue(ctx, 'info', 'lab-not-discussed', 'Not discussed in Abnormal Lab Results: ' + flagList(left) +
                    ' — the template wants the abnormal labs involved with your primary diagnosis, so discuss the relevant ones.',
                    'essay', field('data_labs'), '');
            }
        }
    }

    // ------------------------------------------------------------------
    // Citations — APA in-text citations vs the reference list
    // ------------------------------------------------------------------
    // A parenthetical (at most 400 characters, so an unclosed "(" before a
    // long text costs little) that holds a year or "n.d."
    const PAREN_RE = /\(([^()]{0,400})\)/g;
    const PAREN_YEAR_RE = /\b(?:19|20)\d{2}[a-z]?|n\.d\./;
    const NAME_CHARS = 'A-Za-z\\u00C0-\\u00FF\'\\u2019\\-';
    const CAP_CHARS = 'A-Z\\u00C0-\\u00DE';
    // The capitalised name run that ends right before a narrative "(2023)"
    const NAME_RUN_RE = new RegExp('([' + CAP_CHARS + '][' + NAME_CHARS + ']*(?:\\s+(?:(?:and|&|of|for|the|on|in)\\s+)*[' + CAP_CHARS + '][' + NAME_CHARS + ']*)*)$');
    const STARTERS = /^(?:The|In|As|According|Per|By|From|While|Although|However|Also|And|But|A|An|This|These|That|Those|Both|Then|Thus|Therefore|Furthermore|Additionally|Moreover|When|If|Since|Because|Research|Studies|Evidence)$/;
    function normKey(s) {
        let t = str(s);
        if (typeof t.normalize === 'function') t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
        return t.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    // First author surname / organisation first word ("The" skipped)
    function firstToken(a) {
        const t = str(a).replace(/\s*\[[^\]]*\]/g, '').trim().replace(/^the\s+/i, '');
        return t.split(/[\s,&]+/)[0] || '';
    }
    function wordKey(a) { return normKey(firstToken(a)); }
    function nameBefore(before) {
        let s = str(before).slice(-160).replace(/\s+$/, '');
        let etal = '';
        const em = /,?\s+et\s+al\.?$/i.exec(s);
        if (em) { etal = ' et al.'; s = s.slice(0, em.index); }
        const m = NAME_RUN_RE.exec(s);
        if (!m) return '';
        const words = m[1].split(/\s+/);
        while (words.length > 1 && (STARTERS.test(words[0]) || /^(?:and|&|of|for|the|on|in)$/i.test(words[0]))) words.shift();
        return words.join(' ') + etal;
    }
    // Years in one citation part: the first, plus any that follow it with
    // only ", " between ("Smith, 2019, 2021")
    function segYears(seg) {
        const re = /(^|[^0-9A-Za-z])((?:19|20)\d{2}[a-z]?)(?![0-9A-Za-z])|(^|[^A-Za-z.])(n\.\s?d\.)/g;
        const out = [];
        let m, prevEnd = -1;
        while ((m = re.exec(seg))) {
            const y = m[2] || m[4];
            const at = m.index + (m[2] ? m[1].length : m[3].length);
            if (out.length && !/^\s*,\s*$/.test(seg.slice(prevEnd, at))) break;
            out.push({ at: at, year: m[2] ? m[2] : 'n.d.' });
            prevEnd = at + y.length;
        }
        return out;
    }
    function cleanAuthor(a) {
        return str(a).replace(/[\s,]+$/, '')
            .replace(/^\s*(?:see also|see|e\.g\.,?|cf\.|i\.e\.,?|as cited in|adapted from)\s+/i, '').trim();
    }
    // Not an author: a clinical note before a year ("(Diagnosed in 2019)",
    // "(Hx of CHF since 2015)", "(Dx 2019)", "(Stage IV, 2019)") or a month
    // ("in March (2019)")
    const AUTHOR_LEAD_NOT = /^(?:dx|hx|sx|tx|rx|pmh|psh|ros|s\/p|stage|grade|class|type|dx'?d|diagnosed|admitted|onset|status|since|history)$/i;
    const AUTHOR_LAST_NOT = /^(?:in|since|on|from|at|by|of|during|until|till|through|before|after|around|circa|diagnosed|dx'?d|admitted|started|began|onset|dx|hx|sx|tx|rx|s\/p|pmh|psh|year|yr)$/i;
    const AUTHOR_LOWER_OK = /^(?:and|&|of|for|the|on|in|et|al\.?|van|von|der|den|de|la|le|du|da|di|del|dos|das|y)$/;
    const MONTH_RE = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter)$/i;
    function validAuthor(a) {
        if (!new RegExp('^[' + CAP_CHARS + ']').test(a) || /\d/.test(a)) return false;
        const words = a.split(/\s+/).filter(Boolean);
        if (!words.length || words.length > 12) return false;
        const bare = words.map(function (w) { return w.replace(/[.,:;]+$/, ''); });
        if (AUTHOR_LEAD_NOT.test(bare[0]) || AUTHOR_LAST_NOT.test(bare[bare.length - 1])) return false;
        if (bare.every(function (w) { return MONTH_RE.test(w); })) return false;
        return !words.some(function (w) { return /^[a-z]/.test(w) && !AUTHOR_LOWER_OK.test(w); });
    }
    // parseCitations(text) → [{ key, author, year, raw, narrative, abbr? }]
    //   (Nath, 2023) · (Smith & Jones, 2021; Lee et al., 2020) ·
    //   (Nath, 2023, p. 45) · (American Heart Association [AHA], 2022) ·
    //   Nath (2023) · Basit et al. (2023) · Nath (2021, para 2) ·
    //   (Mayo Clinic, n.d.)
    // key = first surname / organisation first word + year, lowercased
    // ('nath2023', 'american2022', 'mayond'), as refKey() builds it.
    function parseCitations(text) {
        const s = str(text);
        const out = [];
        if (!s) return out;
        const re = new RegExp(PAREN_RE.source, 'g');
        let m;
        while ((m = re.exec(s))) {
            const inner = m[0].slice(1, -1);
            if (!PAREN_YEAR_RE.test(inner)) continue;
            const before = s.slice(0, m.index);
            inner.split(';').forEach(function (seg, si) {
                const full = seg.replace(/\s+/g, ' ').trim();
                // APA 7 leaves personal communications out of the list
                if (/\bpersonal communication\b/i.test(full)) return;
                // "(Smith, 2010, as cited in Nath, 2023)": the list has Nath
                const ci = /\bas cited in\b/i.exec(full);
                const t = ci ? full.slice(ci.index + ci[0].length).trim() : full;
                const years = segYears(t);
                if (!years.length) return;
                let author = cleanAuthor(t.slice(0, years[0].at));
                let narrative = false;
                if (!author) {
                    if (si !== 0) return;
                    author = nameBefore(before);
                    narrative = true;
                }
                if (!author || !validAuthor(author)) return;
                let abbr = '';
                const am = /\[([A-Za-z][A-Za-z&]{1,9})\]/.exec(author);
                if (am) {
                    abbr = am[1];
                    author = author.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
                }
                const wk = wordKey(author);
                if (!wk) return;
                years.forEach(function (y) {
                    const c = {
                        key: wk + normKey(y.year), author: author, year: y.year,
                        raw: narrative ? author + ' (' + inner.trim() + ')' : '(' + full + ')',
                        narrative: narrative
                    };
                    if (abbr) c.abbr = abbr;
                    out.push(c);
                });
            });
        }
        return out;
    }
    // refKey("Nath, J. (2023). Applied pathophysiology…") → 'nath2023':
    // the first word of the text before the first ',' or ' (' (first author
    // surname / organisation first word) + the year from "(YYYY" or "(n.d.".
    // No year → the word alone; no text → ''.
    function refKey(ref) {
        const s = str(ref).replace(/\s+/g, ' ').trim();
        if (!s) return '';
        const cut = s.search(/,| \(/);
        const w = wordKey(cut === -1 ? s : s.slice(0, cut));
        return w ? w + refYear(s) : '';
    }
    // "American Heart Association. (2022)…" → 'aha' (for an (AHA, 2022)
    // citation that was never spelled out)
    function refInitials(ref) {
        const s = str(ref);
        const cut = s.indexOf(' (');
        return (cut === -1 ? s : s.slice(0, cut)).split(/\s+/)
            .filter(function (w) { return /^[A-Z]/.test(w) && !/^(?:And|Of|For|The|On|In)$/.test(w); })
            .map(function (w) { return w.charAt(0).toLowerCase(); }).join('');
    }
    function checkCitations(ctx) {
        const fields = printedFields(ctx).filter(function (f) { return baseOf(f.mod) !== 'references' && f.mod !== 'info'; });
        const cites = [];
        fields.forEach(function (f) {
            parseCitations(f.text).forEach(function (c) { cites.push({ c: c, f: f }); });
        });
        // Parts with no citation at all. Rubric row 7 grades references for
        // definitions, pathophysiology and intervention rationales, so those
        // count at any length; other essay parts from 60 words.
        const RUBRIC_CITED = { p_definition: 1, p_patho: 1, s_definition: 1, s_patho: 1 };
        const ROW7 = ' — rubric row 7 grades references for definitions, pathophysiology and intervention rationales.';
        if (ctx.printed.essay) {
            ((FORM().ESSAY || {}).SECTIONS || []).forEach(function (sec) {
                sec.fields.forEach(function (f) {
                    const t = str(ctx.st('essay')[f.key]);
                    const n = countWords(t);
                    if (!n || (!RUBRIC_CITED[f.key] && n < 60) || parseCitations(t).length) return;
                    issue(ctx, 'info', 'section-uncited', sec.title + ' — ' + f.head + ' has no in-text citation' +
                        (RUBRIC_CITED[f.key] ? ROW7 : ' — the template wants citations under every area that used outside sources.'),
                        'essay', field(f.key), '');
                });
            });
        }
        if (ctx.printed.carePlan) {
            // The rationales as one item ("5 care-plan rationales …")
            const st = ctx.st('carePlan'), bare = [];
            ['st', 'lt'].forEach(function (g) {
                CP_SLOTS.forEach(function (s) {
                    const key = g + '_' + s[0] + '_rationale';
                    const t = str(st[key]);
                    if (countWords(t) && !parseCitations(t).length) bare.push({ key: key, name: (g === 'st' ? 'Short-term ' : 'Long-term ') + s[1] });
                });
            });
            if (bare.length) {
                issue(ctx, 'info', 'section-uncited', (bare.length === 1 ? bare[0].name + ' rationale has' : bare.length + ' care-plan rationales have') +
                    ' no in-text citation' + (bare.length > 1 ? ' (' + joinNames(bare.map(function (b) { return b.name; })) + ')' : '') +
                    ' — instructions: every intervention needs a scientific rationale, and' + ROW7.replace(/^ — /, ' '),
                    'carePlan', field(bare[0].key), '');
            }
        }
        if (!ctx.printed.references) return;
        const refs = refItems(ctx.st('references')).map(function (r) {
            return { i: r.i, text: r.text, key: refKey(r.text), year: refYear(r.text), initials: refInitials(r.text) };
        });
        const keys = {};
        refs.forEach(function (r) { if (r.key && r.year) keys[r.key] = true; });
        const alias = {};
        cites.forEach(function (x) { if (x.c.abbr) alias[normKey(x.c.abbr)] = wordKey(x.c.author); });
        function resolve(c) {
            if (keys[c.key]) return c.key;
            const w = wordKey(c.author), y = normKey(c.year);
            if (alias[w] && keys[alias[w] + y]) return alias[w] + y;
            if (/^[A-Z]{2,8}$/.test(firstToken(c.author))) {
                const r = refs.filter(function (x) { return x.year === y && x.initials && x.initials.indexOf(w) === 0; })[0];
                if (r) return r.key;
            }
            return '';
        }
        const cited = {}, warned = {};
        cites.forEach(function (x) {
            const k = resolve(x.c);
            if (k) { cited[k] = true; return; }
            // "COPD (2019)" — an acronym before a year, not an author
            if (x.c.narrative && /^[A-Z]{2,8}$/.test(firstToken(x.c.author))) return;
            if (warned[x.c.key]) return;
            warned[x.c.key] = true;
            issue(ctx, 'warn', 'cite-no-ref', 'In-text citation ' + x.c.raw + ' has no matching entry in References (first author and year must match).',
                x.f.mod, x.f.sel, x.c.raw);
        });
        // Citations in tabs that don't print (the NUR311 PDF leaves the
        // concept map out): a reference cited only there reads as "never
        // cited" in the PDF, so the message says where it is cited
        const elsewhere = {};
        let pending = 0;
        refs.forEach(function (r) { if (r.year && r.key && !cited[r.key]) pending++; });
        if (pending) {
            unprintedFields(ctx).forEach(function (f) {
                if (baseOf(f.mod) === 'references' || f.mod === 'info') return;
                parseCitations(f.text).forEach(function (c) {
                    const k = resolve(c);
                    if (k && !elsewhere[k]) elsewhere[k] = f.mod;
                });
            });
        }
        const essayEmpty = !ctx.printed.essay || !(((FORM().ESSAY || {}).KEYS) || []).some(function (k) { return str(ctx.st('essay')[k]).trim(); });
        const course = (ctx.profile && (ctx.profile.code || ctx.profile.label)) || '';
        refs.forEach(function (r) {
            if (!r.year || !r.key || cited[r.key]) return;
            const head = 'Reference ' + (r.i + 1) + ' (' + shortRef(r.text) + ')';
            let text;
            if (elsewhere[r.key]) {
                const mod = elsewhere[r.key];
                text = head + ' isn\'t cited in anything that prints — your ' + modName(mod) + ' tab cites it, but that tab ' +
                    (modeOf(ctx, mod) === 'na' ? 'is marked N/A' : 'is left out of the ' + (course ? course + ' ' : '') + 'PDF') +
                    '. Cite it where you used it' + (ctx.printed.essay ? ' in the essay' : '') + '.';
            } else if (ctx.printed.essay && essayEmpty) {
                text = head + ' isn\'t cited yet — cite it in the essay where you used it.';
            } else {
                text = head + ' is never cited in the text — cite it where you used it, or take it out.';
            }
            issue(ctx, 'warn', 'ref-not-cited', text, 'references', attr('data-ref', r.i), clip(r.text, 80));
        });
    }

    // ------------------------------------------------------------------
    // De-identification
    // ------------------------------------------------------------------
    const ROOM_RE = /\b(room|rm)\s*#?\s*\d{3,}/i;
    function checkDeid(ctx) {
        const who = ctx.person;
        const ini = str(ctx.info.res_initials || ctx.meta.residentInitials).trim();
        const room = str(ctx.info.res_room).trim();
        if (ini) {
            const roomish = /\d/.test(ini) || (room && (ini.toLowerCase() === room.toLowerCase() ||
                (room.length >= 3 && ini.toLowerCase().indexOf(room.toLowerCase()) !== -1)));
            // Length without dots and spaces: "J. D." is two initials
            if (roomish || ini.replace(/[\s.]/g, '').length > 4) {
                issue(ctx, 'block', 'deid-initials', roomish
                    ? cap1(who) + ' initials look like a room number (' + clip(ini, 20) + '). Use the ' + who + '\'s initials or a program-approved code.'
                    : cap1(who) + ' initials "' + clip(ini, 20) + '" are longer than initials. Use the ' + who + '\'s initials or a program-approved code.',
                    'info', field('res_initials'), ini);
            }
        }
        // A room number in the printed text (3-digit rooms only with "room" /
        // "rm" in front: a bare 3-digit number is too often a value)
        const literal = room.length >= 3 && (/[A-Za-z]/.test(room) || room.replace(/\D/g, '').length >= 4)
            ? new RegExp('(^|[^A-Za-z0-9])' + escRe(room) + '(?![A-Za-z0-9])', 'i') : null;
        printedFields(ctx).forEach(function (f) {
            if (f.mod === 'info') return;
            let m = ROOM_RE.exec(f.text), at = 0, len = 0;
            if (m) { at = m.index; len = m[0].length; }
            else if (literal && (m = literal.exec(f.text))) { at = m.index + m[1].length; len = m[0].length - m[1].length; }
            if (!m) return;
            issue(ctx, 'warn', 'deid-room', 'A room number appears in the text — leave room numbers out (de-identification).',
                f.mod, f.sel, excerptAt(f.text, at, len));
        });
    }

    // ------------------------------------------------------------------
    // checkPacket
    // ------------------------------------------------------------------
    function checkPacket(packet, profile, opts) {
        let ctx;
        try { ctx = makeCtx(packet, profile, opts); }
        catch (e) {
            return { rows: [], issues: [], blanks: [], summary: { complete: 0, partial: 0, missing: 0, na: 0, blocking: 0 } };
        }
        try { checkDeid(ctx); } catch (e) { /* never throw */ }
        const rubric = ctx.profile && Array.isArray(ctx.profile.rubric) ? ctx.profile.rubric.filter(isObj) : [];
        const rows = rubric.map(function (r) {
            const notes = [];
            let status;
            try {
                status = own(ROW_FNS, r.id) ? ROW_FNS[r.id](ctx, notes) : null;
                if (!status) { status = 'partial'; notes.push(note('Not checked automatically — review this part yourself.', '', '')); }
            } catch (e) {
                status = 'partial';
                notes.push(note('Could not check this part automatically — review it yourself.', '', ''));
            }
            return { id: r.id, n: r.n, label: r.label, points: r.points, status: status, notes: notes };
        });
        [checkLabProse, checkCitations, runRules].forEach(function (fn) {
            try { fn(ctx); } catch (e) { /* never throw */ }
        });
        // N/A with no reason (once per module)
        try {
            Object.keys(ctx.naBlocks).forEach(function (mod) {
                if (ctx.naBlocks[mod]) return;
                issue(ctx, 'warn', 'na-no-reason', modName(mod) + ' is marked N/A without a reason — add the reason in Modules so the grader knows why.', mod, '', '');
            });
        } catch (e) { /* never throw */ }
        const issues = ctx.issues.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
            return (SEVERITY_ORDER[a.x.severity] - SEVERITY_ORDER[b.x.severity]) || (a.i - b.i);
        }).map(function (o) { return o.x; });
        const summary = { complete: 0, partial: 0, missing: 0, na: 0, blocking: 0 };
        rows.forEach(function (r) { if (own(summary, r.status)) summary[r.status]++; });
        summary.blocking = summary.missing + issues.filter(function (x) { return x.severity === 'block'; }).length;
        return { rows: rows, issues: issues, blanks: ctx.blanks, summary: summary };
    }

    window.CAP_CHECK = {
        checkPacket: checkPacket,
        RULES: RULES,
        parseCitations: parseCitations,
        refKey: refKey,
        LABEL: LABEL,
        VERSION: VERSION
    };
})();
