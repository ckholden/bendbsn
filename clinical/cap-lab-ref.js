/* BendBSN — shared adult lab reference ranges
   ------------------------------------------------------------------
   One set of textbook ranges for the whole site:
     /clinical/ and /clinical/packet/  cap-modules.js reads it (TABLE 3
                                       Normal Values fill, H / L flags)
     /resources/                       the Lab Values Reference table
   Load it before cap-modules.js. Change a range here and both pages
   follow; cap-modules.js keeps the parsing and flagging rules.
   Exposes window.CAP_LAB_REF = { LAB_REF, LAB_EXTRA_REF, LAB_REF_SOURCE }.
*/
(function () {
    'use strict';
    if (window.CAP_LAB_REF) return;

    // Textbook adult reference ranges for the packet's TABLE 3 (common
    // nursing lab references, Pagana / ATI conventions; fasting glucose per
    // ADA). Keys are cap-modules.js LAB_GROUPS row ids. Read there by
    // refFor() / labView(), where a Normal Values range the student typed
    // (their facility's) always wins over these, and by /resources/ for its
    // Lab Values table, so both show the same ranges.
    //   range        one range for everyone ('136-145', '<200')
    //   male/female  sex-specific ranges instead (Patient Info sex picks one)
    //   unit, note   printed after the range: '<200 mg/dL (desirable)'
    //   alias        words that name the lab in prose (labMentioned()). An
    //                all-lowercase alias matches in any case; an alias written
    //                with a capital letter matches only exactly as written
    //                ('PT', so "pt" = patient doesn't count).
    //   guard        flagLab()'s units guard as { lo, hi } factors (0 = off;
    //                default 20 / 20): off where a real result can sit far
    //                outside the range (neutropenic WBC, suppressed TSH,
    //                liver enzymes in the thousands).
    const LAB_REF = {
        na:          { range:'136-145',   unit:'mEq/L',
                       alias:['sodium', 'Na', 'NA+', 'hyponatremia', 'hypernatremia'] },
        k:           { range:'3.5-5.0',   unit:'mEq/L',
                       alias:['potassium', 'K', 'K+', 'hypokalemia', 'hyperkalemia'] },
        cl:          { range:'98-106',    unit:'mEq/L',
                       alias:['chloride', 'Cl', 'CL', 'hypochloremia', 'hyperchloremia'] },
        co2:         { range:'23-30',     unit:'mEq/L',
                       alias:['co2', 'tco2', 'bicarbonate', 'bicarb', 'hco3', 'carbon dioxide'] },
        bun:         { range:'10-20',     unit:'mg/dL',
                       alias:['bun', 'blood urea nitrogen', 'urea', 'azotemia'] },
        creatinine:  { male:'0.6-1.2', female:'0.5-1.1', unit:'mg/dL',
                       alias:['creatinine', 'creat', 'Cr', 'SCr', 'sCr', 'Scr'] },
        cholesterol: { range:'<200',      unit:'mg/dL', note:'desirable',
                       alias:['cholesterol', 'chol', 'hypercholesterolemia'] },
        albumin:     { range:'3.5-5.0',   unit:'g/dL',
                       alias:['albumin', 'alb', 'hypoalbuminemia'] },
        rbc:         { male:'4.7-6.1', female:'4.2-5.4', unit:'x10^6/uL',
                       alias:['rbc', 'rbcs', 'red blood cell', 'red blood cells', 'red cell count', 'erythrocyte', 'erythrocytes'] },
        wbc:         { range:'5.0-10.0',  unit:'x10^3/uL', guard:{ lo:0, hi:20 },
                       alias:['wbc', 'wbcs', 'white blood cell', 'white blood cells', 'white count', 'leukocyte', 'leukocytes', 'leukocytosis', 'leukopenia'] },
        hct:         { male:'42-52', female:'37-47', unit:'%',
                       alias:['hct', 'hematocrit', 'haematocrit', 'h&h', 'h/h'] },
        hgb:         { male:'14-18', female:'12-16', unit:'g/dL',
                       alias:['hgb', 'hemoglobin', 'haemoglobin', 'hb', 'h&h', 'h/h'] },
        pt:          { range:'11.0-12.5', unit:'sec',
                       alias:['PT', 'prothrombin', 'protime', 'pro time'] },
        ptt:         { range:'30-40',     unit:'sec', note:'aPTT',
                       alias:['ptt', 'aptt', 'partial thromboplastin'] },
        inr:         { range:'0.8-1.1', note:'2.0-3.0 therapeutic on warfarin',
                       alias:['inr', 'international normalized ratio'] },
        tsh:         { range:'0.5-5.0',   unit:'mIU/L', guard:{ lo:0, hi:20 },
                       alias:['tsh', 'thyroid stimulating hormone', 'thyrotropin'] },
        alt:         { range:'4-36',      unit:'U/L', guard:{ lo:20, hi:0 },
                       alias:['ALT', 'sgpt', 'alanine aminotransferase', 'alanine transaminase', 'lft', 'lfts', 'liver enzymes'] },
        ast:         { range:'0-35',      unit:'U/L', guard:{ lo:20, hi:0 },
                       alias:['AST', 'sgot', 'aspartate aminotransferase', 'aspartate transaminase', 'lft', 'lfts', 'liver enzymes'] }
    };
    // Rows the student adds under Other (labs.extra[].lab), recognised by
    // name: `match` must and `not` must not hit the lab name ("Alk Phos" is
    // not phosphorus, "LDH" is not lactate, "Ionized Ca" has its own range).
    // `key` identifies the entry (refFor(key) works too); other keys as in
    // LAB_REF.
    const LAB_EXTRA_REF = [
        { key:'platelets', label:'Platelets', range:'150-400', unit:'x10^3/uL', guard:{ lo:0, hi:20 },
          match:/platelet|plt/i, not:/mean platelet|\bmpv\b|platelet function|aggregation/i,
          alias:['platelet', 'platelets', 'plt', 'plts', 'thrombocytopenia', 'thrombocytosis'] },
        // A fasting range (ADA: 100-125 prediabetes, 126+ diabetes): a
        // random / point-of-care value above 99 may be expected, so the note
        // says which range this is
        { key:'glucose', label:'Glucose', range:'70-99', unit:'mg/dL', note:'fasting',
          match:/glucose|blood\s*sugar|\b(?:bg|bgl|cbg|fsbg|fsbs|bs)\b/i, not:/urine|\bua\b|csf|tolerance|\bo?gtt\b/i,
          alias:['glucose', 'blood glucose', 'blood sugar', 'bg', 'cbg', 'hyperglycemia', 'hypoglycemia'] },
        { key:'calcium', label:'Calcium', range:'9.0-10.5', unit:'mg/dL',
          match:/calcium|^\s*ca(?![a-z])/i, not:/ionized|\bi-?ca\b|urine|\bca\s*-?\s*(?:125|19|15|27)\b/i,
          alias:['calcium', 'Ca+', 'Ca++', 'Ca2+', 'hypocalcemia', 'hypercalcemia'] },
        // In mg/dL, the unit US hospital labs report; the note gives the same
        // textbook range in mEq/L (×20 units guard can't tell a 1.2× unit
        // difference apart, so the range must be in the unit results come in)
        { key:'magnesium', label:'Magnesium', range:'1.6-2.6', unit:'mg/dL', note:'1.3-2.1 mEq/L',
          match:/magnesium|^\s*mg(?![a-z])/i, not:/urine/i,
          alias:['magnesium', 'Mg', 'hypomagnesemia', 'hypermagnesemia'] },
        { key:'phosphorus', label:'Phosphorus', range:'3.0-4.5', unit:'mg/dL',
          match:/phosph(?:orus|ate)|^\s*(?:phos|po4)(?![a-z])/i, not:/alk|phosphatase|urine/i,
          alias:['phosphorus', 'phosphate', 'phos', 'PO4', 'hypophosphatemia', 'hyperphosphatemia'] },
        { key:'bnp', label:'BNP', range:'<100', unit:'pg/mL', guard:{ lo:20, hi:0 },
          match:/\bbnp\b|natriuretic/i, not:/nt-?\s*pro|probnp/i,
          alias:['bnp', 'b-type natriuretic peptide', 'brain natriuretic peptide'] },
        { key:'lactate', label:'Lactate', range:'0.5-2.2', unit:'mmol/L',
          match:/lact(?:ate|ic)/i, not:/dehydrogenase|\bldh?\b/i,
          alias:['lactate', 'lactic acid', 'lactic'] },
        { key:'a1c', label:'HbA1c', range:'<5.7', unit:'%',
          match:/a1c|glyc(?:at|osylat)ed\s*h/i,
          alias:['a1c', 'hba1c', 'hgba1c', 'hemoglobin a1c', 'glycated hemoglobin', 'glycosylated hemoglobin'] }
    ];
    const LAB_REF_SOURCE = 'Textbook adult ranges from common nursing lab references (fasting glucose per ADA), reviewed November 2026. Ranges vary by lab and method: your facility\'s range governs.';

    window.CAP_LAB_REF = {
        LAB_REF: LAB_REF,
        LAB_EXTRA_REF: LAB_EXTRA_REF,
        LAB_REF_SOURCE: LAB_REF_SOURCE
    };
})();
