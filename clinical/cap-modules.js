/* BendBSN — Clinical Assessment Packet — Module catalog + presets
   ------------------------------------------------------------------
   Shared between /clinical/ (index, picks initial enabledModules from
   a preset) and /clinical/packet/ (editor, renders tabs + drawer from
   the catalog). Also loaded before cap-renderers.js / cap-pdf.js, so the
   form wording both of them print lives here (FORM), once.

   To add a new module: append to MODULE_CATALOG. The editor's render
   functions look up by id; module renderers ship in subsequent
   commits as the per-module code is filled in.

   `alwaysOn: true` means the toggle in the drawer is locked enabled
   (Info, Notes — every packet should keep these).

   `base: '<id>'` makes a second instance of an existing module (e.g. the
   Day 2 Head-to-Toe). It keeps its own data key (packet.state[id]) but
   renders with CAP_RENDERERS[base] / R_PDF[base], which receive a 4th
   `ctx` argument ({ moduleId, title, day, hint }) for the heading.

   `tabLabel` — shorter text for the editor's tab bar (label is used
   everywhere else). `printBlank: true` — the PDF prints the module's full
   blank form instead of a one-line "(left blank)" stub, for grids an
   instructor grades cell by cell. `pdfOrientation: 'landscape'` — the PDF
   starts the module on a landscape page (R_PDF[id].orientation works too).

   Schema history (packet.meta.schemaVersion is stamped at creation):
     1 — original modules
     2 — screening modules
     3 — CAP Forms 6/24 alignment: NCSBN moves from state.steps[0..5]
         (6 boxes) to state.boxes{s1,s2,s3a,s3b,s45,s6a,s6b} (the Word
         form's 7 rows). Old data is migrated at read time by
         readNcsbn(); the slice is only written in the new shape (with
         state._schema = 3) once the student edits it. state.steps is
         never deleted.
     4 — Scored tools as dated columns, like the Word form:
         braden: state.choices/date/evaluator (one assessment) →
           state.cols{a1..a4:{date, evaluator, choices}}   (readBraden)
         morse:  state.choices/admit_date/review1/review2/signature →
           state.cols{admit,review1,review2:{date, signature, choices}}
           (readMorse)
         Both stamp state._schema = 4 on the first edit; the old keys are
         never deleted, so an old packet reads the same until it is edited.
         Additive (no migration needed): minicog.words{ocean,desk,tractor}
         (state.recall is kept in sync with the ticked words; a legacy
         recall number with no words stays editable, and is stashed in
         minicog.recallLegacy on the first tick so unticking every word
         restores it), hendrich.notes{id}
         (findings column), labs.rows{id}/labs.extra[] (TABLE 3; any stage-1
         labs._sandboxText stays visible as "Previous notes").
     5 — Head-to-Toe follows the Word form (FORM.H2T): structured items
         under their own keys (gen_loc, head_eyes_chk, abd_luq, …) plus the
         body diagram (skin_markers[]). The 9 old free-text systems
         (neuro, heent, cardio, resp, gi, gu, msk, skin, psych) are never
         moved or deleted: readHeadToToe() lists each non-empty one as
         "Previous notes" in the matching region, where the editor shows it
         (bound to its old key) and the PDF prints it. state._schema = 5 is
         stamped on the first H2T edit. Same for headToToe2.
     6 — Nursing Concept Map follows the Word form's boxes (FORM.CONCEPT_MAP):
         flat text keys riskFactors, diagnosis, pmh, hpi, patho,
         signsSymptoms, diagnostics, secondaryDx, secondaryInterventions,
         medications, nursingInterventions, plus nursingDx[] (one string per
         nursing diagnosis). The old problem list (state.problems[{name, data,
         dx, goals, interventions, evaluation}]) stays under its own key as the
         optional "Care plan detail" block; the old state.center summary stays
         too and shows as "Previous notes" in the central Diagnosis box.
         readConceptMap() migrates at read time: each old problem's diagnosis
         → nursingDx, its interventions → nursingInterventions. The editor
         writes the new keys (and state._schema = 6) on the first edit only.
*/
(function () {
    'use strict';
    if (window.CAP_MODULES) return;

    const SCHEMA_VERSION = 6;
    // Revision of the program's Word form this packet mirrors.
    const FORM_VERSION = '6/24';
    const FORM_NAME = 'Clinical Assessment Packet Forms';

    // Categories control grouping in the toggle drawer.
    const CATEGORY_ORDER = [
        'Always-on',
        'Default',
        'Scales',
        'Screenings',
        'Memory care / AL',
        'Acute care',
        'Academic'
    ];

    const MODULE_CATALOG = [
        { id: 'info',          label: 'Patient Info',                 category: 'Always-on',       alwaysOn: true,  icon: '👤' },
        { id: 'notes',         label: 'General Notes',                category: 'Always-on',       alwaysOn: true,  icon: '📝' },

        // Default = the program form's core sections, in Word order.
        // The concept map is the Word form's first page (landscape in the PDF).
        { id: 'conceptMap',    label: 'Nursing Concept Map',          category: 'Default',          printBlank: true, icon: '🗺️' },
        { id: 'headToToe',     label: 'Head-to-Toe Assessment',       category: 'Default',          printBlank: true, icon: '👁' },
        { id: 'omega',         label: 'OMEGA-7',                      category: 'Default',          printBlank: true, icon: 'Ω' },
        { id: 'headToToe2',    label: 'Head-to-Toe Assessment — Day 2 (Disregard for Five-Week Courses)',
                               tabLabel: 'Head-to-Toe — Day 2',       category: 'Default',          base: 'headToToe', day: 2, printBlank: true, icon: '👁' },
        { id: 'omega2',        label: 'OMEGA — Day 2',                category: 'Default',          base: 'omega', day: 2, printBlank: true, icon: 'Ω' },
        { id: 'labs',          label: 'Lab Values',                   category: 'Default',          printBlank: true, icon: '🧪' },
        { id: 'meds',          label: 'Medications',                  category: 'Default',          printBlank: true, icon: '💊' },
        { id: 'ncsbn',         label: 'Clinical Judgment (NCSBN)',    category: 'Default',          printBlank: true, icon: '⚖️' },
        { id: 'sbar',          label: 'SBAR Report',                  category: 'Default',                          icon: '📞' },
        { id: 'progressNotes', label: 'Progress Notes',               category: 'Default',                          icon: '✏️' },
        { id: 'carePlan',      label: 'Care Plan',                    category: 'Default',                          icon: '🗂️' },

        { id: 'morse',         label: 'Morse Fall Scale',             category: 'Scales',           printBlank: true, icon: '⚠️' },
        { id: 'braden',        label: 'Braden Scale',                 category: 'Scales',           printBlank: true, icon: '🛌' },
        { id: 'hendrich',      label: 'Hendrich II Fall Model',       category: 'Scales',           printBlank: true, icon: '🚶' },

        // ---- Validated screening tools (from RN Notes / app) ----
        { id: 'phq9',          label: 'PHQ-9 (Depression)',           category: 'Screenings',                       icon: '💭' },
        { id: 'gad7',          label: 'GAD-7 (Anxiety)',              category: 'Screenings',                       icon: '😰' },
        { id: 'cssrs',         label: 'C-SSRS (Suicide Risk)',        category: 'Screenings',                       icon: '🚨' },
        { id: 'cage',          label: 'CAGE (Alcohol)',               category: 'Screenings',                       icon: '🍷' },
        { id: 'cam',           label: 'CAM (Confusion / Delirium)',   category: 'Screenings',                       icon: '🌀' },

        { id: 'minicog',       label: 'Mini-Cog',                     category: 'Memory care / AL', printBlank: true, icon: '🧠' },
        { id: 'behavior',      label: 'Behavior (ABC)',               category: 'Memory care / AL',                 icon: '🎭' },

        { id: 'caseStudy',     label: 'Case Study',                   category: 'Academic',                         icon: '🎓' },
        { id: 'references',    label: 'APA References',               category: 'Academic',                         icon: '📚' }
    ];

    // Preset templates — picked at packet creation time. Always include
    // the always-on modules (info + notes); the rest is per-template.
    // 'program-cap' reproduces the Word form, in its order.
    const MODULE_PRESETS = {
        'program-cap': [
            'info', 'conceptMap', 'headToToe', 'omega', 'headToToe2', 'omega2',
            'labs', 'meds', 'morse', 'hendrich', 'braden', 'minicog', 'ncsbn', 'notes'
        ],
        'memory-care-default': [
            'info', 'omega', 'meds', 'morse', 'braden',
            'minicog', 'behavior', 'cam', 'ncsbn', 'sbar',
            'progressNotes', 'notes', 'carePlan'
        ],
        'acute-care-default': [
            'info', 'meds', 'morse', 'braden', 'headToToe',
            'phq9', 'cam', 'ncsbn', 'sbar',
            'progressNotes', 'notes', 'carePlan'
        ],
        'peds-default': [
            'info', 'meds', 'morse', 'headToToe',
            'ncsbn', 'sbar', 'progressNotes', 'notes', 'carePlan'
        ],
        'mental-health-default': [
            'info', 'meds', 'phq9', 'gad7', 'cssrs', 'cage',
            'ncsbn', 'sbar', 'progressNotes', 'notes', 'carePlan'
        ],
        'custom': ['info', 'meds', 'notes']
    };

    // Section order of the turned-in PDF (and of the editor's tabs): the Word
    // form's order first, then everything the Word form doesn't have.
    const PDF_ORDER = [
        'info', 'conceptMap', 'headToToe', 'omega', 'headToToe2', 'omega2',
        'labs', 'meds', 'morse', 'hendrich', 'braden', 'minicog', 'ncsbn',
        // extras (not on the Word form)
        'sbar', 'progressNotes', 'carePlan',
        'phq9', 'gad7', 'cssrs', 'cage', 'cam', 'behavior',
        'caseStudy', 'references', 'notes'
    ];

    // Convenience lookups
    const MODULE_BY_ID = MODULE_CATALOG.reduce(function (acc, m) { acc[m.id] = m; return acc; }, {});

    function modulesByCategory() {
        const out = {};
        CATEGORY_ORDER.forEach(function (c) { out[c] = []; });
        MODULE_CATALOG.forEach(function (m) {
            if (!out[m.category]) out[m.category] = [];
            out[m.category].push(m);
        });
        return out;
    }

    // Stable sort of module ids into PDF_ORDER. Unknown ids keep their
    // relative order after the known ones. Duplicates are dropped.
    function orderModules(ids) {
        const seen = {};
        const list = [];
        (Array.isArray(ids) ? ids : []).forEach(function (id) {
            if (typeof id !== 'string' || seen[id]) return;
            seen[id] = true;
            list.push(id);
        });
        return list.map(function (id, i) {
            const k = PDF_ORDER.indexOf(id);
            return { id: id, k: k === -1 ? PDF_ORDER.length : k, i: i };
        }).sort(function (a, b) { return a.k - b.k || a.i - b.i; })
          .map(function (x) { return x.id; });
    }

    // "patient" everywhere, as on the Word form; "resident" only for packets
    // started from the memory-care preset. Packets made before schema 3 never
    // recorded their preset (templateId null) and always said "resident", so
    // an old one with a memory-care-only module (behavior, minicog) keeps it.
    function personWord(meta) {
        if (!meta) return 'patient';
        if (meta.templateId === 'memory-care-default') return 'resident';
        if (!meta.templateId && !((Number(meta.schemaVersion) || 0) >= 3)) {
            const en = Array.isArray(meta.enabledModules) ? meta.enabledModules
                : (meta.enabledModules && typeof meta.enabledModules === 'object' ? Object.keys(meta.enabledModules).map(function (k) { return meta.enabledModules[k]; }) : []);
            if (en.indexOf('behavior') !== -1 || en.indexOf('minicog') !== -1) return 'resident';
        }
        return 'patient';
    }

    // ------------------------------------------------------------------
    // FORM — wording of the program's Word form, shared by the editor and
    // the PDF so the two can't drift apart.
    // ------------------------------------------------------------------
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

    // TABLE 4. `title` + `caption` exactly as printed on the Word form.
    const MED_COLUMNS = [
        { key:'order',        title:'Physician\'s Order',   caption:'Trade & Generic Name' },
        { key:'time',         title:'Time Admin',           caption:'' },
        { key:'class',        title:'Drug Classification',  caption:'Therapeutic & Pharmacologic' },
        { key:'indication',   title:'Indication',           caption:'Pt Problem/ Reason Pt Taking' },
        { key:'sideEffects',  title:'Major Side Effects',   caption:'' },
        { key:'implications', title:'Nursing Implications', caption:'Specific to your patient: drug parameters, to monitor, Labs, CBG, what to watch for, etc.' }
    ];

    // TABLE 6 — one entry per Word row, in order. `num` is the badge in the
    // editor. The Word form labels row 6 "Step 5: Evaluate outcomes"; Evaluate
    // Outcomes is Step 6 (Step 5, Take Action, is combined into row 5).
    const NCSBN_ROWS = [
        { key:'s1',  num:'1',   step:'Step 1: Recognize Cues',
          prompt:'What data are RELEVANT and must be interpreted as clinically significant by the nurse?' },
        { key:'s2',  num:'2',   step:'Step 2: Analyze Cues',
          prompt:'Interpreting relevant clinical data, identify the most likely problem(s). Is additional data needed to confirm the significance of clinical cues collected so far?' },
        { key:'s3a', num:'3',   step:'Step 3: Prioritize hypotheses',
          prompt:'Rank the most likely problems by urgency.' },
        { key:'s3b', num:'3',   step:'Step 3: Prioritize hypotheses',
          prompt:'Which problem is most likely present? What problem is most concerning? Why?' },
        { key:'s45', num:'4–5', step:'Step 4: Generate solutions and Step 5: Take action',
          prompt:'Based on the most pressing problem, what are the priority actions?' },
        { key:'s6a', num:'6',   step:'Step 6: Evaluate outcomes',
          prompt:'Evaluate the patient\'s response. Recognizing relevant clinical data, has the patient status improved, declined, or remained unchanged?' },
        { key:'s6b', num:'6',   step:'Step 6: Evaluate outcomes',
          prompt:'If the patient status has not improved, what problem may be present? What additional interventions need to be considered?' }
    ];

    // TABLE 3 — lab groups and analytes, in Word order and wording. `id` is
    // the stored key (state.rows[id]); never rename one.
    const LAB_COLUMNS = [
        { key:'normal', title:'Normal Values' },
        { key:'date',   title:'Test (Date)' },
        { key:'result', title:'Patient Result' },
        { key:'interp', title:'Interpretation' }
    ];
    const LAB_GROUPS = [
        { group:'Chemistry', rows:[
            { id:'na',          label:'NA+ (Sodium)' },
            { id:'k',           label:'K+ (Potassium)' },
            { id:'cl',          label:'Cl- (Chloride)' },
            { id:'co2',         label:'CO2' },
            { id:'bun',         label:'BUN' },
            { id:'creatinine',  label:'Creatinine' },
            { id:'cholesterol', label:'Cholesterol' },
            { id:'albumin',     label:'Albumin' }
        ] },
        { group:'Hematology', rows:[
            { id:'rbc', label:'RBC' },
            { id:'wbc', label:'WBC' },
            { id:'hct', label:'HCT' },
            { id:'hgb', label:'HgB' }
        ] },
        { group:'Coagulation', rows:[
            { id:'pt',  label:'PT' },
            { id:'ptt', label:'PTT' },
            { id:'inr', label:'INR' }
        ] },
        // Student-added rows (state.extra[]) print after these, under Other.
        { group:'Other', rows:[
            { id:'tsh', label:'TSH' },
            { id:'alt', label:'ALT/SGPT' },
            { id:'ast', label:'AST/SGOT' }
        ] }
    ];

    // TABLE 5 — Braden Scale (Briggs form 3166P), descriptors verbatim.
    // Option titles are printed in capitals, as on the form.
    const BRADEN = {
        TITLE: 'Braden Scale — For Predicting Pressure Sore Risk',
        LEGEND: 'SEVERE RISK: Total score ≤9 · HIGH RISK: 10–12 · MODERATE RISK: 13–14 · MILD RISK: 15–18',
        HIGH_RISK: 'Total score of 12 or less represents HIGH RISK',
        FOOTNOTES: ['¹NPO: Nothing by mouth.', '²IV: Intravenously.', '³TPN: Total parenteral nutrition.'],
        COPYRIGHT: 'Source: Barbara Braden and Nancy Bergstrom. Copyright, 1988. Reprinted with permission. Permission should be sought to use this tool at www.bradenscale.com',
        EVALUATOR: 'Evaluator signature/title',
        COLS: [
            { key:'a1', num:'1' }, { key:'a2', num:'2' }, { key:'a3', num:'3' }, { key:'a4', num:'4' }
        ],
        FACTORS: [
            { id:'sensory', name:'Sensory Perception', defn:'Ability to respond meaningfully to pressure-related discomfort',
              opts:[
                { val:1, title:'COMPLETELY LIMITED', desc:'Unresponsive (does not moan, flinch, or grasp) to painful stimuli, due to diminished level of consciousness or sedation, OR limited ability to feel pain over most of body surface.' },
                { val:2, title:'VERY LIMITED', desc:'Responds only to painful stimuli. Cannot communicate discomfort except by moaning or restlessness, OR has a sensory impairment which limits the ability to feel pain or discomfort over ½ of body.' },
                { val:3, title:'SLIGHTLY LIMITED', desc:'Responds to verbal commands but cannot always communicate discomfort or need to be turned, OR has some sensory impairment which limits ability to feel pain or discomfort in 1 or 2 extremities.' },
                { val:4, title:'NO IMPAIRMENT', desc:'Responds to verbal commands. Has no sensory deficit which would limit ability to feel or voice pain or discomfort.' }
              ] },
            { id:'moisture', name:'Moisture', defn:'Degree to which skin is exposed to moisture',
              opts:[
                { val:1, title:'CONSTANTLY MOIST', desc:'Skin is kept moist almost constantly by perspiration, urine, etc. Dampness is detected every time patient is moved or turned.' },
                { val:2, title:'OFTEN MOIST', desc:'Skin is often but not always moist. Linen must be changed at least once a shift.' },
                { val:3, title:'OCCASIONALLY MOIST', desc:'Skin is occasionally moist, requiring an extra linen change approximately once a day.' },
                { val:4, title:'RARELY MOIST', desc:'Skin is usually dry; linen only requires changing at routine intervals.' }
              ] },
            { id:'activity', name:'Activity', defn:'Degree of physical activity',
              opts:[
                { val:1, title:'BEDFAST', desc:'Confined to bed.' },
                { val:2, title:'CHAIRFAST', desc:'Ability to walk severely limited or nonexistent. Cannot bear own weight and/or must be assisted into chair or wheelchair.' },
                { val:3, title:'WALKS OCCASIONALLY', desc:'Walks occasionally during day, but for very short distances, with or without assistance. Spends majority of each shift in bed or chair.' },
                { val:4, title:'WALKS FREQUENTLY', desc:'Walks outside the room at least twice a day and inside room at least once every 2 hours during waking hours.' }
              ] },
            { id:'mobility', name:'Mobility', defn:'Ability to change and control body position',
              opts:[
                { val:1, title:'COMPLETELY IMMOBILE', desc:'Does not make even slight changes in body or extremity position without assistance.' },
                { val:2, title:'VERY LIMITED', desc:'Makes occasional slight changes in body or extremity position but unable to make frequent or significant changes independently.' },
                { val:3, title:'SLIGHTLY LIMITED', desc:'Makes frequent though slight changes in body or extremity position independently.' },
                { val:4, title:'NO LIMITATIONS', desc:'Makes major and frequent changes in position without assistance.' }
              ] },
            { id:'nutrition', name:'Nutrition', defn:'Usual food intake pattern', footnotes:true,
              opts:[
                { val:1, title:'VERY POOR', desc:'Never eats a complete meal. Rarely eats more than 1/3 of any food offered. Eats 2 servings or less of protein (meat or dairy products) per day. Takes fluids poorly. Does not take a liquid dietary supplement, OR is NPO¹ and/or maintained on clear liquids or IV² for more than 5 days.' },
                { val:2, title:'PROBABLY INADEQUATE', desc:'Rarely eats a complete meal and generally eats only about ½ of any food offered. Protein intake includes only 3 servings of meat or dairy products per day. Occasionally will take a dietary supplement OR receives less than optimum amount of liquid diet or tube feeding.' },
                { val:3, title:'ADEQUATE', desc:'Eats over half of most meals. Eats a total of 4 servings of protein (meat, dairy products) each day. Occasionally refuses a meal, but will usually take a supplement if offered, OR is on a tube feeding or TPN³ regimen, which probably meets most of nutritional needs.' },
                { val:4, title:'EXCELLENT', desc:'Eats most of every meal. Never refuses a meal. Usually eats a total of 4 or more servings of meat and dairy products. Occasionally eats between meals. Does not require supplementation.' }
              ] },
            // The form gives Friction and Shear no definition line.
            { id:'friction', name:'Friction and Shear', defn:'',
              opts:[
                { val:1, title:'PROBLEM', desc:'Requires moderate to maximum assistance in moving. Complete lifting without sliding against sheets is impossible. Frequently slides down in bed or chair, requiring frequent repositioning with maximum assistance. Spasticity, contractures, or agitation leads to almost constant friction.' },
                { val:2, title:'POTENTIAL PROBLEM', desc:'Moves feebly or requires minimum assistance. During a move, skin probably slides to some extent against sheets, chair, restraints, or other devices. Maintains relatively good position in chair or bed most of the time but occasionally slides down.' },
                { val:3, title:'NO APPARENT PROBLEM', desc:'Moves in bed and in chair independently and has sufficient muscle strength to lift up completely during move. Maintains good position in bed or chair at all times.' }
              ] }
        ]
    };

    // Morse Fall Scale (image3.jpeg), wording as printed.
    const MORSE = {
        TITLE: 'Morse Fall Scale',
        INTRO: 'Fall Risk is based upon Fall Risk Factors and it is more than a Total Score. Determine Fall Risk Factors and Target Interventions to Reduce Risks. Complete on admission, at change of condition, transfer to a new unit, and after a fall.',
        HOWTO: 'To obtain the Morse Fall Score add the score from each category.',
        SIGNATURE: 'Signature & Status',
        // The form heads both review columns "Review Date"; numbered here.
        // `stacked` = the form prints the variable's options in one row.
        COLS: [
            { key:'admit',   label:'Admission Date', short:'Admission' },
            { key:'review1', label:'Review Date 1',  short:'Review 1' },
            { key:'review2', label:'Review Date 2',  short:'Review 2' }
        ],
        VARS: [
            { id:'history',      name:'History of Falling',  stacked:true, opts:[ { val:0,  label:'No' }, { val:25, label:'Yes' } ] },
            { id:'secondary_dx', name:'Secondary Diagnosis', stacked:true, opts:[ { val:0,  label:'No' }, { val:15, label:'Yes' } ] },
            { id:'ambulatory',   name:'Ambulatory Aid',      opts:[ { val:0,  label:'None/bedrest/nurse assist' }, { val:15, label:'Crutches/cane/walker' }, { val:30, label:'Furniture' } ] },
            { id:'iv',           name:'IV or IV access',     stacked:true, opts:[ { val:0,  label:'No' }, { val:20, label:'Yes' } ] },
            { id:'gait',         name:'Gait',                opts:[ { val:0,  label:'Normal/bedrest/wheelchair' }, { val:10, label:'Weak' }, { val:20, label:'Impaired' } ] },
            { id:'mental',       name:'Mental Status',       opts:[ { val:0,  label:'Knows own limits' }, { val:15, label:'Overestimates or forgets limits' } ] }
        ],
        BANDS: [
            { label:'High Risk',     range:'45 and higher' },
            { label:'Moderate Risk', range:'25-44' },
            { label:'Low Risk',      range:'0-24' }
        ]
    };

    // Hendrich II Fall Risk Model + Get Up & Go Test (image3.jpeg)
    const HENDRICH = {
        TITLE: 'Hendrich II Fall Risk Model™',
        FACTORS: [
            { id:'confusion',      label:'Confusion / Disorientation / Impulsivity', pts:4 },
            { id:'depression',     label:'Symptomatic Depression',                   pts:2 },
            { id:'elimination',    label:'Altered Elimination',                      pts:1 },
            { id:'dizziness',      label:'Dizziness / Vertigo',                      pts:1 },
            { id:'male',           label:'Male Gender',                              pts:1 },
            { id:'antiepileptics', label:'Any Administered Antiepileptics',          pts:2 },
            { id:'benzos',         label:'Any Administered Benzodiazepines',         pts:1 }
        ],
        GUG_TITLE: 'Get Up & Go Test',
        GUG: [
            { val:0, label:'Able to rise in a single movement – No loss of balance with steps' },
            { val:1, label:'Pushes up, successful in one attempt' },
            { val:3, label:'Multiple attempts, but successful' },
            { val:4, label:'Unable to rise without assistance during test',
              qualifier:'(OR if a medical order states the same and/or complete bedrest is ordered)',
              note:'* If unable to assess, document this on the patient chart with the date and time' }
        ],
        HIGH: 'A Score of 5 or Greater = High Risk'
    };

    // Mini-Cog — "Patient Cognitive Assessment Form" (image5.jpeg)
    const MINICOG = {
        TITLE: 'Mini-Cog — Patient Cognitive Assessment Form',
        WORDS: [ { key:'ocean', label:'Ocean' }, { key:'desk', label:'Desk' }, { key:'tractor', label:'Tractor' } ],
        STEPS: [
            'Ask the patient to listen carefully to and remember following 3 words and then to repeat the words back to you: Ocean Desk Tractor',
            'Instruct the patient to draw the face of a clock, including the numbers and hands pointing to 8:20. These instructions can be repeated, but no additional instructions should be given. If the patient cannot complete the clock drawing test in ≤3 min, move on to the next step.',
            'Ask the patient to repeat the 3 previously presented words.'
        ],
        SCORE_WORDS: 'Circle the words remembered above. One point for each word remembered.',
        RECALL_LABEL: 'WORD RECALL SCORE (minimum 0, maximum 3)',
        SCORE_CLOCK: 'The clock drawing test is considered normal if all numbers are depicted, once each, in the correct sequence and position, and the hands readably display the requested time. Give 2 points for a normal clock drawing test, and 0 points for an abnormal clock drawing test.',
        CLOCK_LABEL: 'CLOCK DRAWING SCORE (Normal 2, abnormal 0)',
        TOTAL_LABEL: 'TOTAL SCORE (0–2 indicates positive screen for dementia, 3–5 negative screen)'
    };

    // ------------------------------------------------------------------
    // Nursing Concept Map — the Word form's page 1. BOXES are listed in the
    // form's text order; the editor renders them row by row (by `row`, then
    // `col`) so focus order matches the map. `row` / `col` place each box on the Word page's 3 x 3 map, with Diagnosis /
    // PMH / HPI in the centre. Each field's `key` is its stored key in the
    // module's state slice; `multi` = a list of entries (state.nursingDx[]).
    // Labels exactly as printed. CONNECT = the map's connectors
    // [from, to, arrow?] between box ids (drawn in the editor and the PDF).
    // ------------------------------------------------------------------
    const CONCEPT_MAP = {
        TITLE: 'Nursing Concept Map',
        BOXES: [
            { id: 'risk',  row: 2, col: 1, fields: [ { key: 'riskFactors', label: 'Risk Factors:' } ] },
            { id: 'dx',    row: 2, col: 2, center: true, fields: [
                { key: 'diagnosis', label: 'Diagnosis:' },
                { key: 'pmh',       label: 'PMH:' },
                { key: 'hpi',       label: 'HPI:' } ] },
            { id: 'patho', row: 1, col: 1, fields: [ { key: 'patho', label: 'Pathophysiology:' } ] },
            { id: 'ss',    row: 1, col: 2, fields: [ { key: 'signsSymptoms', label: 'Signs and Symptoms:' } ] },
            { id: 'diag',  row: 1, col: 3, fields: [ { key: 'diagnostics', label: 'Diagnostics / Lab Values:' } ] },
            { id: 'sec',   row: 3, col: 1, fields: [
                { key: 'secondaryDx',            label: 'Secondary Diagnosis:' },
                { key: 'secondaryInterventions', label: 'Interventions:' } ] },
            { id: 'ndx',   row: 3, col: 2, fields: [ { key: 'nursingDx', label: 'Nursing Diagnoses:', multi: true } ] },
            { id: 'meds',  row: 2, col: 3, fields: [ { key: 'medications', label: 'Medications:' } ] },
            { id: 'nint',  row: 3, col: 3, fields: [ { key: 'nursingInterventions', label: 'Nursing Interventions:' } ] }
        ],
        CONNECT: [
            ['patho', 'ss', true], ['ss', 'diag', true],
            ['dx', 'ss'], ['dx', 'risk'], ['dx', 'meds'], ['dx', 'ndx'], ['dx', 'sec'],
            ['ndx', 'nint', true]
        ],
        // BendBSN extra kept below the map (the pre-6/24 concept map)
        DETAIL_TITLE: 'Care plan detail',
        PROBLEM_FIELDS: [
            { key: 'data',          label: 'Supporting Data (assessment cues)', pdf: 'Supporting Data' },
            { key: 'dx',            label: 'NANDA Diagnosis' },
            { key: 'goals',         label: 'Goals / Outcomes' },
            { key: 'interventions', label: 'Interventions & Rationales' },
            { key: 'evaluation',    label: 'Evaluation Criteria' }
        ],
        PREVIOUS_CENTER: 'Previous notes — summary (center node)'
    };
    // Single-text keys of the map (everything except the multi list)
    CONCEPT_MAP.TEXT_KEYS = [];
    CONCEPT_MAP.BOXES.forEach(function (b) {
        b.fields.forEach(function (f) { if (!f.multi) CONCEPT_MAP.TEXT_KEYS.push(f.key); });
    });
    CONCEPT_MAP.BOX_BY_ID = CONCEPT_MAP.BOXES.reduce(function (a, b) { a[b.id] = b; return a; }, {});

    // ------------------------------------------------------------------
    // Head-to-Toe Assessment — the Word form's regions and items, labels as
    // printed ("Dentition", not the form's "Dentation"). `id` is the stored
    // key in the module's state slice (state[id]); never rename one.
    //   text   → state[id] = string
    //   checks → single: state[id] = option key ('' = none)
    //            multi:  state[id] = { optionKey: true }
    //   inline → a row of short text fields (Vitals); a field with `ids`
    //            is split (BP __/__)
    //   group  → a label line with its own items indented under it
    //   grid   → text fields in `cols` columns (Breath sounds Front/Back)
    //   body   → the body diagram: state[id] = [{ view, x, y, note }]
    //            (x, y normalised 0–1 within the view's box)
    // `sub: true` = the form's "⟶" indented sub-item.
    // col 'L' / 'R' = the Word page's left / right column; the regions pair
    // up across the columns row by row (General | Upper Extremities, …).
    // ------------------------------------------------------------------
    function hT(id, label, sub) { return { type: 'text', id: id, label: label, sub: !!sub }; }
    function hC(id, label, opts, single, sub) {
        return { type: 'checks', id: id, label: label, single: !!single, sub: !!sub,
                 opts: opts.map(function (o) { return { key: o[0], label: o[1] }; }) };
    }
    const H2T_ROM = [['active', 'Active'], ['passive', 'Passive']];
    const H2T_TEMP = [['warm', 'Warm'], ['cool', 'Cool']];
    const H2T_BOWEL = [['active', 'Active'], ['hyper', 'Hyper'], ['hypo', 'Hypo'], ['absent', 'Absent']];
    const H2T = {
        TITLE: 'Head-to-Toe Assessment',
        REGIONS: [
            { id: 'general', title: 'General', col: 'L', items: [
                hC('gen_loc', 'LOC:', [['alert', 'Alert'], ['drowsy', 'Drowsy'], ['lethargic', 'Lethargic'], ['stuporous', 'Stuporous'], ['coma', 'Coma']], true),
                hC('gen_orient', 'Orientation:', [['person', 'Person'], ['place', 'Place'], ['time', 'Time'], ['situation', 'Situation']]),
                { type: 'inline', label: 'Vitals:', fields: [
                    { id: 'gen_temp', label: 'Temp' }, { id: 'gen_r', label: 'R' }, { id: 'gen_p', label: 'P' },
                    { id: 'gen_sao2', label: 'SaO2' }, { ids: ['gen_bp_sys', 'gen_bp_dia'], label: 'BP', sep: '/', aria: ['BP systolic', 'BP diastolic'] }
                ] },
                hT('gen_lastbm', 'Last BM'),
                { type: 'inline', label: '', fields: [
                    { id: 'gen_height', label: 'Height' }, { id: 'gen_weight', label: 'Weight' }, { id: 'gen_smoker', label: 'Smoker' }
                ] },
                hT('gen_memory', 'Memory')
            ] },
            { id: 'head', title: 'Head', col: 'L', items: [
                hT('head_hair', 'Hair/Scalp'),
                hT('head_eyes', 'Eyes/Vision'),
                hC('head_eyes_chk', '', [['perrla', 'PERRLA'], ['eom', 'EOM'], ['nystagmus', 'Nystagmus']], false, true),
                hT('head_ears', 'Ears'),
                hT('head_nose', 'Nose'),
                hT('head_smell', 'Smell', true),
                hT('head_mouth', 'Mouth'),
                hC('head_mouth_chk', '', [['smile', 'Smile'], ['tongue_out', 'Stick Out Tongue']], false, true),
                hT('head_tongue', 'Tongue', true),
                hT('head_mucous', 'Mucous Membranes', true),
                hT('head_dentition', 'Dentition', true),
                hT('head_sinuses', 'Sinuses'),
                hT('head_sensation', 'Sensation')
            ] },
            { id: 'neck', title: 'Neck', col: 'L', items: [
                hT('neck_lymph', 'Lymph nodes'),
                hT('neck_thyroid', 'Thyroid'),
                hC('neck_chk', '', [['carotid', 'Carotid Pulse'], ['jvd', 'JVD'], ['trachea', 'Trachea Midline']])
            ] },
            { id: 'chest', title: 'Chest', col: 'L', items: [
                hC('chest_heart', 'Heart Sounds', [['aorta', 'Aorta'], ['pulmonary', 'Pulmonary'], ['erbs', 'Erb\'s Point'], ['tricuspid', 'Tricuspid'], ['mitral', 'Mitral']]),
                hC('chest_pulse', '', [['apical', 'Apical Pulse'], ['arrhythmia', 'Arrhythmia']]),
                { type: 'grid', label: 'Breath sounds', cols: 2, fields: [
                    hT('chest_bs_front_upper', 'Front Upper'), hT('chest_bs_back_upper', 'Back Upper'),
                    hT('chest_bs_front_mid', 'Front Mid'),     hT('chest_bs_back_mid', 'Back Mid'),
                    hT('chest_bs_front_lower', 'Front Lower'), hT('chest_bs_back_lower', 'Back Lower')
                ] },
                hT('chest_cough', 'Cough/Sputum:'),
                hT('chest_symmetry', 'Chest Symmetry/Expansion'),
                hT('chest_turgor', 'Skin Turgor (Clavicle)')
            ] },
            { id: 'abdomen', title: 'Abdomen', col: 'L', items: [
                hT('abd_inspection', 'Inspection'),
                { type: 'group', label: 'Auscultation', items: [
                    hC('abd_luq', 'LUQ', H2T_BOWEL, true, true),
                    hC('abd_llq', 'LLQ', H2T_BOWEL, true, true),
                    hC('abd_ruq', 'RUQ', H2T_BOWEL, true, true),
                    hC('abd_rlq', 'RLQ', H2T_BOWEL, true, true)
                ] },
                hT('abd_palpation', 'Palpation'),
                hT('abd_percussion', 'Percussion'),
                hT('abd_other', 'Other')
            ] },
            { id: 'ue', title: 'Upper Extremities', col: 'R', items: [
                hC('ue_pulses', 'Palpate Pulses:', [['brachial', 'Brachial'], ['radial', 'Radial'], ['equal', 'Equal']]),
                hT('ue_hair', 'Hair Distribution'),
                hT('ue_sensation', 'Sensation'),
                hC('ue_temp', 'Temp vs. Trunk:', H2T_TEMP, true),
                hT('ue_caprefill', 'Cap Refill'),
                hC('ue_grip', 'Grip', [['equal', 'Equal'], ['strong', 'Strong']]),
                hT('ue_strength', 'Muscle Strength'),
                { type: 'group', label: 'ROM:', items: [
                    hC('ue_rom_left', 'Left', H2T_ROM, false, true),
                    hC('ue_rom_right', 'Right', H2T_ROM, false, true)
                ] }
            ] },
            { id: 'le', title: 'Lower Extremities', col: 'R', items: [
                hC('le_pulses', 'Palpate Pulses:', [['femoral', 'Femoral'], ['popliteal', 'Popliteal'], ['post_tibial', 'Posterior Tibial'], ['dorsalis_pedis', 'Dorsalis Pedis'], ['equal', 'Equal']]),
                hT('le_hair', 'Hair Distribution'),
                hT('le_edema', 'Edema:'),
                hT('le_sensation', 'Sensation'),
                hC('le_temp', 'Temp vs. Trunk:', H2T_TEMP, true),
                hT('le_caprefill', 'Cap Refill'),
                hT('le_strength', 'Muscle Strength'),
                { type: 'group', label: 'ROM:', items: [
                    hC('le_rom_left', 'Left', H2T_ROM, false, true),
                    hC('le_rom_right', 'Right', H2T_ROM, false, true)
                ] }
            ] },
            { id: 'pain', title: 'Pain', col: 'R', items: [
                hC('pain_type', '', [['acute', 'Acute'], ['chronic', 'Chronic']], true),
                hT('pain_intensity', 'Intensity (0-10/10)'),
                hT('pain_location', 'Location'),
                hT('pain_duration', 'Duration'),
                hT('pain_characteristics', 'Characteristics'),
                hT('pain_precipitating', 'Precipitating factors'),
                hT('pain_nonverbal', 'Non-verbal cues'),
                hT('pain_better', 'What makes it better?'),
                hT('pain_worse', 'What makes it worse?'),
                hT('pain_sleep', 'Does it affect sleep?')
            ] },
            { id: 'skin', title: 'Skin', col: 'R', items: [
                hT('skin_desc', 'Description'),
                hT('skin_issues', 'Any skin issues'),
                { type: 'body', id: 'skin_markers', label: 'Body diagram' }
            ] },
            { id: 'gait', title: 'Gait', col: 'R', items: [
                hT('gait_romberg', 'Romberg'),
                hT('gait_balance', 'Balance')
            ] }
        ],
        // Schema ≤4 packets stored one free-text box per body system (these
        // keys). They are never moved or deleted: each non-empty one shows —
        // and prints — as "Previous notes" inside the region named here.
        LEGACY: [
            { key: 'neuro',  label: 'Neurological',         region: 'general' },
            { key: 'psych',  label: 'Psychosocial',         region: 'general' },
            { key: 'heent',  label: 'HEENT',                region: 'head' },
            { key: 'cardio', label: 'Cardiovascular',       region: 'chest' },
            { key: 'resp',   label: 'Respiratory',          region: 'chest' },
            { key: 'gi',     label: 'Gastrointestinal',     region: 'abdomen' },
            { key: 'gu',     label: 'Genitourinary',        region: 'abdomen' },
            { key: 'skin',   label: 'Skin / Integumentary', region: 'skin' },
            { key: 'msk',    label: 'Musculoskeletal',      region: 'gait' }
        ]
    };
    // Region rows as the Word page pairs them (left column | right column)
    H2T.PAIRS = (function () {
        const l = H2T.REGIONS.filter(function (r) { return r.col === 'L'; });
        const r = H2T.REGIONS.filter(function (x) { return x.col === 'R'; });
        const out = [];
        for (let i = 0; i < Math.max(l.length, r.length); i++) out.push([l[i] || null, r[i] || null]);
        return out;
    })();

    // Body diagram (image2.jpeg: front, back, top of head, soles of feet) as
    // simple outlines shared by the editor's SVG and the PDF's vector
    // drawing, so markers land in the same place in both. Units are the
    // view's own box (w × h). Shapes: { e:[cx,cy,rx,ry] } ellipse,
    // { p:[[x,y]…], closed } smooth curve, { l:[[x,y]…] } straight line.
    // `sides` = the patient's R/L printed beside the figure.
    const BODY_HALF = [
        [55,27.5],[56,33],[62,35.5],[70,38],[75.5,42],[77.5,50],[79,62],[80.5,72],[82.5,84],[84,95],
        [87,100],[89,107],[88,113],[85,117],[82,116],[80.5,110],[79.5,103],[78,97],[76,86],[73.5,74],
        [71.5,62],[69.5,52],[68.5,62],[67,72],[68,80],[70,90],[70.5,102],[69.5,118],[67,136],[66.5,148],
        [65.5,166],[63.5,188],[63,197],[65,203],[66.5,208],[62,211],[56.5,210.5],[54.5,204],[54.5,196],
        [54.5,180],[53.5,162],[53.5,146],[53,136],[52.5,122],[51.5,110],[50,104]
    ];
    const BODY_OUTLINE = BODY_HALF.map(function (p) { return [100 - p[0], p[1]]; })
        .concat(BODY_HALF.slice().reverse().slice(1));
    const SOLE = [[0,93],[7,90],[10.5,82],[11,70],[12,56],[13.5,44],[14,36],[12,30.5],[6,27.5],[-2,26.5],
                  [-9,27],[-13,31.5],[-12.5,40],[-8,52],[-7.5,64],[-9.5,78],[-8,88]];
    const TOES = [[-8.5,18.5,5,6.8],[-0.5,19,3,4.3],[4.8,20.6,2.7,3.7],[9.2,23,2.4,3.3],[12.8,26.7,2.1,2.8]];
    function foot(ox, mirror) {
        const sx = mirror ? -1 : 1;
        return [{ p: SOLE.map(function (q) { return [ox + sx * q[0], q[1]]; }), closed: true }]
            .concat(TOES.map(function (t) { return { e: [ox + sx * t[0], t[1], t[2], t[3]] }; }));
    }
    const BODY = {
        VIEWS: [
            { key: 'front', label: 'Front', w: 100, h: 216, sides: ['R', 'L'],
              shapes: [{ e: [50, 16, 10, 12.5] }, { p: BODY_OUTLINE }, { e: [50, 80, 0.9, 0.9] }] },
            { key: 'back', label: 'Back', w: 100, h: 216, sides: ['L', 'R'],
              shapes: [{ e: [50, 16, 10, 12.5] }, { p: BODY_OUTLINE }, { l: [[50, 36], [50, 84]] }, { l: [[50, 92], [50, 104]] }] },
            { key: 'head', label: 'Top of head', w: 100, h: 100,
              shapes: [{ e: [50, 52, 28, 35] }, { p: [[46, 17.5], [50, 12.5], [54, 17.5]] },
                       { e: [21.5, 54, 3.5, 8] }, { e: [78.5, 54, 3.5, 8] }] },
            { key: 'feet', label: 'Soles of feet', w: 100, h: 100,
              shapes: foot(32, true).concat(foot(68, false)) }
        ]
    };
    BODY.VIEW_BY_KEY = BODY.VIEWS.reduce(function (a, v) { a[v.key] = v; return a; }, {});
    H2T.BODY = BODY;

    // Catmull-Rom → cubic Bézier: [{ c1, c2, p }] (absolute) after the start
    // point pts[0]. The editor turns it into an SVG path, the PDF into
    // jsPDF lines() segments — same curve in both.
    function bodyCurves(pts, closed) {
        const n = pts.length;
        const segs = [];
        if (n < 2) return segs;
        function at(i) {
            if (closed) return pts[(i + n) % n];
            return pts[Math.max(0, Math.min(n - 1, i))];
        }
        const last = closed ? n : n - 1;
        for (let i = 0; i < last; i++) {
            const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
            segs.push({
                c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
                c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
                p: [p2[0], p2[1]]
            });
        }
        return segs;
    }

    // ------------------------------------------------------------------
    // Read-time migrations (pure — never write to Firebase)
    // ------------------------------------------------------------------

    function str(v) { return v == null ? '' : String(v); }
    // A stored score (RTDB number; tolerate numeric strings). null = unscored.
    function num(v) {
        if (v == null || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
    }
    function readChoices(src, ids) {
        const out = {};
        if (!src || typeof src !== 'object') return out;
        ids.forEach(function (id) {
            const n = num(src[id]);
            if (n != null) out[id] = n;
        });
        return out;
    }

    // Braden → { cols: { a1..a4: { date, evaluator, choices{factorId:n} } },
    // isNew, migrated }. Always returns fresh objects (safe to mutate; the
    // editor adopts them as state.cols on the first edit). Old shape = one
    // assessment in state.choices/date/evaluator → column 1.
    function readBraden(state) {
        state = state || {};
        const ids = BRADEN.FACTORS.map(function (f) { return f.id; });
        const cols = {};
        const isNew = state._schema >= 4 || !!(state.cols && typeof state.cols === 'object');
        BRADEN.COLS.forEach(function (c) {
            const src = isNew && state.cols ? (state.cols[c.key] || {}) : {};
            cols[c.key] = { date: str(src.date), evaluator: str(src.evaluator), choices: readChoices(src.choices, ids) };
        });
        let migrated = false;
        if (!isNew) {
            const a1 = cols.a1;
            a1.choices = readChoices(state.choices, ids);
            a1.date = str(state.date);
            a1.evaluator = str(state.evaluator);
            migrated = Object.keys(a1.choices).length > 0 || !!(a1.date.trim() || a1.evaluator.trim());
        }
        return { cols: cols, isNew: isNew, migrated: migrated };
    }

    // Morse → { cols: { admit, review1, review2: { date, signature,
    // choices{varId:n} } }, isNew, migrated }. Old shape: state.choices (one
    // score set) + admit_date + signature → Admission column; the old
    // review1/review2 dates had no scores and become the review columns' dates.
    function readMorse(state) {
        state = state || {};
        const ids = MORSE.VARS.map(function (v) { return v.id; });
        const cols = {};
        const isNew = state._schema >= 4 || !!(state.cols && typeof state.cols === 'object');
        MORSE.COLS.forEach(function (c) {
            const src = isNew && state.cols ? (state.cols[c.key] || {}) : {};
            cols[c.key] = { date: str(src.date), signature: str(src.signature), choices: readChoices(src.choices, ids) };
        });
        let migrated = false;
        if (!isNew) {
            cols.admit.choices = readChoices(state.choices, ids);
            cols.admit.date = str(state.admit_date);
            cols.admit.signature = str(state.signature);
            cols.review1.date = str(state.review1);
            cols.review2.date = str(state.review2);
            migrated = Object.keys(cols.admit.choices).length > 0 ||
                ['admit_date', 'review1', 'review2', 'signature'].some(function (k) { return str(state[k]).trim() !== ''; });
        }
        return { cols: cols, isNew: isNew, migrated: migrated };
    }

    // ------------------------------------------------------------------
    // Scoring (shared by the editor and the PDF). `cls` is the editor's
    // badge colour: high / moderate / low / '' (not scored / incomplete).
    // ------------------------------------------------------------------
    function scoreMorse(choices) {
        choices = choices || {};
        let total = 0, n = 0;
        MORSE.VARS.forEach(function (v) {
            const x = num(choices[v.id]);
            if (x != null) { total += x; n++; }
        });
        const of = MORSE.VARS.length;
        let label, cls = '';
        if (!n) label = 'Not scored';
        else if (n < of) label = 'Incomplete (' + n + '/' + of + ' scored)';
        else if (total >= 45) { label = 'High Risk (45 and higher)'; cls = 'high'; }
        else if (total >= 25) { label = 'Moderate Risk (25–44)'; cls = 'moderate'; }
        else { label = 'Low Risk (0–24)'; cls = 'low'; }
        return { total: total, n: n, of: of, complete: n === of, label: label, cls: cls };
    }

    function scoreBraden(choices) {
        choices = choices || {};
        let total = 0, n = 0;
        BRADEN.FACTORS.forEach(function (f) {
            const x = num(choices[f.id]);
            if (x != null) { total += x; n++; }
        });
        const of = BRADEN.FACTORS.length;
        let label, cls = '';
        // A partial sum reads as a falsely severe tier, so only interpret a
        // complete assessment.
        if (!n) label = 'Not scored';
        else if (n < of) label = 'Incomplete (' + n + '/' + of + ' scored)';
        else if (total <= 9)  { label = 'Severe Risk (≤9)'; cls = 'high'; }
        else if (total <= 12) { label = 'High Risk (10–12)'; cls = 'high'; }
        else if (total <= 14) { label = 'Moderate Risk (13–14)'; cls = 'moderate'; }
        else if (total <= 18) { label = 'Mild Risk (15–18)'; cls = 'low'; }
        else { label = 'No significant risk (19+)'; cls = 'low'; }
        return { total: total, n: n, of: of, complete: n === of, label: label, cls: cls };
    }

    // Hendrich II: factors are yes/no checkboxes, Get Up & Go one choice.
    // Nothing ticked and no Get Up & Go = "Not scored" (not 0 / lower risk).
    function scoreHendrich(state) {
        state = state || {};
        const factors = state.factors || {};
        let total = 0, anyFactor = false;
        HENDRICH.FACTORS.forEach(function (f) {
            if (factors[f.id]) { total += f.pts; anyFactor = true; }
        });
        const gug = num(state.getUpGo);
        if (gug != null) total += gug;
        let label, cls = '';
        if (!anyFactor && gug == null) label = 'Not scored';
        else if (total >= 5) { label = 'High Risk (5 or greater)'; cls = 'high'; }
        else if (gug == null) label = 'Incomplete (Get Up & Go not scored)';
        else { label = 'Lower Risk (<5)'; cls = 'low'; }
        return { total: total, gug: gug, scored: anyFactor || gug != null, label: label, cls: cls };
    }

    // Mini-Cog: state.words{ocean,desk,tractor} (booleans) when the student
    // ticked words; otherwise a legacy state.recall number (0–3) is used.
    function readMinicog(state) {
        state = state || {};
        const w = state.words && typeof state.words === 'object' ? state.words : null;
        const words = {};
        let count = 0;
        MINICOG.WORDS.forEach(function (x) {
            words[x.key] = !!(w && w[x.key]);
            if (words[x.key]) count++;
        });
        const recall = count ? count : num(state.recall);
        const clock = num(state.clock);
        let label = 'Not scored', cls = '';
        if (recall != null && clock != null) {
            if (recall + clock <= 2) { label = 'Positive screen for dementia (0–2)'; cls = 'high'; }
            else { label = 'Negative screen (3–5)'; cls = 'low'; }
        }
        return {
            words: words,
            wordsTicked: count > 0,
            recall: recall,
            clock: clock,
            total: (recall == null && clock == null) ? null : (recall || 0) + (clock || 0),
            label: label, cls: cls
        };
    }

    // NCSBN: returns { s1, s2, s3a, s3b, s45, s6a, s6b } (strings) for any
    // stored shape. New shape (_schema >= 3 or a `boxes` object) is read as
    // is. Old shape: steps[0..5] — Recognize, Analyze, Prioritize (both
    // Step 3 prompts in one box), Generate Solutions, Take Action, Evaluate
    // (both Evaluate prompts in one box). RTDB may hand integer-keyed data
    // back as an array (with nulls for gaps) or an object with "0".."5".
    function readNcsbn(state) {
        state = state || {};
        const out = {};
        NCSBN_ROWS.forEach(function (r) { out[r.key] = ''; });
        const boxes = state.boxes;
        if ((state._schema >= 3) || (boxes && typeof boxes === 'object')) {
            NCSBN_ROWS.forEach(function (r) {
                const v = boxes && boxes[r.key];
                out[r.key] = v == null ? '' : String(v);
            });
            return out;
        }
        const steps = state.steps;
        if (!steps || typeof steps !== 'object') return out;
        function old(i) {
            const v = steps[i] != null ? steps[i] : steps[String(i)];
            return v == null ? '' : String(v);
        }
        const gen = old(3), act = old(4);
        out.s1 = old(0);
        out.s2 = old(1);
        // The old single Step 3 box answered both Step 3 prompts; it lands in
        // the first Step 3 row so nothing is shown twice.
        out.s3a = old(2);
        // Word row 5 is one box for Steps 4 and 5 — keep both old answers.
        if (gen.trim() && act.trim()) {
            out.s45 = 'Generate solutions: ' + gen + '\n\nTake action: ' + act;
        } else {
            out.s45 = gen.trim() ? gen : act;
        }
        out.s6a = old(5);
        return out;
    }

    // RTDB hands an array back as-is, as an integer-keyed object, or with
    // null gaps. Returns a plain array in index order (gaps dropped).
    function listOf(v) {
        if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
        if (v && typeof v === 'object') {
            return Object.keys(v).filter(function (k) { return /^\d+$/.test(k); })
                .sort(function (a, b) { return Number(a) - Number(b); })
                .map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
        }
        return [];
    }

    // Nursing Concept Map (schema 6) → { fields{textKey: string},
    // nursingDx[string], problems[{name, data, dx, goals, interventions,
    // evaluation, …}], center, isNew, migrated }. Pure: fresh objects, never
    // touches `state` (the editor adopts them on the first edit).
    // Old shape (problem list + center summary): each problem's NANDA
    // diagnosis (or its name, when that is all there is) becomes a Nursing
    // Diagnoses entry, its interventions go into Nursing Interventions
    // (headed by the problem's name when there are several). The problems are
    // always returned whole — they are the "Care plan detail" block — and
    // `center` is the old summary, shown as "Previous notes" in the
    // Diagnosis box. A new-shape slice is read as is.
    function readConceptMap(state) {
        state = state || {};
        const CM = CONCEPT_MAP;
        const pKeys = ['name'].concat(CM.PROBLEM_FIELDS.map(function (f) { return f.key; }));
        const problems = listOf(state.problems).filter(function (p) {
            return p && typeof p === 'object';
        }).map(function (p) {
            const o = Object.assign({}, p);
            pKeys.forEach(function (k) { o[k] = str(p[k]); });
            return o;
        });
        const isNew = state._schema >= 6 || state.nursingDx != null ||
            CM.TEXT_KEYS.some(function (k) { return state[k] != null; });
        const fields = {};
        CM.TEXT_KEYS.forEach(function (k) { fields[k] = str(state[k]); });
        let nursingDx = listOf(state.nursingDx).map(str);
        let migrated = false;
        if (!isNew) {
            const used = problems.filter(function (p) {
                return pKeys.some(function (k) { return p[k].trim() !== ''; });
            });
            nursingDx = used.map(function (p) {
                const dx = p.dx.trim(), name = p.name.trim();
                if (dx && name && dx.toLowerCase().indexOf(name.toLowerCase()) === -1) return name + ' — ' + dx;
                return dx || name;
            }).filter(function (t) { return t !== ''; });
            fields.nursingInterventions = used.filter(function (p) {
                return p.interventions.trim() !== '';
            }).map(function (p) {
                if (used.length < 2) return p.interventions.trim();
                const head = p.name.trim() || p.dx.trim() || ('Problem ' + (problems.indexOf(p) + 1));
                return head + ':\n' + p.interventions.trim();
            }).join('\n\n');
            migrated = nursingDx.length > 0 || fields.nursingInterventions !== '';
        }
        return { fields: fields, nursingDx: nursingDx, problems: problems, center: str(state.center), isNew: isNew, migrated: migrated };
    }

    // Every H2T item that stores a value, flattened (groups/grids opened up,
    // inline fields expanded; the body diagram included as type 'body').
    function h2tItems() {
        const out = [];
        function walk(items, region) {
            items.forEach(function (it) {
                if (it.type === 'group') walk(it.items, region);
                else if (it.type === 'grid') walk(it.fields, region);
                else if (it.type === 'inline') {
                    it.fields.forEach(function (f) {
                        (f.ids || [f.id]).forEach(function (id) { out.push({ type: 'text', id: id, label: f.label, region: region }); });
                    });
                } else out.push(Object.assign({ region: region }, it));
            });
        }
        H2T.REGIONS.forEach(function (r) { walk(r.items, r.id); });
        return out;
    }

    // Body-diagram markers → [{ view, x, y, note }] with a known view and
    // x/y clamped to 0–1. A marker added from the list (not placed on the
    // diagram) has no x/y and reads as x = y = null: it prints in the legend
    // only, never on the figure. RTDB may hand the array back as an
    // integer-keyed object; entries that aren't marker objects are skipped.
    function readBodyMarkers(v) {
        let list = v;
        if (list && !Array.isArray(list) && typeof list === 'object') {
            list = Object.keys(list).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return list[k]; });
        }
        if (!Array.isArray(list)) return [];
        function unit(n) {
            if (n == null || n === '') return null;
            n = Number(n);
            return isNaN(n) ? null : Math.max(0, Math.min(1, n));
        }
        return list.filter(function (m) { return m && typeof m === 'object'; }).map(function (m) {
            const x = unit(m.x), y = unit(m.y);
            const placed = x != null && y != null;
            return { view: BODY.VIEW_BY_KEY[m.view] ? m.view : 'front', x: placed ? x : null, y: placed ? y : null, note: str(m.note) };
        });
    }

    // Head-to-Toe (schema 5) → { values{id: string | {opt:true}}, markers[],
    // legacy[{ key, label, region, text }], isNew }. Pure: returns fresh
    // objects and never touches `state`. Old packets (the 9 free-text
    // systems) have no structured values; their text comes back in
    // `legacy`, one entry per non-empty old box, to be shown and printed as
    // "Previous notes" in the matching region. The old keys are kept in the
    // state slice for good — the editor binds those boxes to them directly.
    function readHeadToToe(state) {
        state = state || {};
        const values = {};
        let markers = [];
        h2tItems().forEach(function (it) {
            const v = state[it.id];
            if (it.type === 'text') values[it.id] = str(v);
            else if (it.type === 'body') markers = readBodyMarkers(v);
            else if (it.type === 'checks') {
                if (it.single) {
                    const ok = it.opts.some(function (o) { return o.key === v; });
                    values[it.id] = ok ? v : '';
                } else {
                    const o = {};
                    it.opts.forEach(function (op) { o[op.key] = !!(v && typeof v === 'object' && v[op.key]); });
                    values[it.id] = o;
                }
            }
        });
        const legacy = H2T.LEGACY.filter(function (l) {
            return str(state[l.key]).trim() !== '';
        }).map(function (l) {
            return { key: l.key, label: l.label, region: l.region, text: str(state[l.key]) };
        });
        return { values: values, markers: markers, legacy: legacy, isNew: state._schema >= 5 };
    }

    window.CAP_MODULES = {
        CATEGORY_ORDER: CATEGORY_ORDER,
        MODULE_CATALOG: MODULE_CATALOG,
        MODULE_PRESETS: MODULE_PRESETS,
        MODULE_BY_ID: MODULE_BY_ID,
        PDF_ORDER: PDF_ORDER,
        modulesByCategory: modulesByCategory,
        orderModules: orderModules,
        personWord: personWord,
        FORM: {
            NAME: FORM_NAME,
            VERSION: FORM_VERSION,
            OMEGA_ROWS: OMEGA_ROWS,
            MED_COLUMNS: MED_COLUMNS,
            NCSBN_ROWS: NCSBN_ROWS,
            LAB_COLUMNS: LAB_COLUMNS,
            LAB_GROUPS: LAB_GROUPS,
            BRADEN: BRADEN,
            MORSE: MORSE,
            HENDRICH: HENDRICH,
            MINICOG: MINICOG,
            H2T: H2T,
            CONCEPT_MAP: CONCEPT_MAP
        },
        readNcsbn: readNcsbn,
        readConceptMap: readConceptMap,
        readHeadToToe: readHeadToToe,
        readBodyMarkers: readBodyMarkers,
        h2tItems: h2tItems,
        bodyCurves: bodyCurves,
        readBraden: readBraden,
        readMorse: readMorse,
        readMinicog: readMinicog,
        scoreBraden: scoreBraden,
        scoreMorse: scoreMorse,
        scoreHendrich: scoreHendrich,
        SCHEMA_VERSION: SCHEMA_VERSION  // 6 = Word-form Nursing Concept Map (see header)
    };
})();
