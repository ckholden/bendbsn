/* =========================================================
   BendBSN Sim EMR — Seed Data (v2: Encounter Model)

   Phase 2 schema:
   - Patient = static identity (name/DOB/MRN/allergies/PMH/home meds)
   - Encounter = one hospital visit (admission → discharge)
   - Chart data (vitals/notes/MAR/TAR) tagged with encounterId

   Editing: bump SEED_VERSION so existing DBs trigger the
   migration modal on next load.

   ALL DATA IS FICTIONAL.
   No real NDC codes, NPIs, MRNs, or provider identities.
   ========================================================= */

const SEED_VERSION = 6;

// ---- Allergy → med-name substring triggers (case-insensitive) ----
// Phase 3A.5b: kept for back-compat but also used as one of several matchers.
// The primary matcher is now the crossReactivityMap + substance-type logic in index.html.
const ALLERGY_TRIGGERS = {
    'Penicillin':     ['amoxicillin', 'ampicillin', 'piperacillin', 'penicillin', 'nafcillin', 'oxacillin'],
    'Sulfa':          ['sulfamethoxazole', 'bactrim', 'sulfa', 'tmp-smx'],
    'NSAIDs':         ['ibuprofen', 'naproxen', 'ketorolac', 'aspirin'],
    'Aspirin':        ['aspirin'],
    'Codeine':        ['codeine'],
    'Morphine':       ['morphine'],
    'Latex':          [],
    'Iodine':         ['iodine', 'povidone-iodine'],
    'Shellfish':      [],
    'Eggs':           ['propofol'],
    'Peanuts':        [],
    'Heparin':        ['heparin', 'enoxaparin'],
    'Statins':        ['atorvastatin', 'simvastatin', 'rosuvastatin'],
    'ACE inhibitors': ['lisinopril', 'enalapril', 'ramipril']
};

// ---- Phase 3A.5b: Allergy reaction/severity defaults ----
// When seed allergies come in as strings (e.g., 'Penicillin'), the seed writer
// expands them using this map into the full object shape:
//   { substance, type, reaction, severity, note }
//
// type:     'drug' | 'drug-class' | 'food' | 'environmental' | 'contrast'
// reaction: clinically typical for this substance; edit per-patient if scenario demands
// severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis'
const ALLERGY_REACTION_MAP = {
    'NKDA':            { type: 'none',           reaction: '',                                  severity: '' },
    'Penicillin':      { type: 'drug-class',     reaction: 'Hives, facial swelling',            severity: 'moderate' },
    'Sulfa':           { type: 'drug-class',     reaction: 'Rash',                              severity: 'moderate' },
    'NSAIDs':          { type: 'drug-class',     reaction: 'GI bleeding (documented)',          severity: 'moderate' },
    'Aspirin':         { type: 'drug',           reaction: 'Hives',                             severity: 'mild' },
    'Codeine':         { type: 'drug',           reaction: 'Intractable nausea',                severity: 'moderate', note: 'Intolerance (not true allergy)' },
    'Morphine':        { type: 'drug',           reaction: 'Itching, hypotension',              severity: 'moderate' },
    'Latex':           { type: 'environmental',  reaction: 'Contact dermatitis',                severity: 'moderate' },
    'Iodine':          { type: 'contrast',       reaction: 'Anaphylaxis to IV contrast',        severity: 'severe', note: 'Requires contrast-free imaging or premedication' },
    'Shellfish':       { type: 'food',           reaction: 'Hives, tongue swelling',            severity: 'severe' },
    'Eggs':            { type: 'food',           reaction: 'Hives',                             severity: 'mild',   note: 'Contraindication for propofol (egg lecithin)' },
    'Peanuts':         { type: 'food',           reaction: 'Anaphylaxis (EpiPen carrier)',      severity: 'anaphylaxis' },
    'Heparin':         { type: 'drug',           reaction: 'HIT (thrombocytopenia)',            severity: 'severe', note: 'HIT history — NO heparin products, NO enoxaparin. Use bivalirudin/argatroban.' },
    'Statins':         { type: 'drug-class',     reaction: 'Myalgias, elevated CK',             severity: 'moderate' },
    'ACE inhibitors':  { type: 'drug-class',     reaction: 'Persistent cough',                  severity: 'mild',   note: 'Switched to ARB; ARBs do not cross-react.' }
};

// ---- Phase 3A.5b: Cross-reactivity map (used by checkAllergyConflict) ----
// Maps a SEED drug class/drug to other drug classes that share clinical cross-reactivity.
// 'none' means no cross-reactivity (the allergy object type-matches only its own members).
// Used by index.html to flag SOFT vs HARD matches at order-place and MAR-admin.
const CROSS_REACTIVITY_MAP = {
    'Penicillin':      { crossClass: ['Cephalosporins'], crossRate: 0.02, note: 'PCN→ceph cross-reactivity ~1-2% per current evidence (down from old 10% teaching).' },
    'Sulfa':           { crossClass: [],                 crossRate: 0,    note: 'Sulfa-abx allergy does NOT cross-react with sulfa-containing non-abx (furosemide, thiazides).' },
    'Aspirin':         { crossClass: ['NSAIDs'],         crossRate: 0.2,  note: 'ASA→NSAID cross-reactivity common (Samter\'s triad, esp. asthma + nasal polyps).' },
    'NSAIDs':          { crossClass: ['Aspirin'],        crossRate: 0.2 },
    'Codeine':         { crossClass: ['Opioids'],        crossRate: 0.1,  note: 'Intolerance, not true allergy. Other opioids often tolerated.' },
    'Morphine':        { crossClass: ['Opioids'],        crossRate: 0.3,  note: 'Histamine release common across morphine, codeine, meperidine. Hydromorphone/fentanyl usually tolerated.' },
    'ACE inhibitors':  { crossClass: [],                 crossRate: 0,    note: 'ARBs do NOT cross-react with ACEi. Switch is safe.' },
    'Iodine':          { crossClass: ['Contrast'],       crossRate: 0.5,  note: 'True iodine allergy is rare; usually refers to contrast or povidone-iodine (different mechanisms).' },
    'Eggs':            { crossClass: [],                 crossRate: 0,    note: 'Propofol contains egg lecithin but true anaphylaxis rare; many allergists clear with caution.' }
};

// ---- Phase 3A.5b: Drug → drug class map ----
// Maps a specific medication to its drug class(es) for cross-reactivity checks at order-place.
// Not exhaustive — covers meds used in current seed + common CPOE entries.
const DRUG_CLASS_MAP = {
    // Penicillins
    'amoxicillin':     ['Penicillin'],
    'ampicillin':      ['Penicillin'],
    'piperacillin-tazobactam': ['Penicillin'],
    'piperacillin':    ['Penicillin'],
    'nafcillin':       ['Penicillin'],
    'oxacillin':       ['Penicillin'],
    // Cephalosporins
    'cefazolin':       ['Cephalosporins'],
    'ceftriaxone':     ['Cephalosporins'],
    'cefepime':        ['Cephalosporins'],
    'cephalexin':      ['Cephalosporins'],
    // Sulfa abx
    'trimethoprim-sulfamethoxazole': ['Sulfa'],
    'bactrim':         ['Sulfa'],
    'sulfamethoxazole': ['Sulfa'],
    // NSAIDs / ASA
    'aspirin':         ['Aspirin', 'NSAIDs'],
    'ibuprofen':       ['NSAIDs'],
    'naproxen':        ['NSAIDs'],
    'ketorolac':       ['NSAIDs'],
    // Opioids
    'morphine':        ['Opioids', 'Morphine'],
    'hydromorphone':   ['Opioids'],
    'fentanyl':        ['Opioids'],
    'oxycodone':       ['Opioids'],
    'codeine':         ['Opioids', 'Codeine'],
    // ACE / ARB
    'lisinopril':      ['ACE inhibitors'],
    'enalapril':       ['ACE inhibitors'],
    'ramipril':        ['ACE inhibitors'],
    'losartan':        ['ARB'],
    'valsartan':       ['ARB'],
    // Heparins / anticoag
    'heparin':         ['Heparin'],
    'enoxaparin':      ['Heparin'],
    // Statins
    'atorvastatin':    ['Statins'],
    'simvastatin':     ['Statins'],
    'rosuvastatin':    ['Statins'],
    // Propofol (eggs)
    'propofol':        ['Eggs']
};

// Helper: expand a string allergy to the full object form.
// Used by the seeder when writing patient records to Firebase.
function expandAllergy(raw) {
    if (typeof raw !== 'string') return raw; // already an object
    const reac = ALLERGY_REACTION_MAP[raw] || { type: 'drug', reaction: 'Unknown', severity: 'unknown' };
    return Object.assign({ substance: raw }, reac);
}

// Helper: ISO day N days ago (for plausible prior-encounter dates)
function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}
function daysAgoTS(n, hour) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour || 8, 0, 0, 0);
    return d.getTime();
}

// =========================================================
// CURRENTLY ADMITTED PATIENTS (18)
// Each has patient record + active encounter. Some also have
// a prior completed encounter attached.
// =========================================================
const SEED_PATIENTS = [
    // ===== ED =====
    {
        id: 'p_marcus_webb',
        name: 'Marcus Webb', sex: 'M', age: 34, dob: '1991-08-12',
        mrn: 'SIM-10001', allergies: ['NKDA'],
        pmh: 'HTN, hyperlipidemia, former smoker (quit 2023)',
        homeMedications: [
            { med: 'Atorvastatin', dose: '40 mg', route: 'PO', freq: 'Daily' },
            { med: 'Lisinopril',   dose: '10 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Former smoker (20 pack-yr, quit 2023). Social ETOH. Denies illicits. Construction worker.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-01',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(0, 14),
            md: 'Dr. Avery Chen, MD-SIM', dx: 'Chest pain — r/o ACS',
            chiefComplaint: 'Substernal chest pressure x 2h, radiates to L arm',
            esiAcuity: 2, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'NPO until r/o', activity: 'Bed rest',
            ivAccess: '20g L AC', acuity: 4, isolation: null, fallRisk: false, dnr: false,
            weightKg: 88, heightIn: 71
        }
    },
    {
        id: 'p_amara_diallo',
        name: 'Amara Diallo', sex: 'F', age: 22, dob: '2003-11-04',
        mrn: 'SIM-10002', allergies: ['NKDA'],
        pmh: 'Moderate persistent asthma (dx age 8). Three prior ED visits in past year.',
        homeMedications: [
            { med: 'Fluticasone/Salmeterol', dose: '250/50', route: 'INH', freq: 'BID' },
            { med: 'Albuterol HFA',           dose: '2 puffs', route: 'INH', freq: 'PRN SOB' }
        ],
        socialHx: 'College student. Non-smoker. Denies ETOH/illicits.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-02',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(0, 10),
            md: 'Dr. Avery Chen, MD-SIM', dx: 'Acute asthma exacerbation',
            chiefComplaint: 'Acute SOB + wheezing, unrelieved by home albuterol x 3 puffs',
            esiAcuity: 3, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
            ivAccess: '22g R hand', acuity: 3, isolation: null, fallRisk: false, dnr: false,
            weightKg: 62, heightIn: 65
        }
    },
    {
        id: 'p_leonard_kowalski',
        name: 'Leonard Kowalski', sex: 'M', age: 67, dob: '1958-05-23',
        mrn: 'SIM-10003', allergies: ['Aspirin'],
        pmh: 'HTN, T2DM, hyperlipidemia, AFib on warfarin. Prior stroke 2019 with mild L-sided weakness residual.',
        homeMedications: [
            { med: 'Warfarin',     dose: '5 mg',    route: 'PO', freq: 'Daily',
              holdStatus: 'held', holdReason: 'Hold pending neuro imaging and INR. Resume per neurology.' },
            { med: 'Metformin',    dose: '1000 mg', route: 'PO', freq: 'BID' },
            { med: 'Atorvastatin', dose: '80 mg',   route: 'PO', freq: 'Daily' },
            { med: 'Lisinopril',   dose: '20 mg',   route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Retired accountant. Non-smoker x 30 yr. Social ETOH 1-2 drinks/week.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-03',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(0, 9),
            md: 'Dr. Sora Patel, MD-SIM', dx: 'TIA / r/o CVA',
            chiefComplaint: 'Transient R-sided weakness + word-finding difficulty x 20 min, resolved',
            esiAcuity: 2, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'NPO pending swallow eval', activity: 'Bed rest',
            ivAccess: '20g L AC', acuity: 4, isolation: null, fallRisk: true, dnr: false,
            weightKg: 84, heightIn: 70
        },
        priorEncounter: {
            unit: 'MS', bed: 'MS-05',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(180, 13),
            dischargeDate: daysAgoTS(173, 11), dischargeDisposition: 'home',
            dischargeReason: 'AFib with RVR, rate controlled on metoprolol. Discharged on warfarin with INR target 2-3.',
            md: 'Dr. Sora Patel, MD-SIM', dx: 'AFib with RVR',
            chiefComplaint: 'Palpitations + SOB, HR 140s on arrival', esiAcuity: 2, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'Cardiac', activity: 'As tolerated',
            ivAccess: '20g L AC', acuity: 3, isolation: null, fallRisk: false, dnr: false
        }
    },
    {
        id: 'p_sofia_reyes',
        name: 'Sofia Reyes', sex: 'F', age: 28, dob: '1997-02-19',
        mrn: 'SIM-10004', allergies: ['Penicillin', 'Latex'],
        pmh: 'Unremarkable. G1P0 (prior SAB 2021).',
        homeMedications: [{ med: 'Multivitamin', dose: '1 tab', route: 'PO', freq: 'Daily' }],
        socialHx: 'Teacher. Non-smoker. Rare ETOH.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-04',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(0, 7),
            md: 'Dr. Maya Lin, MD-SIM', dx: 'Acute appendicitis — pre-op',
            chiefComplaint: 'RLQ pain + N/V since last night, worsening',
            esiAcuity: 3, arrivalMode: 'POV',
            codeStatus: 'Full Code', diet: 'NPO', activity: 'Bed rest',
            ivAccess: '18g L AC', acuity: 3, isolation: null, fallRisk: false, dnr: false,
            weightKg: 64, heightIn: 64
        }
    },
    {
        id: 'p_thomas_brandt',
        name: 'Thomas Brandt', sex: 'M', age: 78, dob: '1947-09-30',
        mrn: 'SIM-10005', allergies: ['Codeine'],
        pmh: 'HTN, BPH, osteoarthritis, mild cognitive impairment. Lives with spouse (primary caregiver).',
        homeMedications: [
            { med: 'Tamsulosin',    dose: '0.4 mg', route: 'PO', freq: 'Daily at bedtime' },
            { med: 'Amlodipine',    dose: '5 mg',   route: 'PO', freq: 'Daily' },
            { med: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Q6H PRN pain' }
        ],
        socialHx: 'Retired teacher. Never smoker. Rare ETOH.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-05',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(0, 11),
            md: 'Dr. Maya Lin, MD-SIM', dx: 'Right hip fracture — pending OR',
            chiefComplaint: 'Mechanical fall at home, unable to bear weight on R leg',
            esiAcuity: 2, arrivalMode: 'EMS',
            codeStatus: 'DNR', diet: 'NPO', activity: 'Bed rest',
            ivAccess: '20g L hand', acuity: 4, isolation: null, fallRisk: true, dnr: true,
            weightKg: 76, heightIn: 69
        },
        priorEncounter: {
            unit: 'MS', bed: 'MS-03',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(90, 10),
            dischargeDate: daysAgoTS(87, 11), dischargeDisposition: 'home',
            dischargeReason: 'Syncope — likely orthostatic. Med reconciliation completed, amlodipine dose reduced.',
            md: 'Dr. Maya Lin, MD-SIM', dx: 'Syncope, NOS',
            codeStatus: 'DNR', diet: 'Cardiac', activity: 'As tolerated',
            ivAccess: 'SL L hand', acuity: 2, isolation: null, fallRisk: true, dnr: true
        }
    },
    {
        id: 'p_priya_kapoor',
        name: 'Priya Kapoor', sex: 'F', age: 44, dob: '1981-07-15',
        mrn: 'SIM-10006', allergies: ['Sulfa'],
        pmh: 'Recurrent UTIs, T2DM on oral agents.',
        homeMedications: [
            { med: 'Metformin',  dose: '500 mg', route: 'PO', freq: 'BID' },
            { med: 'Nitrofurantoin', dose: '100 mg', route: 'PO', freq: 'Daily suppression' }
        ],
        socialHx: 'IT consultant. Non-smoker. Occasional ETOH.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-06',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(0, 6),
            md: 'Dr. Avery Chen, MD-SIM', dx: 'Sepsis — UTI source',
            chiefComplaint: 'Fever, flank pain, confusion — 2 days',
            esiAcuity: 1, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
            ivAccess: '18g R AC, 20g L AC', acuity: 5, isolation: null, fallRisk: false, dnr: false,
            weightKg: 70, heightIn: 64
        }
    },
    {
        id: 'p_james_holloway',
        name: 'James Holloway', sex: 'M', age: 52, dob: '1973-12-08',
        mrn: 'SIM-10007', allergies: ['NKDA'],
        pmh: 'ETOH use disorder. Prior episode pancreatitis 2024.',
        homeMedications: [{ med: 'Thiamine', dose: '100 mg', route: 'PO', freq: 'Daily' }],
        socialHx: 'Daily ETOH 6-8 drinks. Former smoker. Construction.',
        currentEncounter: {
            unit: 'ED', bed: 'ED-07',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(0, 8),
            md: 'Dr. Sora Patel, MD-SIM', dx: 'Acute pancreatitis',
            chiefComplaint: 'Severe epigastric pain radiating to back, N/V x 12h',
            esiAcuity: 2, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'NPO', activity: 'As tolerated',
            ivAccess: '18g R AC', acuity: 4, isolation: null, fallRisk: false, dnr: false,
            weightKg: 95, heightIn: 72
        },
        priorEncounter: {
            unit: 'MS', bed: 'MS-07',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(240, 19),
            dischargeDate: daysAgoTS(234, 10), dischargeDisposition: 'home',
            dischargeReason: 'Acute pancreatitis resolved. Pt declined ETOH counseling referral.',
            md: 'Dr. Sora Patel, MD-SIM', dx: 'Acute pancreatitis',
            codeStatus: 'Full Code', diet: 'Regular advanced', activity: 'As tolerated',
            ivAccess: 'SL R AC', acuity: 3, isolation: null, fallRisk: false, dnr: false
        }
    },

    // ===== Med-Surg =====
    {
        id: 'p_helen_cho',
        name: 'Helen Cho', sex: 'F', age: 61, dob: '1964-04-11',
        mrn: 'SIM-10008', allergies: ['NKDA'],
        pmh: 'Severe R knee osteoarthritis, HTN controlled, mild obesity (BMI 31).',
        homeMedications: [
            { med: 'Losartan', dose: '50 mg', route: 'PO', freq: 'Daily' },
            { med: 'Acetaminophen', dose: '1000 mg', route: 'PO', freq: 'Q6H PRN pain' }
        ],
        socialHx: 'Retired. Non-smoker. Social ETOH.',
        currentEncounter: {
            unit: 'MS', bed: 'MS-02',
            admissionSource: 'post-op', admissionDate: daysAgoTS(2, 14),
            md: 'Dr. Reuben Park, MD-SIM', dx: 'Post-op TKR right knee — POD #2',
            codeStatus: 'Full Code', diet: 'Regular',
            activity: 'OOB with PT, weight bearing as tolerated',
            ivAccess: 'Saline lock R hand', acuity: 3, isolation: null, fallRisk: true, dnr: false,
            weightKg: 72, heightIn: 63
        }
    },
    {
        id: 'p_robert_dimaggio',
        name: 'Robert DiMaggio', sex: 'M', age: 71, dob: '1954-06-26',
        mrn: 'SIM-10009', allergies: ['ACE inhibitors'],
        pmh: 'CHF (EF 30%), AFib, CKD stage 3, prior CABG 2015.',
        homeMedications: [
            { med: 'Carvedilol',    dose: '12.5 mg', route: 'PO', freq: 'BID' },
            { med: 'Losartan',      dose: '50 mg',   route: 'PO', freq: 'Daily',
              note: 'ARB \u2014 substituted for ACEi (ACE-i allergy, cough). ARBs do not cross-react.' },
            { med: 'Furosemide',    dose: '40 mg',   route: 'PO', freq: 'Daily' },
            { med: 'Spironolactone', dose: '25 mg',  route: 'PO', freq: 'Daily' },
            { med: 'Apixaban',      dose: '5 mg',    route: 'PO', freq: 'BID' }
        ],
        socialHx: 'Retired. Former smoker (40 pack-yr, quit 2010). No ETOH.',
        currentEncounter: {
            unit: 'MS', bed: 'MS-04',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(1, 22),
            md: 'Dr. Reuben Park, MD-SIM', dx: 'CHF exacerbation — fluid mgmt',
            chiefComplaint: 'SOB, 3-pillow orthopnea, LE edema worsening x 5 days',
            esiAcuity: 3, arrivalMode: 'EMS',
            codeStatus: 'DNR/DNI', diet: '2g sodium, 1500 mL fluid restriction',
            activity: 'OOB with assist', ivAccess: '22g L hand',
            acuity: 3, isolation: null, fallRisk: true, dnr: true,
            weightKg: 92, heightIn: 70
        },
        priorEncounter: {
            unit: 'ICU', bed: 'ICU-04',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(120, 3),
            dischargeDate: daysAgoTS(112, 15), dischargeDisposition: 'home',
            dischargeReason: 'CHF exacerbation resolved with IV diuresis. Fluid restriction reinforced.',
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'Acute on chronic CHF',
            codeStatus: 'DNR/DNI', diet: '2g sodium', activity: 'Bed rest',
            ivAccess: '20g R AC', acuity: 4, isolation: null, fallRisk: true, dnr: true
        }
    },
    {
        id: 'p_angela_freeman',
        name: 'Angela Freeman', sex: 'F', age: 38, dob: '1987-03-02',
        mrn: 'SIM-10010', allergies: ['NKDA'],
        pmh: 'T1DM (dx age 12), frequent DKA episodes. Endocrinology follow-up.',
        homeMedications: [
            { med: 'Insulin Glargine', dose: '24 units', route: 'SubQ', freq: 'Daily at bedtime' },
            { med: 'Insulin Lispro',   dose: 'Per carb counting', route: 'SubQ', freq: 'AC + HS' }
        ],
        socialHx: 'Graphic designer. Non-smoker. Rare ETOH.',
        currentEncounter: {
            unit: 'MS', bed: 'MS-06',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(1, 18),
            md: 'Dr. Reuben Park, MD-SIM', dx: 'DKA resolving — insulin protocol',
            chiefComplaint: 'Polyuria, polydipsia, N/V. Glucose 480, ketones +',
            esiAcuity: 2, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Carb-controlled diabetic', activity: 'As tolerated',
            ivAccess: '18g L AC', acuity: 3, isolation: null, fallRisk: false, dnr: false,
            weightKg: 68, heightIn: 66
        }
    },
    {
        id: 'p_walter_huang',
        name: 'Walter Huang', sex: 'M', age: 83, dob: '1942-10-19',
        mrn: 'SIM-10011', allergies: ['Penicillin'],
        pmh: 'Dementia (moderate), dysphagia post-CVA 2022, recurrent aspiration PNA.',
        homeMedications: [
            { med: 'Donepezil',  dose: '10 mg', route: 'PO', freq: 'Daily at bedtime' },
            { med: 'Omeprazole', dose: '20 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Lives in memory-care facility. Former smoker (quit 1985).',
        currentEncounter: {
            unit: 'MS', bed: 'MS-09',
            admissionSource: 'transfer-from-facility', admissionDate: daysAgoTS(2, 16),
            md: 'Dr. Reuben Park, MD-SIM', dx: 'Aspiration pneumonia — dysphagia',
            codeStatus: 'DNR', diet: 'Pureed, thickened liquids (nectar)',
            activity: 'Bed rest', ivAccess: '20g R AC',
            acuity: 4, isolation: 'Droplet', fallRisk: true, dnr: true,
            weightKg: 66, heightIn: 67
        },
        priorEncounter: {
            unit: 'MS', bed: 'MS-08',
            admissionSource: 'transfer-from-facility', admissionDate: daysAgoTS(60, 14),
            dischargeDate: daysAgoTS(54, 11), dischargeDisposition: 'transferred-out',
            dischargeReason: 'Aspiration PNA resolved. Discharged back to memory-care facility.',
            md: 'Dr. Reuben Park, MD-SIM', dx: 'Aspiration pneumonia',
            codeStatus: 'DNR', diet: 'Pureed, thickened liquids', activity: 'Bed rest',
            ivAccess: '22g L hand', acuity: 3, isolation: 'Droplet', fallRisk: true, dnr: true
        }
    },

    // ===== ICU =====
    {
        id: 'p_dorothy_nguyen',
        name: 'Dorothy Nguyen', sex: 'F', age: 76, dob: '1949-01-14',
        mrn: 'SIM-10012', allergies: ['Sulfa'],
        pmh: 'Severe COPD (GOLD stage III), home O2 2L, cor pulmonale, former smoker.',
        homeMedications: [
            { med: 'Tiotropium',  dose: '1 cap',  route: 'INH', freq: 'Daily' },
            { med: 'Fluticasone', dose: '250 mcg', route: 'INH', freq: 'BID' },
            { med: 'Albuterol HFA', dose: '2 puffs', route: 'INH', freq: 'Q4H PRN' }
        ],
        socialHx: 'Retired. Former smoker (60 pack-yr, quit 2018 at CVA dx).',
        currentEncounter: {
            unit: 'ICU', bed: 'ICU-01',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(1, 4),
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'COPD — hypercapnic resp failure on BiPAP',
            chiefComplaint: 'Severe SOB, AMS, ABG pH 7.22 PaCO2 78',
            esiAcuity: 1, arrivalMode: 'EMS',
            codeStatus: 'DNR/DNI', diet: 'NPO (BiPAP)',
            activity: 'Bed rest, HOB 30°', ivAccess: 'Triple-lumen R IJ',
            acuity: 5, isolation: null, fallRisk: false, dnr: true,
            weightKg: 58, heightIn: 62
        },
        priorEncounter: {
            unit: 'PCU', bed: 'PCU-04',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(150, 5),
            dischargeDate: daysAgoTS(142, 14), dischargeDisposition: 'home',
            dischargeReason: 'COPD exacerbation resolved with steroids + abx. Home O2 unchanged.',
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'COPD exacerbation',
            codeStatus: 'DNR/DNI', diet: 'Regular', activity: 'As tolerated with O2',
            ivAccess: '20g L AC', acuity: 4, isolation: null, fallRisk: false, dnr: true
        }
    },
    {
        id: 'p_miguel_torres',
        name: 'Miguel Torres', sex: 'M', age: 58, dob: '1967-05-29',
        mrn: 'SIM-10013', allergies: ['NKDA'],
        pmh: 'HTN, hyperlipidemia, family hx of early CAD. Never smoker.',
        homeMedications: [
            { med: 'Atorvastatin', dose: '40 mg', route: 'PO', freq: 'Daily' },
            { med: 'Lisinopril',   dose: '10 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Small business owner. Non-smoker. Moderate ETOH (wine w/ dinner).',
        currentEncounter: {
            unit: 'ICU', bed: 'ICU-03',
            admissionSource: 'ED-EMS', admissionDate: daysAgoTS(0, 3),
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'STEMI s/p PCI — cardiac monitoring',
            chiefComplaint: 'Crushing substernal chest pain, STEMI on EMS 12-lead',
            esiAcuity: 1, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'Cardiac (low-sodium, low-fat)',
            activity: 'Bed rest x 24h', ivAccess: '18g R AC, A-line L radial',
            acuity: 5, isolation: null, fallRisk: false, dnr: false,
            weightKg: 88, heightIn: 70
        }
    },
    {
        id: 'p_rachel_okonkwo',
        name: 'Rachel Okonkwo', sex: 'F', age: 31, dob: '1994-08-22',
        mrn: 'SIM-10014', allergies: ['NKDA'],
        pmh: 'G2P1 pre-pregnancy unremarkable. Severe preeclampsia diagnosed 37w.',
        homeMedications: [{ med: 'Prenatal vitamin', dose: '1 tab', route: 'PO', freq: 'Daily' }],
        socialHx: 'Attorney. Non-smoker. No ETOH during pregnancy.',
        currentEncounter: {
            unit: 'ICU', bed: 'ICU-07',
            admissionSource: 'post-op', admissionDate: daysAgoTS(0, 2),
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'Eclampsia, postpartum — Mag drip',
            codeStatus: 'Full Code', diet: 'Clear liquids',
            activity: 'Bed rest, seizure precautions', ivAccess: '18g R AC, 18g L AC',
            acuity: 5, isolation: null, fallRisk: true, dnr: false,
            weightKg: 78, heightIn: 65
        }
    },

    // ===== PCU =====
    {
        id: 'p_denise_abara',
        name: 'Denise Abara', sex: 'F', age: 66, dob: '1959-09-17',
        mrn: 'SIM-10015', allergies: ['Heparin'],
        pmh: 'Triple-vessel CAD, T2DM, HTN. Multiple cath lab visits prior.',
        homeMedications: [
            { med: 'Metformin',    dose: '500 mg', route: 'PO', freq: 'BID' },
            { med: 'Atorvastatin', dose: '40 mg',  route: 'PO', freq: 'Daily' },
            { med: 'Aspirin',      dose: '81 mg',  route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Retired teacher. Non-smoker. No ETOH.',
        currentEncounter: {
            unit: 'PCU', bed: 'PCU-02',
            admissionSource: 'post-op', admissionDate: daysAgoTS(3, 9),
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'Post-CABG POD #3 — step-down',
            codeStatus: 'Full Code', diet: 'Cardiac',
            activity: 'OOB with assist', ivAccess: 'Saline lock L hand',
            acuity: 3, isolation: null, fallRisk: true, dnr: false,
            weightKg: 80, heightIn: 64
        }
    },
    {
        id: 'p_frank_ostrowski',
        name: 'Frank Ostrowski', sex: 'M', age: 74, dob: '1951-11-03',
        mrn: 'SIM-10016', allergies: ['NSAIDs'],
        pmh: 'Severe COPD, home O2 3L, HTN, prior MI 2019.',
        homeMedications: [
            { med: 'Tiotropium',       dose: '1 cap',  route: 'INH', freq: 'Daily' },
            { med: 'Albuterol HFA',    dose: '2 puffs', route: 'INH', freq: 'Q4H PRN' },
            { med: 'Metoprolol Succinate', dose: '50 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Retired mechanic. Former smoker (80 pack-yr, quit at MI).',
        currentEncounter: {
            unit: 'PCU', bed: 'PCU-06',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(2, 13),
            md: 'Dr. Reuben Park, MD-SIM', dx: 'COPD — O2 weaning, ambulation log',
            codeStatus: 'DNR', diet: 'Regular',
            activity: 'Ambulate q4h with O2', ivAccess: 'Saline lock R hand',
            acuity: 3, isolation: null, fallRisk: true, dnr: true,
            weightKg: 71, heightIn: 68
        }
    },

    // ===== OB / L&D =====
    {
        id: 'p_kezia_williams',
        name: 'Kezia Williams', sex: 'F', age: 29, dob: '1996-06-12',
        mrn: 'SIM-10017', allergies: ['NKDA'],
        pmh: 'G2P1 — prior uncomplicated NSVD 2023. Current pregnancy uncomplicated.',
        homeMedications: [{ med: 'Prenatal vitamin', dose: '1 tab', route: 'PO', freq: 'Daily' }],
        socialHx: 'Marketing manager. Non-smoker. No ETOH in pregnancy.',
        currentEncounter: {
            unit: 'OB', bed: 'OB-01',
            admissionSource: 'ED-walkin', admissionDate: daysAgoTS(0, 4),
            md: 'Dr. Sora Patel, MD-SIM', dx: 'Active labor G2P1, oxytocin protocol',
            chiefComplaint: 'Regular contractions q3min, SROM at home 2h ago',
            esiAcuity: 3, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Clear liquids / ice chips',
            activity: 'Bed/ambulation per provider', ivAccess: '18g L AC',
            acuity: 4, isolation: null, fallRisk: false, dnr: false,
            weightKg: 82, heightIn: 67
        }
    },
    {
        id: 'p_natalie_chen',
        name: 'Natalie Chen', sex: 'F', age: 33, dob: '1992-12-30',
        mrn: 'SIM-10018', allergies: ['NKDA'],
        pmh: 'G1P1. Uncomplicated pregnancy, delivered 2026-04-15.',
        homeMedications: [],
        socialHx: 'Software engineer. Non-smoker. No ETOH.',
        currentEncounter: {
            unit: 'OB', bed: 'OB-04',
            admissionSource: 'post-op', admissionDate: daysAgoTS(1, 6),
            md: 'Dr. Sora Patel, MD-SIM', dx: 'Postpartum POD #1 — fundus/lochia q4h',
            codeStatus: 'Full Code', diet: 'Regular',
            activity: 'OOB ad lib', ivAccess: 'Saline lock R hand',
            acuity: 2, isolation: null, fallRisk: false, dnr: false,
            weightKg: 70, heightIn: 65
        }
    }
];

// =========================================================
// UNADMITTED PATIENTS (10) — have a past but no active encounter
// Appear in Patient Search → "All Patients". Can be selected
// on ED arrival / Admit to create a NEW encounter.
// =========================================================
const SEED_UNADMITTED_PATIENTS = [
    {
        id: 'p_olivia_smith',
        name: 'Olivia Smith', sex: 'F', age: 45, dob: '1980-03-22',
        mrn: 'SIM-20001', allergies: ['Penicillin'],
        pmh: 'Migraine with aura, HTN, hypothyroidism.',
        homeMedications: [
            { med: 'Levothyroxine', dose: '75 mcg', route: 'PO', freq: 'Daily' },
            { med: 'Lisinopril',    dose: '10 mg',  route: 'PO', freq: 'Daily' },
            { med: 'Sumatriptan',   dose: '50 mg',  route: 'PO', freq: 'PRN migraine' }
        ],
        socialHx: 'Accountant. Non-smoker. Rare ETOH.',
        priorEncounters: [{
            unit: 'MS', bed: 'MS-05', admissionSource: 'ED-walkin',
            admissionDate: daysAgoTS(45, 11), dischargeDate: daysAgoTS(42, 13),
            dischargeDisposition: 'home',
            dischargeReason: 'Status migrainosus resolved with IV treatment. Discharged on preventive therapy.',
            md: 'Dr. Sora Patel, MD-SIM', dx: 'Status migrainosus',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
            ivAccess: '20g L hand', acuity: 3, fallRisk: false, dnr: false
        }]
    },
    {
        id: 'p_david_park',
        name: 'David Park', sex: 'M', age: 52, dob: '1972-10-08',
        mrn: 'SIM-20002', allergies: ['NKDA'],
        pmh: 'T2DM, hyperlipidemia, sleep apnea on CPAP.',
        homeMedications: [
            { med: 'Metformin',    dose: '1000 mg', route: 'PO', freq: 'BID' },
            { med: 'Atorvastatin', dose: '40 mg',   route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Engineer. Non-smoker. Social ETOH.',
        priorEncounters: [
            {
                unit: 'MS', bed: 'MS-02', admissionSource: 'ED-walkin',
                admissionDate: daysAgoTS(30, 15), dischargeDate: daysAgoTS(27, 10),
                dischargeDisposition: 'home',
                dischargeReason: 'Hyperglycemia corrected. Insulin regimen initiated.',
                md: 'Dr. Reuben Park, MD-SIM', dx: 'Hyperglycemic emergency',
                codeStatus: 'Full Code', diet: 'Diabetic', activity: 'As tolerated',
                ivAccess: '20g R AC', acuity: 3, fallRisk: false, dnr: false
            },
            {
                unit: 'ED', bed: 'ED-03', admissionSource: 'ED-walkin',
                admissionDate: daysAgoTS(210, 20), dischargeDate: daysAgoTS(210, 23),
                dischargeDisposition: 'home',
                dischargeReason: 'Viral gastroenteritis. IV hydration provided. Discharged home.',
                md: 'Dr. Avery Chen, MD-SIM', dx: 'Viral gastroenteritis',
                chiefComplaint: 'N/V/D x 24h', esiAcuity: 4, arrivalMode: 'walk-in',
                codeStatus: 'Full Code', diet: 'Clear liquids', activity: 'As tolerated',
                ivAccess: '22g L hand', acuity: 2, fallRisk: false, dnr: false
            }
        ]
    },
    {
        id: 'p_maria_garcia',
        name: 'Maria Garcia', sex: 'F', age: 68, dob: '1957-02-14',
        mrn: 'SIM-20003', allergies: ['Shellfish', 'Iodine'],
        pmh: 'HTN, CKD stage 3, osteoarthritis.',
        homeMedications: [
            { med: 'Amlodipine',    dose: '10 mg',  route: 'PO', freq: 'Daily' },
            { med: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Q6H PRN' }
        ],
        socialHx: 'Retired nurse. Non-smoker. Rare ETOH.',
        priorEncounters: [{
            unit: 'MS', bed: 'MS-04', admissionSource: 'ED-EMS',
            admissionDate: daysAgoTS(75, 8), dischargeDate: daysAgoTS(70, 14),
            dischargeDisposition: 'rehab',
            dischargeReason: 'L hip fracture repair. Discharged to rehab for PT.',
            md: 'Dr. Maya Lin, MD-SIM', dx: 'L hip fracture s/p ORIF',
            chiefComplaint: 'Mechanical fall, L hip pain', esiAcuity: 3, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'WB-as-tolerated',
            ivAccess: 'SL L hand', acuity: 3, fallRisk: true, dnr: false
        }]
    },
    {
        id: 'p_tyler_mcallister',
        name: 'Tyler McAllister', sex: 'M', age: 24, dob: '2001-06-19',
        mrn: 'SIM-20004', allergies: ['NKDA'],
        pmh: 'Unremarkable. ACL tear (R) 2023 with surgical repair.',
        homeMedications: [],
        socialHx: 'Graduate student. Non-smoker. Moderate ETOH on weekends.',
        priorEncounters: [{
            unit: 'ED', bed: 'ED-04', admissionSource: 'ED-walkin',
            admissionDate: daysAgoTS(14, 2), dischargeDate: daysAgoTS(14, 6),
            dischargeDisposition: 'home',
            dischargeReason: 'Laceration repair, tetanus booster given. Wound care instructions provided.',
            md: 'Dr. Maya Lin, MD-SIM', dx: 'Hand laceration, repaired',
            chiefComplaint: 'Cut R hand on glass', esiAcuity: 4, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
            ivAccess: null, acuity: 1, fallRisk: false, dnr: false
        }]
    },
    {
        id: 'p_janet_washington',
        name: 'Janet Washington', sex: 'F', age: 59, dob: '1966-08-07',
        mrn: 'SIM-20005', allergies: ['Morphine'],
        pmh: 'Breast cancer (hx 2020, in remission), HTN, anxiety.',
        homeMedications: [
            { med: 'Tamoxifen',    dose: '20 mg', route: 'PO', freq: 'Daily' },
            { med: 'Sertraline',   dose: '50 mg', route: 'PO', freq: 'Daily' },
            { med: 'Losartan',     dose: '50 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Teacher. Non-smoker. No ETOH.',
        priorEncounters: [
            {
                unit: 'MS', bed: 'MS-06', admissionSource: 'direct-admit',
                admissionDate: daysAgoTS(100, 8), dischargeDate: daysAgoTS(96, 11),
                dischargeDisposition: 'home',
                dischargeReason: 'Mastectomy recovery uneventful. Drain teaching completed.',
                md: 'Dr. Maya Lin, MD-SIM', dx: 'Post-op mastectomy (prophylactic)',
                codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
                ivAccess: 'SL R hand', acuity: 3, fallRisk: false, dnr: false
            }
        ]
    },
    {
        id: 'p_benjamin_ortiz',
        name: 'Benjamin Ortiz', sex: 'M', age: 71, dob: '1954-11-25',
        mrn: 'SIM-20006', allergies: ['NKDA'],
        pmh: 'CAD s/p CABG 2020, AFib on apixaban, CKD stage 2.',
        homeMedications: [
            { med: 'Apixaban',     dose: '5 mg',    route: 'PO', freq: 'BID' },
            { med: 'Metoprolol Succinate', dose: '100 mg', route: 'PO', freq: 'Daily' },
            { med: 'Atorvastatin', dose: '80 mg',   route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Retired. Non-smoker. Rare ETOH.',
        priorEncounters: [{
            unit: 'PCU', bed: 'PCU-03', admissionSource: 'ED-EMS',
            admissionDate: daysAgoTS(60, 21), dischargeDate: daysAgoTS(55, 9),
            dischargeDisposition: 'home',
            dischargeReason: 'AFib with RVR, rate controlled. Cardiology follow-up in 2 weeks.',
            md: 'Dr. Lin Okafor, MD-SIM', dx: 'AFib with RVR',
            chiefComplaint: 'Palpitations + dyspnea', esiAcuity: 2, arrivalMode: 'EMS',
            codeStatus: 'Full Code', diet: 'Cardiac', activity: 'As tolerated',
            ivAccess: '20g L AC', acuity: 3, fallRisk: false, dnr: false
        }]
    },
    {
        id: 'p_chloe_richardson',
        name: 'Chloe Richardson', sex: 'F', age: 34, dob: '1991-04-03',
        mrn: 'SIM-20007', allergies: ['NKDA'],
        pmh: 'G3P2, asthma (well-controlled).',
        homeMedications: [
            { med: 'Prenatal vitamin', dose: '1 tab', route: 'PO', freq: 'Daily' },
            { med: 'Albuterol HFA',    dose: '2 puffs', route: 'INH', freq: 'PRN SOB' }
        ],
        socialHx: 'Stay-at-home parent. Non-smoker. No ETOH in pregnancy.',
        priorEncounters: [{
            unit: 'OB', bed: 'OB-03', admissionSource: 'ED-walkin',
            admissionDate: daysAgoTS(250, 3), dischargeDate: daysAgoTS(248, 14),
            dischargeDisposition: 'home',
            dischargeReason: 'NSVD, healthy female infant. Mother + baby stable.',
            md: 'Dr. Sora Patel, MD-SIM', dx: 'NSVD, term',
            chiefComplaint: 'Regular contractions q4min', esiAcuity: 3, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Clear liquids', activity: 'Bed/ambulation',
            ivAccess: '18g L AC', acuity: 3, fallRisk: false, dnr: false
        }]
    },
    {
        id: 'p_raymond_jenkins',
        name: 'Raymond Jenkins', sex: 'M', age: 63, dob: '1962-07-11',
        mrn: 'SIM-20008', allergies: ['Sulfa', 'Aspirin'],
        pmh: 'COPD, HTN, former smoker (50 pack-yr, quit 2020).',
        homeMedications: [
            { med: 'Tiotropium',  dose: '1 cap',  route: 'INH', freq: 'Daily' },
            { med: 'Amlodipine',  dose: '5 mg',   route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Retired mechanic. Former heavy smoker. No ETOH.',
        priorEncounters: [
            {
                unit: 'PCU', bed: 'PCU-05', admissionSource: 'ED-EMS',
                admissionDate: daysAgoTS(90, 4), dischargeDate: daysAgoTS(86, 12),
                dischargeDisposition: 'home',
                dischargeReason: 'COPD exacerbation resolved with steroids + abx.',
                md: 'Dr. Reuben Park, MD-SIM', dx: 'COPD exacerbation',
                chiefComplaint: 'Progressive SOB x 4 days', esiAcuity: 3, arrivalMode: 'EMS',
                codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
                ivAccess: '20g R AC', acuity: 3, fallRisk: false, dnr: false
            }
        ]
    },
    {
        id: 'p_emily_foster',
        name: 'Emily Foster', sex: 'F', age: 19, dob: '2006-01-30',
        mrn: 'SIM-20009', allergies: ['NKDA'],
        pmh: 'Unremarkable.',
        homeMedications: [{ med: 'Oral contraceptive', dose: '1 tab', route: 'PO', freq: 'Daily' }],
        socialHx: 'College student. Non-smoker. Binge ETOH on weekends.',
        priorEncounters: [{
            unit: 'ED', bed: 'ED-02', admissionSource: 'ED-walkin',
            admissionDate: daysAgoTS(21, 22), dischargeDate: daysAgoTS(22, 3),
            dischargeDisposition: 'home',
            dischargeReason: 'Alcohol intoxication, observation. Discharged with friend, stable.',
            md: 'Dr. Avery Chen, MD-SIM', dx: 'Alcohol intoxication',
            chiefComplaint: 'Excessive ETOH intake, vomiting', esiAcuity: 3, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'NPO', activity: 'Bed rest',
            ivAccess: '20g L hand', acuity: 2, fallRisk: true, dnr: false
        }]
    },
    {
        id: 'p_gordon_blake',
        name: 'Gordon Blake', sex: 'M', age: 55, dob: '1970-09-14',
        mrn: 'SIM-20010', allergies: ['NKDA'],
        pmh: 'HTN, hyperlipidemia, mild depression.',
        homeMedications: [
            { med: 'Lisinopril',   dose: '20 mg', route: 'PO', freq: 'Daily' },
            { med: 'Atorvastatin', dose: '20 mg', route: 'PO', freq: 'Daily' },
            { med: 'Sertraline',   dose: '100 mg', route: 'PO', freq: 'Daily' }
        ],
        socialHx: 'Sales rep. Non-smoker. Moderate ETOH.',
        priorEncounters: [{
            unit: 'ED', bed: 'ED-06', admissionSource: 'ED-walkin',
            admissionDate: daysAgoTS(7, 11), dischargeDate: daysAgoTS(7, 16),
            dischargeDisposition: 'home',
            dischargeReason: 'Low back strain. Conservative management, PT referral.',
            md: 'Dr. Maya Lin, MD-SIM', dx: 'Acute low back pain',
            chiefComplaint: 'Low back pain after lifting', esiAcuity: 4, arrivalMode: 'walk-in',
            codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated',
            ivAccess: null, acuity: 1, fallRisk: false, dnr: false
        }]
    }
];

// =========================================================
// Per-encounter chart data (vitals/notes/MAR/TAR)
// Keyed by slot: 'current' for active encounters, or index of
// prior encounter (0-indexed) for SEED_UNADMITTED_PATIENTS.
// For SEED_PATIENTS, 'current' has full data; 'prior' has a
// few sparse entries for verification of history feature.
//
// Shape: CHART_BY_PATIENT[patientId] = {
//   current: { vitals: [...], notes: [...], mar: [...], tar: [...] },
//   prior:   [{ vitals: [...], notes: [...], mar: [...], tar: [...] }, ...]
// }
// =========================================================
const CHART_BY_PATIENT = {
    p_marcus_webb: {
        current: {
            notes: [
                { type: 'narrative', authorRole: 'MD', by: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5,
                  body: 'ED admission note. 34 yo M with hx HTN, hyperlipidemia presenting with substernal chest pressure x 2h radiating to L arm, 7/10, diaphoresis. ECG shows nonspecific ST/T changes. Troponin pending. Started on ASA, started on heparin gtt pending ACS r/o. Cardiology consulted.' },
                { type: 'narrative', authorRole: 'RN',  by: 'ED triage RN (seeded)',  offsetH: -1.8,
                  body: 'Triage: CP 7/10 substernal, radiating L arm. Pallor +, diaphoretic. Applied O2 2L NC, cardiac monitor on. Pt anxious, wife at bedside.' }
            ],
            mar: [
                { medication: 'Aspirin', dose: '325 mg', route: 'PO', frequency: 'Once', scheduledTime: '1400', isPRN: false },
                { medication: 'Nitroglycerin', dose: '0.4 mg', route: 'SL', frequency: 'PRN chest pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Chest pain' },
                { medication: 'Atorvastatin', dose: '40 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false },
                { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false }
            ],
            tar: [
                { treatment: '12-lead ECG', frequency: 'Q4H x 24h', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'Continuous cardiac monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' }
            ]
        }
    },
    p_amara_diallo: {
        current: {
            mar: [
                { medication: 'Albuterol-Ipratropium Nebulizer', dose: '3 mL', route: 'NEB', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000', isPRN: false },
                { medication: 'Methylprednisolone', dose: '60 mg', route: 'IV', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
                { medication: 'Albuterol HFA', dose: '2 puffs', route: 'INH', frequency: 'PRN SOB', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Shortness of breath' }
            ],
            tar: [
                { treatment: 'Pulse oximetry monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Peak flow measurement', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
            ]
        }
    },
    p_leonard_kowalski: {
        current: {
            mar: [
                { medication: 'Warfarin', dose: '5 mg', route: 'PO', frequency: 'Daily', scheduledTime: '1800', isPRN: false, status: 'held', notes: 'Held per stroke protocol — awaiting CT head + INR result' },
                { medication: 'Atorvastatin', dose: '80 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false, status: 'held', notes: 'Held per stroke protocol' },
                { medication: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false, status: 'held', notes: 'Held — permissive HTN for cerebral perfusion' },
                { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain or fever' }
            ],
            tar: [
                { treatment: 'Neuro checks (NIHSS)', frequency: 'Q1H x 12h, then Q2H', scheduledTime: 'Q1H' },
                { treatment: 'Bedside swallow screen', frequency: 'Once before any PO', scheduledTime: '0900' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted from ED with AFib RVR. HR 138 on arrival. Started on IV diltiazem drip.' },
                { type: 'soap', offsetH: 48, body: 'S: Pt reports improved palpitations. O: HR 82, BP 128/76. A: AFib rate-controlled. P: Transition to PO metoprolol, plan for d/c tomorrow.' }
            ]
        }]
    },
    p_sofia_reyes: {
        current: {
            mar: [
                { medication: 'Cefazolin', dose: '2 g', route: 'IV', frequency: 'Pre-op once', scheduledTime: '0700', isPRN: false },
                { medication: 'Ondansetron', dose: '4 mg', route: 'IV', frequency: 'Q6H PRN N/V', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Nausea/vomiting' },
                { medication: 'Morphine', dose: '4 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' }
            ],
            tar: [
                { treatment: 'Pre-op skin prep', frequency: 'Once', scheduledTime: '0700' },
                { treatment: 'SCDs to bilateral lower extremities', frequency: 'Continuous', scheduledTime: 'Continuous' }
            ]
        }
    },
    p_thomas_brandt: {
        current: {
            mar: [
                { medication: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
                { medication: 'Enoxaparin', dose: '40 mg', route: 'SubQ', frequency: 'Daily', scheduledTime: '2000', isPRN: false },
                { medication: 'Hydromorphone', dose: '0.5 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' },
                { medication: 'Docusate Sodium', dose: '100 mg', route: 'PO', frequency: 'BID', scheduledTime: '0900,2100', isPRN: false }
            ],
            tar: [
                { treatment: 'SCDs to bilateral lower extremities', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Skin assessment / Braden', frequency: 'Q12H', scheduledTime: '0800,2000' },
                { treatment: 'Fall precautions: bed alarm, low bed', frequency: 'Continuous', scheduledTime: 'Continuous' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted via ED for syncope eval. Orthostatic on arrival.' },
                { type: 'soap', offsetH: 60, body: 'S: No further syncope. O: Orthostatics negative today. A: Likely medication-induced orthostatic hypotension. P: Reduce amlodipine to 2.5mg, d/c home with PCP f/u.' }
            ]
        }]
    },
    p_priya_kapoor: {
        current: {
            notes: [
                { type: 'narrative', authorRole: 'MD', by: 'Dr. Avery Chen, MD-SIM', offsetH: -4,
                  body: 'ED admission: 44 yo F w/ recurrent UTIs, T2DM, presenting with 2 days fever + flank pain + confusion. T 39.2, HR 128, BP 82/50, lactate pending. Sepsis likely, UTI source. Pip-tazo started, NS bolus x 1L, norepi initiated. ICU admit.' },
                { type: 'narrative', authorRole: 'RN', by: 'ED RN (seeded)', offsetH: -3.5,
                  body: 'VS unstable on arrival BP 82/50, HR 128, T 39.2. 2 PIVs established. Lactate drawn 4.1. Foley inserted per sepsis protocol. Family (husband) notified.' },
                { type: 'narrative', authorRole: 'SW', by: 'SW on-call (seeded)', offsetH: -1,
                  body: 'Met with husband at bedside. Two young children at home (6 and 8). Grandmother picking kids up from school. Husband coping but tearful — provided support, will follow up tomorrow.' }
            ],
            mar: [
                { medication: 'Piperacillin-Tazobactam', dose: '4.5 g', route: 'IV', frequency: 'Q8H', scheduledTime: '0800,1600,2400', isPRN: false },
                { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN fever', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Temp >38.5°C' },
                { medication: 'Norepinephrine drip', dose: '0.05 mcg/kg/min', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Lactated Ringer\'s', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
            ],
            tar: [
                { treatment: 'Hourly vitals + urine output', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'Foley catheter care', frequency: 'Q12H', scheduledTime: '0800,2000' },
                { treatment: 'Lactate level (lab draw)', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400' }
            ]
        }
    },
    p_james_holloway: {
        current: {
            mar: [
                { medication: 'Hydromorphone', dose: '1 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' },
                { medication: 'Ondansetron', dose: '4 mg', route: 'IV', frequency: 'Q6H PRN N/V', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Nausea/vomiting' },
                { medication: 'Pantoprazole', dose: '40 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Lactated Ringer\'s', dose: '150 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
            ],
            tar: [
                { treatment: 'Strict I&O', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'Lipase / amylase (lab)', frequency: 'Q12H', scheduledTime: '0600,1800' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted from ED with acute pancreatitis. Lipase 890. NPO, IVF, pain control.' },
                { type: 'soap', offsetH: 96, body: 'S: Pain 2/10 on PO oxy. O: Tolerating regular diet. A: Pancreatitis resolving. P: Discharge home today, PCP f/u, declined ETOH counseling.' }
            ]
        }]
    },
    p_helen_cho: {
        current: {
            notes: [
                { type: 'narrative', authorRole: 'MD', by: 'Dr. Reuben Park, MD-SIM', offsetH: -50,
                  body: 'Post-op note: elective R TKR, POD#0. Procedure without complication. Spinal anesthesia. EBL 250 mL. Pain controlled on PCA + oral regimen. Plan: early ambulation with PT, DVT ppx, pain mgmt, discharge planning.' },
                { type: 'narrative', authorRole: 'PT', by: 'PT Eval (seeded)', offsetH: -24,
                  body: 'PT eval POD#1: pt ambulated 20 ft with rolling walker, weight bearing as tolerated on R. Knee ROM 0-45 degrees passive. Pain 5/10 during activity, 3/10 at rest. Will progress to 90 deg flexion as tolerated. Goal: ambulate 100 ft by POD#3, home with outpt PT.' }
            ],
            mar: [
                { medication: 'Oxycodone', dose: '5 mg', route: 'PO', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >4/10' },
                { medication: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
                { medication: 'Enoxaparin', dose: '40 mg', route: 'SubQ', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Cefazolin', dose: '1 g', route: 'IV', frequency: 'Q8H x 24h post-op', scheduledTime: '0800,1600,2400', isPRN: false }
            ],
            tar: [
                { treatment: 'Surgical wound assessment + dressing change', frequency: 'Daily', scheduledTime: '0800' },
                { treatment: 'Knee CPM machine 30°→90° as tolerated', frequency: 'Q4H x 30min', scheduledTime: '0900,1300,1700,2100' },
                { treatment: 'SCDs to L lower extremity (R post-op)', frequency: 'Continuous when in bed', scheduledTime: 'Continuous' }
            ]
        }
    },
    p_robert_dimaggio: {
        current: {
            mar: [
                { medication: 'Furosemide', dose: '40 mg', route: 'IV', frequency: 'BID', scheduledTime: '0800,1600', isPRN: false },
                { medication: 'Carvedilol', dose: '12.5 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
                { medication: 'Losartan', dose: '50 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Spironolactone', dose: '25 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Potassium Chloride', dose: '20 mEq', route: 'PO', frequency: 'Daily', scheduledTime: '0900', isPRN: false }
            ],
            tar: [
                { treatment: 'Daily weight (same scale, same time)', frequency: 'Daily', scheduledTime: '0600' },
                { treatment: 'Strict I&O', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted to ICU with acute on chronic CHF. Diuresed aggressively.' },
                { type: 'soap', offsetH: 168, body: 'S: Breathing easier. O: Weight down 8 kg. A: CHF compensated. P: Transition to PO diuretics, d/c home.' }
            ]
        }]
    },
    p_angela_freeman: {
        current: {
            mar: [
                { medication: 'Insulin Regular drip', dose: 'Per DKA protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false,
                  notes: 'Titrate per ICU DKA protocol (BG target 150-200 while on drip)' },
                { medication: 'Insulin Lispro (sliding scale)', dose: 'Per scale', route: 'SubQ', frequency: 'AC + HS', scheduledTime: '0700,1130,1700,2100', isPRN: false,
                  status: 'held', notes: 'HELD while on insulin drip. Resume when drip transitioned off and pt tolerating PO.' },
                { medication: 'Potassium Chloride', dose: '20 mEq', route: 'IV', frequency: 'Q4H per protocol', scheduledTime: '0800,1200,1600,2000', isPRN: false },
                { medication: '0.9% Normal Saline', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false,
                  notes: 'Transition to D5\u00bdNS when BG drops <250 (per DKA protocol).' }
            ],
            tar: [
                { treatment: 'Bedside glucose check', frequency: 'Q1H until off drip', scheduledTime: 'Q1H' },
                { treatment: 'BMP / electrolytes (lab)', frequency: 'Q4H', scheduledTime: '0400,0800,1200,1600,2000' }
            ]
        }
    },
    p_walter_huang: {
        current: {
            mar: [
                { medication: 'Ceftriaxone', dose: '1 g', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Azithromycin', dose: '500 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Acetaminophen', dose: '650 mg', route: 'PR', frequency: 'Q6H PRN fever', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Temp >38.5°C' }
            ],
            tar: [
                { treatment: 'Oral suction + oral care', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'HOB ≥30° at all times', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Droplet precautions sign', frequency: 'Continuous', scheduledTime: 'Continuous' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted from memory-care facility with aspiration PNA.' },
                { type: 'soap', offsetH: 120, body: 'S: Per facility report pt improved. O: Afebrile x 48h. A: Aspiration PNA resolved. P: Return to facility with 7-day abx course.' }
            ]
        }]
    },
    p_dorothy_nguyen: {
        current: {
            mar: [
                { medication: 'Methylprednisolone', dose: '40 mg', route: 'IV', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
                { medication: 'Albuterol-Ipratropium Nebulizer', dose: '3 mL', route: 'NEB', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000', isPRN: false },
                { medication: 'Levofloxacin', dose: '750 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Pantoprazole', dose: '40 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false }
            ],
            tar: [
                { treatment: 'BiPAP settings check + mask seal', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'ABG (lab)', frequency: 'Q4H', scheduledTime: '0400,0800,1200,1600,2000,2400' },
                { treatment: 'Central line dressing assessment', frequency: 'Q12H', scheduledTime: '0800,2000' }
            ]
        },
        prior: [{
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted to PCU for COPD exacerbation. Home O2 2L NC.' },
                { type: 'soap', offsetH: 192, body: 'S: Pt ready for discharge. O: RA SpO2 92%. A: COPD back to baseline. P: D/c home on O2, PCP f/u in 1 week.' }
            ]
        }]
    },
    p_miguel_torres: {
        current: {
            mar: [
                { medication: 'Aspirin', dose: '81 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Ticagrelor', dose: '90 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
                { medication: 'Atorvastatin', dose: '80 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false },
                { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
                { medication: 'Heparin drip', dose: 'Per protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
            ],
            tar: [
                { treatment: 'Continuous telemetry', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'A-line zero + waveform check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'Femoral access site check', frequency: 'Q1H x 6h', scheduledTime: 'Q1H' },
                { treatment: 'aPTT (heparin protocol)', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400' }
            ]
        }
    },
    p_rachel_okonkwo: {
        current: {
            mar: [
                { medication: 'Magnesium Sulfate drip', dose: '2 g/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Labetalol', dose: '20 mg', route: 'IV', frequency: 'Q15min PRN SBP >160', scheduledTime: 'PRN', isPRN: true, prnIndication: 'SBP >160 mmHg' },
                { medication: 'Calcium Gluconate', dose: '1 g', route: 'IV', frequency: 'PRN Mg toxicity', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Mg toxicity / RR <12' }
            ],
            tar: [
                { treatment: 'Mag-tox check (DTRs, RR, U/O)', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'Strict I&O', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'Seizure precautions / padded rails', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Neuro check', frequency: 'Q1H', scheduledTime: 'Q1H' }
            ]
        }
    },
    p_denise_abara: {
        current: {
            mar: [
                { medication: 'Aspirin', dose: '81 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
                { medication: 'Furosemide', dose: '20 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >4/10' }
            ],
            tar: [
                { treatment: 'Sternal incision assessment', frequency: 'Q8H', scheduledTime: '0800,1600,2400' },
                { treatment: 'Telemetry', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Daily weight', frequency: 'Daily', scheduledTime: '0600' }
            ]
        }
    },
    p_frank_ostrowski: {
        current: {
            mar: [
                { medication: 'Tiotropium', dose: '1 cap', route: 'INH', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
                { medication: 'Albuterol HFA', dose: '2 puffs', route: 'INH', frequency: 'Q4H PRN', scheduledTime: 'PRN', isPRN: true, prnIndication: 'SOB or wheezing' },
                { medication: 'Prednisone', dose: '20 mg', route: 'PO', frequency: 'Daily x 5d', scheduledTime: '0800', isPRN: false }
            ],
            tar: [
                { treatment: 'O2 weaning trial — RA SpO2 check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'Ambulation log (distance + SpO2)', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
            ]
        }
    },
    p_kezia_williams: {
        current: {
            mar: [
                { medication: 'Oxytocin drip', dose: 'Per protocol (titrate to contractions)', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Lactated Ringer\'s', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Fentanyl', dose: '50 mcg', route: 'IV', frequency: 'Q1H PRN labor pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Labor pain' }
            ],
            tar: [
                { treatment: 'Continuous fetal monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' },
                { treatment: 'Cervical exam', frequency: 'Q2H or as indicated', scheduledTime: 'Q2H' },
                { treatment: 'Vital signs + contraction pattern', frequency: 'Q15min', scheduledTime: 'Q15min' }
            ]
        }
    },
    p_natalie_chen: {
        current: {
            mar: [
                { medication: 'Ibuprofen', dose: '600 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
                { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain or fever' },
                { medication: 'Docusate Sodium', dose: '100 mg', route: 'PO', frequency: 'BID', scheduledTime: '0900,2100', isPRN: false }
            ],
            tar: [
                { treatment: 'Fundus + lochia assessment', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'Perineal/peri-pad check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
                { treatment: 'Breastfeeding support / latch check', frequency: 'PRN', scheduledTime: 'PRN' }
            ]
        }
    }
};

// =========================================================
// ORDERS seed (Phase 3B) — diet/activity/consult/nursing/code-status
// orders per patient. Medication orders are AUTO-GENERATED at seed
// time from the patient's MAR items (one order per med), so this
// dictionary only contains the non-medication orders.
//
// Order shape:
//   { orderType, orderText, status, placedBy, placedAt (offsetH from admit),
//     orderEntry: 'CPOE'|'Verbal'|'Telephone'|'Protocol',
//     // type-specific fields
//     consultSpecialty, consultReason
//     dietType, dietSpecialInstructions
//     activityType, activitySpecialInstructions
//     vitalsFreq
//     nursingText
//     codeStatus, codeReason
//   }
// =========================================================
const SEED_ORDERS = {
    p_marcus_webb: [
        { orderType: 'consult', consultSpecialty: 'Cardiology', consultReason: 'Chest pain r/o ACS, troponin pending', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'NPO', dietSpecialInstructions: 'NPO until ACS r/o complete', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5, status: 'active' },
        { orderType: 'nursing', nursingText: 'Continuous cardiac monitoring; notify provider for chest pain or arrhythmia', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1.5, status: 'active' }
    ],
    p_amara_diallo: [
        { orderType: 'diet', dietType: 'Regular', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'activity', activityType: 'As tolerated', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'nursing', nursingText: 'Peak flow before & after each nebulizer treatment', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -1, status: 'active' }
    ],
    p_leonard_kowalski: [
        { orderType: 'consult', consultSpecialty: 'Neurology', consultReason: 'TIA r/o CVA — eval and recommendations', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'pending-ack' },
        { orderType: 'diet', dietType: 'NPO', dietSpecialInstructions: 'NPO until bedside swallow eval', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', activitySpecialInstructions: 'Fall precautions, bed alarm on', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'nursing', nursingText: 'Neuro checks (NIHSS) Q1H x 12h then Q2H', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'active' },
        { orderType: 'lab', testName: 'CT head without contrast, STAT', priority: 'STAT', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'pending-ack' },
        { orderType: 'lab', testName: 'INR, PT, PTT', priority: 'STAT', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'active' }
    ],
    p_sofia_reyes: [
        { orderType: 'consult', consultSpecialty: 'General Surgery', consultReason: 'Acute appendicitis — pre-op eval', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'NPO', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'nursing', nursingText: 'SCDs to bilateral lower extremities while in bed', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' }
    ],
    p_thomas_brandt: [
        { orderType: 'consult', consultSpecialty: 'Orthopedic Surgery', consultReason: 'R hip fracture — OR planning', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'acknowledged' },
        { orderType: 'consult', consultSpecialty: 'Anesthesia', consultReason: 'Pre-op eval, age 78 with DNR', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -1, status: 'pending-ack' },
        { orderType: 'diet', dietType: 'NPO', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', activitySpecialInstructions: 'Fall precautions, bed alarm on, low bed', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'code-status', codeStatus: 'DNR', codeReason: 'Patient and family wishes documented', orderEntry: 'CPOE', placedBy: 'Dr. Maya Lin, MD-SIM', offsetH: -2, status: 'active' }
    ],
    p_priya_kapoor: [
        { orderType: 'consult', consultSpecialty: 'Critical Care', consultReason: 'Septic shock — ICU transfer when bed available', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'NPO', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q15min', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'nursing', nursingText: 'Hourly UO; notify provider if UO <30 mL/hr or MAP <65', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'lab', testName: 'Lactate', priority: 'STAT, repeat Q6H', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'lab', testName: 'Blood cultures x 2', priority: 'STAT', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'lab', testName: 'UA + urine culture', priority: 'STAT', orderEntry: 'CPOE', placedBy: 'Dr. Avery Chen, MD-SIM', offsetH: -3, status: 'active' }
    ],
    p_james_holloway: [
        { orderType: 'consult', consultSpecialty: 'Gastroenterology', consultReason: 'Acute pancreatitis — eval', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -2, status: 'pending-ack' },
        { orderType: 'consult', consultSpecialty: 'Social Work', consultReason: 'ETOH use disorder — counseling, declined previously', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -1, status: 'pending-ack' },
        { orderType: 'diet', dietType: 'NPO', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'activity', activityType: 'As tolerated', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'nursing', nursingText: 'Strict I&O', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -2, status: 'active' }
    ],
    p_helen_cho: [
        { orderType: 'consult', consultSpecialty: 'Physical Therapy', consultReason: 'Post-op TKR POD#2 — gait training, weight bearing as tolerated', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -48, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'Regular', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -48, status: 'active' },
        { orderType: 'activity', activityType: 'OOB with PT', activitySpecialInstructions: 'Weight bearing as tolerated R LE', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -48, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -48, status: 'active' },
        { orderType: 'nursing', nursingText: 'CPM machine 30°→90° as tolerated, Q4H x 30min', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -48, status: 'active' }
    ],
    p_robert_dimaggio: [
        { orderType: 'consult', consultSpecialty: 'Cardiology', consultReason: 'CHF exacerbation — meds optimization', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'acknowledged' },
        { orderType: 'diet', dietType: '2g sodium', dietSpecialInstructions: '1500 mL fluid restriction', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'active' },
        { orderType: 'activity', activityType: 'OOB with assist', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'active' },
        { orderType: 'nursing', nursingText: 'Daily weight (same scale, same time, AM); strict I&O', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'active' },
        { orderType: 'code-status', codeStatus: 'DNR/DNI', codeReason: 'Patient wishes; documented advance directive', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -22, status: 'active' }
    ],
    p_angela_freeman: [
        { orderType: 'consult', consultSpecialty: 'Endocrinology', consultReason: 'DKA — diabetes management, transition planning', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'pending-ack' },
        { orderType: 'diet', dietType: 'Carb-controlled diabetic', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'active' },
        { orderType: 'activity', activityType: 'As tolerated', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'active' },
        { orderType: 'nursing', nursingText: 'Bedside glucose Q1H while on insulin drip; Q2H once on subcutaneous', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'active' },
        { orderType: 'lab', testName: 'BMP + electrolytes', priority: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -18, status: 'active' }
    ],
    p_walter_huang: [
        { orderType: 'consult', consultSpecialty: 'Speech-Language Pathology', consultReason: 'Post-CVA dysphagia, recurrent aspiration — eval and recommendations', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -16, status: 'acknowledged' },
        { orderType: 'consult', consultSpecialty: 'Palliative Care', consultReason: 'Goals of care, recurrent admissions, advanced dementia', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -8, status: 'pending-ack' },
        { orderType: 'diet', dietType: 'Pureed, thickened liquids (nectar)', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -16, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest', activitySpecialInstructions: 'HOB ≥30° at all times, fall precautions', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -16, status: 'active' },
        { orderType: 'nursing', nursingText: 'Droplet precautions; oral suction Q4H; oral care Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -16, status: 'active' },
        { orderType: 'code-status', codeStatus: 'DNR', codeReason: 'POA decision; documented advance directive', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -16, status: 'active' }
    ],
    p_dorothy_nguyen: [
        { orderType: 'consult', consultSpecialty: 'Pulmonology', consultReason: 'Hypercapnic respiratory failure on BiPAP', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'NPO (BiPAP)', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest, HOB 30°', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q15min until stable, then Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' },
        { orderType: 'nursing', nursingText: 'BiPAP settings: IPAP 14, EPAP 5, FiO2 40%; check mask seal Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' },
        { orderType: 'lab', testName: 'ABG', priority: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' },
        { orderType: 'code-status', codeStatus: 'DNR/DNI', codeReason: 'Patient and family wishes', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -4, status: 'active' }
    ],
    p_miguel_torres: [
        { orderType: 'consult', consultSpecialty: 'Cardiology', consultReason: 'STEMI s/p PCI — post-cath management', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'Cardiac (low-sodium, low-fat)', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest x 24h', activitySpecialInstructions: 'HOB <30° to protect femoral access site', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q15min x 4, then Q30min x 4, then Q1H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'nursing', nursingText: 'Femoral site check Q15min x 1h, then Q1H x 6h, then Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'lab', testName: 'aPTT', priority: 'Q6H (heparin protocol)', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'lab', testName: 'Troponin', priority: 'Q6H x 3', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -3, status: 'active' }
    ],
    p_rachel_okonkwo: [
        { orderType: 'consult', consultSpecialty: 'OB/MFM', consultReason: 'Eclampsia postpartum — co-management', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -2, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'Clear liquids', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'activity', activityType: 'Bed rest, seizure precautions', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q1H + DTRs + RR', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -2, status: 'active' },
        { orderType: 'nursing', nursingText: 'Mag toxicity check Q1H (DTRs, RR, UO); calcium gluconate at bedside; padded side rails', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -2, status: 'active' }
    ],
    p_denise_abara: [
        { orderType: 'consult', consultSpecialty: 'Cardiothoracic Surgery', consultReason: 'Post-CABG POD#3 — daily round', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -72, status: 'active' },
        { orderType: 'diet', dietType: 'Cardiac', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -72, status: 'active' },
        { orderType: 'activity', activityType: 'OOB with assist', activitySpecialInstructions: 'Sternal precautions: no pushing, pulling, or lifting >5 lb', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -72, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -72, status: 'active' },
        { orderType: 'nursing', nursingText: 'HEPARIN ALLERGY (HIT documented) — NO heparin or enoxaparin. Use bivalirudin if anticoag needed.', orderEntry: 'CPOE', placedBy: 'Dr. Lin Okafor, MD-SIM', offsetH: -72, status: 'active' }
    ],
    p_frank_ostrowski: [
        { orderType: 'consult', consultSpecialty: 'Pulmonology', consultReason: 'COPD — O2 weaning, ambulation tolerance', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -24, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'Regular', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'activity', activityType: 'Ambulate q4h with O2', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'nursing', nursingText: 'O2 weaning trial Q4H — RA SpO2 check; document distance ambulated and SpO2 nadir', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'code-status', codeStatus: 'DNR', codeReason: 'Patient wishes documented', orderEntry: 'CPOE', placedBy: 'Dr. Reuben Park, MD-SIM', offsetH: -24, status: 'active' }
    ],
    p_kezia_williams: [
        { orderType: 'consult', consultSpecialty: 'Anesthesia', consultReason: 'Epidural placed, ongoing labor pain management', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -3, status: 'acknowledged' },
        { orderType: 'diet', dietType: 'Clear liquids / ice chips', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'activity', activityType: 'Bed/ambulation per provider', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q15min + contraction pattern + FHR', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -3, status: 'active' },
        { orderType: 'nursing', nursingText: 'Continuous fetal monitoring; cervical exam Q2H or as indicated', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -3, status: 'active' }
    ],
    p_natalie_chen: [
        { orderType: 'diet', dietType: 'Regular', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'activity', activityType: 'OOB ad lib', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'vitals-freq', vitalsFreq: 'Q4H', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -24, status: 'active' },
        { orderType: 'nursing', nursingText: 'Fundus + lochia assessment Q4H; perineal/peri-pad check Q4H; breastfeeding support PRN', orderEntry: 'CPOE', placedBy: 'Dr. Sora Patel, MD-SIM', offsetH: -24, status: 'active' }
    ]
};

// =========================================================
// Fake MD list — used by Care Team picker (Attending / Consulting MD dropdowns)
// and by scenarios for auto-assigning mdAttending based on encounter dx/unit.
// All names are obviously fictional ("Dr. X, MD-SIM").
// =========================================================
const SEED_MD_LIST = [
    // Emergency Medicine (cover ED admits)
    { id: 'md_avery_chen',    name: 'Dr. Avery Chen, MD-SIM',     specialty: 'Emergency Medicine' },
    { id: 'md_sora_patel',    name: 'Dr. Sora Patel, MD-SIM',     specialty: 'Emergency Medicine' },
    { id: 'md_maya_lin',      name: 'Dr. Maya Lin, MD-SIM',       specialty: 'Emergency Medicine' },

    // Hospitalist / Internal Medicine (Med-Surg, general admits)
    { id: 'md_reuben_park',   name: 'Dr. Reuben Park, MD-SIM',    specialty: 'Hospitalist (Internal Medicine)' },
    { id: 'md_alex_nakamura', name: 'Dr. Alex Nakamura, MD-SIM',  specialty: 'Hospitalist (Internal Medicine)' },

    // Critical Care / Intensivist (ICU)
    { id: 'md_lin_okafor',    name: 'Dr. Lin Okafor, MD-SIM',     specialty: 'Critical Care (Intensivist)' },
    { id: 'md_evelyn_holt',   name: 'Dr. Evelyn Holt, MD-SIM',    specialty: 'Critical Care (Intensivist)' },

    // Cardiology
    { id: 'md_marcus_kowalski', name: 'Dr. Marcus Kowalski, MD-SIM', specialty: 'Cardiology' },
    { id: 'md_jordan_park',     name: 'Dr. Jordan Park, MD-SIM',     specialty: 'Cardiology — Interventional' },

    // Cardiothoracic Surgery
    { id: 'md_sarah_vasquez', name: 'Dr. Sarah Vasquez, MD-SIM',  specialty: 'Cardiothoracic Surgery' },

    // Orthopedic Surgery
    { id: 'md_james_patel',   name: 'Dr. James Patel, MD-SIM',    specialty: 'Orthopedic Surgery' },

    // General Surgery
    { id: 'md_eleanor_nguyen', name: 'Dr. Eleanor Nguyen, MD-SIM', specialty: 'General Surgery' },

    // Neurology
    { id: 'md_fatima_hassan', name: 'Dr. Fatima Hassan, MD-SIM',  specialty: 'Neurology' },

    // Pulmonology
    { id: 'md_benjamin_carter', name: 'Dr. Benjamin Carter, MD-SIM', specialty: 'Pulmonology' },

    // Endocrinology
    { id: 'md_diana_romano',  name: 'Dr. Diana Romano, MD-SIM',   specialty: 'Endocrinology' },

    // Gastroenterology
    { id: 'md_wei_zhang',     name: 'Dr. Wei Zhang, MD-SIM',      specialty: 'Gastroenterology' },

    // Nephrology
    { id: 'md_amara_okafor',  name: 'Dr. Amara Okafor, MD-SIM',   specialty: 'Nephrology' },

    // Infectious Disease
    { id: 'md_david_miller',  name: 'Dr. David Miller, MD-SIM',   specialty: 'Infectious Disease' },

    // OB / GYN
    { id: 'md_rachel_stein',  name: 'Dr. Rachel Stein, MD-SIM',   specialty: 'OB/GYN' },

    // Psychiatry
    { id: 'md_theodora_adams', name: 'Dr. Theodora Adams, MD-SIM', specialty: 'Psychiatry' },

    // Pediatrics
    { id: 'md_priya_sharma',  name: 'Dr. Priya Sharma, MD-SIM',   specialty: 'Pediatrics' }
];

// Helper: look up an MD by name string (used to match enc.md → SEED_MD_LIST entry)
function findMdByName(nameStr) {
    if (!nameStr) return null;
    return SEED_MD_LIST.find(function (m) { return m.name === nameStr; }) || null;
}

// Helper: pick a sensible Attending MD specialty for a given unit + diagnosis.
// Used by scenario auto-assign when encounter.md doesn't match a SEED_MD_LIST entry.
function pickMdForEncounter(enc) {
    if (!enc) return null;
    const unit = enc.unit || '';
    const dx = (enc.dx || '').toLowerCase();
    function pick(spec) {
        const opts = SEED_MD_LIST.filter(function (m) { return m.specialty.indexOf(spec) === 0 || m.specialty === spec; });
        return opts.length ? opts[0] : null;
    }
    // Specialty hints from dx text
    if (dx.indexOf('stemi') !== -1 || dx.indexOf('chf') !== -1 || dx.indexOf('mi') !== -1 || dx.indexOf('cabg') !== -1 || dx.indexOf('angina') !== -1) return pick('Cardiology') || pick('Critical Care');
    if (dx.indexOf('hip fracture') !== -1 || dx.indexOf('tkr') !== -1 || dx.indexOf('thr') !== -1 || dx.indexOf('orif') !== -1) return pick('Orthopedic Surgery');
    if (dx.indexOf('appendicitis') !== -1 || dx.indexOf('cholecyst') !== -1) return pick('General Surgery');
    if (dx.indexOf('tia') !== -1 || dx.indexOf('cva') !== -1 || dx.indexOf('stroke') !== -1) return pick('Neurology');
    if (dx.indexOf('copd') !== -1 || dx.indexOf('asthma') !== -1 || dx.indexOf('pneumonia') !== -1 || dx.indexOf('aspiration') !== -1) return pick('Pulmonology');
    if (dx.indexOf('dka') !== -1 || dx.indexOf('hyperglyc') !== -1) return pick('Endocrinology');
    if (dx.indexOf('pancreatitis') !== -1 || dx.indexOf('gi bleed') !== -1) return pick('Gastroenterology');
    if (dx.indexOf('sepsis') !== -1 || dx.indexOf('uti') !== -1) return pick('Infectious Disease');
    if (dx.indexOf('eclamp') !== -1 || dx.indexOf('labor') !== -1 || dx.indexOf('postpartum') !== -1) return pick('OB/GYN');
    // Unit hints
    if (unit === 'ED')  return pick('Emergency Medicine');
    if (unit === 'ICU') return pick('Critical Care');
    if (unit === 'OB')  return pick('OB/GYN');
    return pick('Hospitalist');
}

// =========================================================
// LDAs (Lines / Drains / Airways) seed — keyed by patient ID
// Attached to the patient's current encounter during migration.
// =========================================================
const SEED_LDAS = {
    p_marcus_webb: [
        { type: 'PIV', site: 'L AC', size: '20g', daysAgo: 0.2, insertedBy: 'ED RN (seeded)' }
    ],
    p_amara_diallo: [
        { type: 'PIV', site: 'R hand', size: '22g', daysAgo: 0.3, insertedBy: 'ED RN (seeded)' }
    ],
    p_leonard_kowalski: [
        { type: 'PIV', site: 'L AC', size: '20g', daysAgo: 0.1, insertedBy: 'ED RN (seeded)' }
    ],
    p_sofia_reyes: [
        { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.3, insertedBy: 'ED RN (seeded)' }
    ],
    p_thomas_brandt: [
        { type: 'PIV', site: 'L hand', size: '20g', daysAgo: 0.3, insertedBy: 'ED RN (seeded)' },
        { type: 'Foley', site: 'Urethral', size: '16 Fr', daysAgo: 0.3, insertedBy: 'ED RN (seeded)', notes: 'Pre-op for hip ORIF' }
    ],
    p_priya_kapoor: [
        { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.25, insertedBy: 'ED RN (seeded)' },
        { type: 'PIV', site: 'L AC', size: '20g', daysAgo: 0.25, insertedBy: 'ED RN (seeded)' },
        { type: 'Foley', site: 'Urethral', size: '14 Fr', daysAgo: 0.2, insertedBy: 'ED RN (seeded)', notes: 'For strict I&O — septic shock protocol' }
    ],
    p_james_holloway: [
        { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.3, insertedBy: 'ED RN (seeded)' }
    ],
    p_helen_cho: [
        { type: 'PIV', site: 'R hand', size: 'SL (22g)', daysAgo: 2, insertedBy: 'Pre-op RN (seeded)', status: 'active',
          notes: 'Saline lock — per PACU protocol' },
        { type: 'JP-drain', site: 'R knee lateral', size: '10 Fr', daysAgo: 2, insertedBy: 'OR team (seeded)',
          notes: 'Surgical drain post-TKR' }
    ],
    p_robert_dimaggio: [
        { type: 'PIV', site: 'L hand', size: '22g', daysAgo: 1.2, insertedBy: 'Floor RN (seeded)' }
    ],
    p_angela_freeman: [
        { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 1.5, insertedBy: 'ED RN (seeded)', notes: 'Insulin drip' }
    ],
    p_walter_huang: [
        { type: 'PIV', site: 'R AC', size: '20g', daysAgo: 2, insertedBy: 'Floor RN (seeded)' },
        { type: 'PEG', site: 'Upper abdomen', size: '20 Fr', daysAgo: 365, insertedBy: 'Home (pre-existing)',
          notes: 'Long-term feeding tube; flush q6h with 30 mL water' }
    ],
    p_dorothy_nguyen: [
        { type: 'CVC', site: 'R IJ (triple-lumen)', size: '7 Fr', daysAgo: 1, insertedBy: 'ICU intensivist (seeded)',
          notes: 'Triple-lumen: norepi + maintenance + meds' },
        { type: 'Foley', site: 'Urethral', size: '14 Fr', daysAgo: 1, insertedBy: 'ICU RN (seeded)',
          notes: 'Strict I&O, hourly' }
    ],
    p_miguel_torres: [
        { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.1, insertedBy: 'Cath lab (seeded)' },
        { type: 'Art-line', site: 'L radial', size: '20g', daysAgo: 0.1, insertedBy: 'Cath lab (seeded)',
          notes: 'Continuous BP monitoring — zero q4h' },
        { type: 'Foley', site: 'Urethral', size: '14 Fr', daysAgo: 0.1, insertedBy: 'Cath lab (seeded)' }
    ],
    p_rachel_okonkwo: [
        { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.1, insertedBy: 'L&D RN (seeded)', notes: 'Mag drip' },
        { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.1, insertedBy: 'L&D RN (seeded)', notes: 'Maintenance fluids' },
        { type: 'Foley', site: 'Urethral', size: '14 Fr', daysAgo: 0.1, insertedBy: 'L&D RN (seeded)',
          notes: 'Mag protocol — monitor hourly U/O' }
    ],
    p_denise_abara: [
        { type: 'PIV', site: 'L hand', size: 'SL (22g)', daysAgo: 3, insertedBy: 'Floor RN (seeded)', notes: 'Saline lock' },
        { type: 'Chest-tube', site: 'R mediastinal', size: '32 Fr', daysAgo: 3, insertedBy: 'OR team (seeded)',
          notes: 'Post-CABG mediastinal; -20 cmH2O suction; output monitored q2h' }
    ],
    p_frank_ostrowski: [
        { type: 'PIV', site: 'R hand', size: 'SL (22g)', daysAgo: 2, insertedBy: 'ED RN (seeded)' }
    ],
    p_kezia_williams: [
        { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.15, insertedBy: 'L&D RN (seeded)', notes: 'Oxytocin drip + maintenance fluids' },
        { type: 'Epidural', site: 'L3-L4', size: '18g catheter', daysAgo: 0.1, insertedBy: 'Anesthesia (seeded)',
          notes: 'PCEA with bupivacaine/fentanyl' }
    ],
    p_natalie_chen: [
        { type: 'PIV', site: 'R hand', size: 'SL (22g)', daysAgo: 1.2, insertedBy: 'L&D RN (seeded)', notes: 'Saline lock post-delivery' }
    ]
};

// Prior-encounter sparse sample data for unadmitted patients
// Each entry array matches SEED_UNADMITTED_PATIENTS[i].priorEncounters[j]
const UNADMITTED_PRIOR_CHART = {
    p_olivia_smith: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Admitted with status migrainosus. Photophobia +. Started IV ketorolac and hydration.' },
            { type: 'soap', offsetH: 36, body: 'S: Pain 3/10, tolerating PO. O: Afebrile, alert. A: Migraine resolving. P: Discharge with PO meds, neurology f/u.' }
        ],
        mar: [
            { medication: 'Ketorolac', dose: '30 mg', route: 'IV', frequency: 'Q6H x 48h', scheduledTime: '0600,1200,1800,2400', status: 'given', administeredAt: daysAgoTS(44, 6), administeredBy: 'Past Nurse' },
            { medication: 'Metoclopramide', dose: '10 mg', route: 'IV', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', status: 'given', administeredAt: daysAgoTS(44, 6), administeredBy: 'Past Nurse' }
        ]
    }],
    p_david_park: [
        {
            notes: [
                { type: 'narrative', offsetH: 0, body: 'Admitted for hyperglycemia. BG 580 on arrival. Started insulin drip.' },
                { type: 'soap', offsetH: 60, body: 'S: Feels better. O: BG 140s. A: Resolved. P: Transition to glargine, diabetic teaching, d/c home.' }
            ],
            mar: [{ medication: 'Insulin Regular drip', dose: 'Per protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', status: 'given' }]
        },
        {
            notes: [
                { type: 'narrative', offsetH: 0, body: 'ED visit for gastroenteritis. Rehydrated with 1L NS. Tolerating PO.' }
            ]
        }
    ],
    p_maria_garcia: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Admitted after mechanical fall with L hip fracture. ORIF planned.' },
            { type: 'soap', offsetH: 72, body: 'S: Pain controlled. O: Incision clean, WB as tolerated. A: POD#3 ORIF stable. P: Transfer to rehab.' }
        ],
        mar: [{ medication: 'Oxycodone', dose: '5 mg', route: 'PO', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >4/10', status: 'given' }]
    }],
    p_tyler_mcallister: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Hand laceration s/p repair with 6 sutures. Tetanus given. D/c with wound care teaching.' }
        ]
    }],
    p_janet_washington: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Direct admit for prophylactic mastectomy. Pre-op checklist complete.' },
            { type: 'soap', offsetH: 72, body: 'S: Pain manageable. O: Drains x 2, output 30 mL each. A: POD#3 stable. P: D/c home with drain teaching.' }
        ]
    }],
    p_benjamin_ortiz: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'AFib with RVR, HR 150s. Started diltiazem drip. Converted to sinus rhythm.' },
            { type: 'soap', offsetH: 96, body: 'S: Feeling better. O: HR 72 SR. A: Rate controlled. P: D/c home, continue apixaban.' }
        ]
    }],
    p_chloe_richardson: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'G3P2 admitted in active labor. SROM at home.' },
            { type: 'soap', offsetH: 14, body: 'Delivered healthy F infant 7lb 3oz. Apgars 8/9. Mom + baby stable.' }
        ]
    }],
    p_raymond_jenkins: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'COPD exacerbation. Started steroids + abx.' },
            { type: 'soap', offsetH: 72, body: 'S: Breathing easier. O: SpO2 93% RA. A: Exacerbation resolving. P: D/c home, taper steroids.' }
        ]
    }],
    p_emily_foster: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Presented with severe ETOH intoxication. Monitored overnight, cleared.' },
            { type: 'narrative', offsetH: 5, body: 'Sober, tolerating PO. D/c home with friend. Declined social work referral.' }
        ]
    }],
    p_gordon_blake: [{
        notes: [
            { type: 'narrative', offsetH: 0, body: 'Low back strain after lifting. Neuro intact. D/c home with ibuprofen + PT referral.' }
        ]
    }]
};

// =========================================================
// PHASE 3C — LAB PANELS + IMAGING
// =========================================================
//
// Panel metadata used by index.html to group labs in the Labs tab.
// Order here = render order in the tab.
//
const LAB_PANELS = [
    { id: 'cbc',      label: 'CBC w/ diff',     icon: 'CBC' },
    { id: 'bmp',      label: 'BMP / Chemistry', icon: 'BMP' },
    { id: 'lfts',     label: 'LFTs',            icon: 'LFT' },
    { id: 'coags',    label: 'Coags',           icon: 'COAG' },
    { id: 'cardiac',  label: 'Cardiac markers', icon: 'CARD' },
    { id: 'abg',      label: 'ABG',             icon: 'ABG' },
    { id: 'ua',       label: 'UA / Urine',      icon: 'UA' },
    { id: 'cultures', label: 'Cultures',        icon: 'CX' },
    { id: 'misc',     label: 'Other / Misc',    icon: 'MISC' }
];

// =========================================================
// SEED_LABS — keyed by patientId.
// Each entry is an array of lab rows that get written to:
//     emr/labs/{patientId}/{labId}
// during migration with collectedAt = baseTs + collectedH * 3600000
// (collectedH and resultedH are negative offsets in hours from now).
//
// Schema per row:
//   panelId      - one of LAB_PANELS ids
//   testName     - display name (WBC, Hgb, Na, etc.)
//   value        - numeric or string (cultures = pending/positive/etc.)
//   unit         - display unit (K/uL, mg/dL, %, mmol/L, ...)
//   refLow,refHigh - numeric reference range (omit if N/A - e.g., cultures)
//   flag         - '' | 'L' | 'H' | 'LL' | 'HH' (LL/HH = critical)
//   collectedH   - hours-from-now when specimen drawn (negative)
//   resultedH    - hours-from-now when result back (negative; > collectedH)
//   collectedBy  - who drew (defaults to "Lab (seeded)")
//   resultedBy   - who resulted (defaults to "Lab (seeded)")
//   notes        - optional clinical context
//
// Doses + ranges based on standard adult reference ranges.
// All FICTIONAL test results, attached to fictional patients.
// =========================================================
const SEED_LABS = {
    // -----------------------------------------------------
    // Priya Kapoor - sepsis (urosepsis from indwelling foley)
    // -----------------------------------------------------
    p_priya_kapoor: [
        // CBC w/ diff - leukocytosis with bandemia
        { panelId: 'cbc', testName: 'WBC',         value: 19.3, unit: 'K/uL',  refLow: 4.0,  refHigh: 11.0, flag: 'H',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'cbc', testName: 'Bands',       value: 22,   unit: '%',     refLow: 0,    refHigh: 5,    flag: 'H',  collectedH: -3.5, resultedH: -3, notes: 'Left shift c/w bacterial infxn' },
        { panelId: 'cbc', testName: 'Hgb',         value: 11.4, unit: 'g/dL',  refLow: 12.0, refHigh: 16.0, flag: 'L',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'cbc', testName: 'Hct',         value: 34,   unit: '%',     refLow: 36,   refHigh: 47,   flag: 'L',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'cbc', testName: 'Plt',         value: 142,  unit: 'K/uL',  refLow: 150,  refHigh: 400,  flag: 'L',  collectedH: -3.5, resultedH: -3 },
        // BMP - AKI + hyperglycemia (stress)
        { panelId: 'bmp', testName: 'Na',          value: 134,  unit: 'mmol/L',refLow: 135,  refHigh: 145,  flag: 'L',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'bmp', testName: 'K',           value: 4.4,  unit: 'mmol/L',refLow: 3.5,  refHigh: 5.0,  flag: '',   collectedH: -3.5, resultedH: -3 },
        { panelId: 'bmp', testName: 'Cl',          value: 99,   unit: 'mmol/L',refLow: 96,   refHigh: 106,  flag: '',   collectedH: -3.5, resultedH: -3 },
        { panelId: 'bmp', testName: 'CO2',         value: 19,   unit: 'mmol/L',refLow: 22,   refHigh: 30,   flag: 'L',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'bmp', testName: 'BUN',         value: 38,   unit: 'mg/dL', refLow: 7,    refHigh: 20,   flag: 'H',  collectedH: -3.5, resultedH: -3 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 1.6,  unit: 'mg/dL', refLow: 0.6,  refHigh: 1.2,  flag: 'H',  collectedH: -3.5, resultedH: -3, notes: 'Baseline 0.9 - AKI' },
        { panelId: 'bmp', testName: 'Glucose',     value: 168,  unit: 'mg/dL', refLow: 70,   refHigh: 110,  flag: 'H',  collectedH: -3.5, resultedH: -3, notes: 'Stress hyperglycemia' },
        // Sepsis-specific
        { panelId: 'misc',testName: 'Lactate',     value: 4.2,  unit: 'mmol/L',refLow: 0.5,  refHigh: 2.0,  flag: 'HH', collectedH: -3.5, resultedH: -3, notes: 'Critical - septic shock' },
        { panelId: 'misc',testName: 'Lactate',     value: 2.8,  unit: 'mmol/L',refLow: 0.5,  refHigh: 2.0,  flag: 'H',  collectedH: -1,   resultedH: -0.5, notes: 'Repeat after fluid resuscitation' },
        { panelId: 'misc',testName: 'Procalcitonin',value: 4.5, unit: 'ng/mL', refLow: 0,    refHigh: 0.5,  flag: 'HH', collectedH: -3.5, resultedH: -2.5, notes: 'Strongly suggestive of bacterial sepsis' },
        // UA + cultures
        { panelId: 'ua', testName: 'Leukocyte esterase', value: 'Large +',  unit: '', flag: 'H', collectedH: -3.5, resultedH: -3 },
        { panelId: 'ua', testName: 'Nitrites',      value: 'Positive',     unit: '', flag: 'H', collectedH: -3.5, resultedH: -3 },
        { panelId: 'ua', testName: 'WBC (urine)',   value: '50-100/hpf',   unit: '', flag: 'H', collectedH: -3.5, resultedH: -3 },
        { panelId: 'ua', testName: 'Bacteria',      value: 'Many',         unit: '', flag: 'H', collectedH: -3.5, resultedH: -3 },
        { panelId: 'cultures', testName: 'Blood culture x 2', value: 'Pending - preliminary no growth at 24h', unit: '', flag: '', collectedH: -3.5, resultedH: -0.5 },
        { panelId: 'cultures', testName: 'Urine culture',     value: 'Preliminary: GNR, ID/sensitivities pending', unit: '', flag: 'H', collectedH: -3.5, resultedH: -1, notes: 'Likely E. coli pending speciation' }
    ],

    // -----------------------------------------------------
    // Miguel Torres - STEMI s/p PCI
    // -----------------------------------------------------
    p_miguel_torres: [
        // Cardiac biomarkers - peaked then trending
        { panelId: 'cardiac', testName: 'Troponin I', value: 0.08, unit: 'ng/mL', refLow: 0,   refHigh: 0.04, flag: 'H',  collectedH: -6, resultedH: -5.5, notes: 'Initial ED draw' },
        { panelId: 'cardiac', testName: 'Troponin I', value: 8.4,  unit: 'ng/mL', refLow: 0,   refHigh: 0.04, flag: 'HH', collectedH: -3, resultedH: -2.5, notes: 'Peak post-PCI - critical-H expected for STEMI' },
        { panelId: 'cardiac', testName: 'Troponin I', value: 6.1,  unit: 'ng/mL', refLow: 0,   refHigh: 0.04, flag: 'H',  collectedH: -1, resultedH: -0.5, notes: 'Down-trending' },
        { panelId: 'cardiac', testName: 'CK-MB',      value: 78,   unit: 'ng/mL', refLow: 0,   refHigh: 6.3,  flag: 'H',  collectedH: -3, resultedH: -2.5 },
        { panelId: 'cardiac', testName: 'BNP',        value: 412,  unit: 'pg/mL', refLow: 0,   refHigh: 100,  flag: 'H',  collectedH: -3, resultedH: -2.5, notes: 'Mild HF strain post-MI' },
        // BMP - note hypokalemia + hypomag (cardiac arrhythmia risk)
        { panelId: 'bmp', testName: 'Na',         value: 138,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '',   collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'K',          value: 3.4,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: 'L',  collectedH: -3, resultedH: -2.5, notes: 'Replete - risk for arrhythmia post-MI' },
        { panelId: 'bmp', testName: 'Cl',         value: 102,  unit: 'mmol/L',refLow: 96,  refHigh: 106, flag: '',   collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'CO2',        value: 24,   unit: 'mmol/L',refLow: 22,  refHigh: 30,  flag: '',   collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'BUN',        value: 18,   unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: '',   collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'Creatinine', value: 1.1,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',   collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'Glucose',    value: 132,  unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H',  collectedH: -3, resultedH: -2.5 },
        { panelId: 'bmp', testName: 'Mg',         value: 1.7,  unit: 'mg/dL', refLow: 1.8, refHigh: 2.4, flag: 'L',  collectedH: -3, resultedH: -2.5, notes: 'Replete - protects against torsades post-MI' },
        // CBC normal
        { panelId: 'cbc', testName: 'WBC', value: 9.8,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '', collectedH: -3, resultedH: -2.5 },
        { panelId: 'cbc', testName: 'Hgb', value: 14.1, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: '', collectedH: -3, resultedH: -2.5 },
        { panelId: 'cbc', testName: 'Plt', value: 232,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -3, resultedH: -2.5 },
        // Coags - on heparin protocol
        { panelId: 'coags', testName: 'aPTT', value: 78, unit: 'sec', refLow: 60, refHigh: 80, flag: '', collectedH: -1, resultedH: -0.5, notes: 'Therapeutic on heparin gtt (target 60-80)' }
    ],

    // -----------------------------------------------------
    // Dorothy Nguyen - COPD exacerbation, hypercapnic respiratory failure on BiPAP
    // -----------------------------------------------------
    p_dorothy_nguyen: [
        // ABG - ACUTE respiratory acidosis with chronic compensation
        { panelId: 'abg', testName: 'pH',     value: 7.22, unit: '',     refLow: 7.35, refHigh: 7.45, flag: 'LL', collectedH: -4, resultedH: -3.7, notes: 'Acute on chronic respiratory acidosis' },
        { panelId: 'abg', testName: 'PaCO2',  value: 78,   unit: 'mmHg', refLow: 35,   refHigh: 45,   flag: 'HH', collectedH: -4, resultedH: -3.7 },
        { panelId: 'abg', testName: 'PaO2',   value: 54,   unit: 'mmHg', refLow: 80,   refHigh: 100,  flag: 'LL', collectedH: -4, resultedH: -3.7 },
        { panelId: 'abg', testName: 'HCO3',   value: 32,   unit: 'mmol/L',refLow: 22,  refHigh: 26,   flag: 'H',  collectedH: -4, resultedH: -3.7, notes: 'Chronic compensation (renal)' },
        { panelId: 'abg', testName: 'SaO2',   value: 86,   unit: '%',    refLow: 95,   refHigh: 100,  flag: 'L',  collectedH: -4, resultedH: -3.7 },
        // Repeat ABG after BiPAP - improving
        { panelId: 'abg', testName: 'pH',     value: 7.31, unit: '',     refLow: 7.35, refHigh: 7.45, flag: 'L',  collectedH: -1, resultedH: -0.5, notes: 'Improving on BiPAP' },
        { panelId: 'abg', testName: 'PaCO2',  value: 62,   unit: 'mmHg', refLow: 35,   refHigh: 45,   flag: 'H',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'abg', testName: 'PaO2',   value: 78,   unit: 'mmHg', refLow: 80,   refHigh: 100,  flag: 'L',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'abg', testName: 'HCO3',   value: 30,   unit: 'mmol/L',refLow: 22,  refHigh: 26,   flag: 'H',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'abg', testName: 'SaO2',   value: 93,   unit: '%',    refLow: 95,   refHigh: 100,  flag: 'L',  collectedH: -1, resultedH: -0.5 },
        // CBC unremarkable
        { panelId: 'cbc', testName: 'WBC', value: 10.2, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '', collectedH: -4, resultedH: -3.5 },
        { panelId: 'cbc', testName: 'Hgb', value: 14.8, unit: 'g/dL', refLow: 12.0, refHigh: 16.0, flag: '', collectedH: -4, resultedH: -3.5, notes: 'No polycythemia despite chronic hypoxia' },
        { panelId: 'cbc', testName: 'Plt', value: 268,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -4, resultedH: -3.5 },
        // BMP
        { panelId: 'bmp', testName: 'Na',         value: 140, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '', collectedH: -4, resultedH: -3.5 },
        { panelId: 'bmp', testName: 'K',          value: 4.0, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '', collectedH: -4, resultedH: -3.5 },
        { panelId: 'bmp', testName: 'CO2',        value: 32,  unit: 'mmol/L',refLow: 22,  refHigh: 30,  flag: 'H',collectedH: -4, resultedH: -3.5, notes: 'Reflects chronic CO2 retention' },
        { panelId: 'bmp', testName: 'Creatinine', value: 1.0, unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '', collectedH: -4, resultedH: -3.5 }
    ],

    // -----------------------------------------------------
    // Angela Freeman - DKA
    // -----------------------------------------------------
    p_angela_freeman: [
        // BMP - anion gap metabolic acidosis
        { panelId: 'bmp', testName: 'Na',         value: 131, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: 'L', collectedH: -18, resultedH: -17.5, notes: 'Pseudohyponatremia from hyperglycemia; corrected ~136' },
        { panelId: 'bmp', testName: 'K',          value: 5.6, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: 'H', collectedH: -18, resultedH: -17.5, notes: 'Total body K depleted - will drop fast on insulin. Replete carefully.' },
        { panelId: 'bmp', testName: 'Cl',         value: 98,  unit: 'mmol/L',refLow: 96,  refHigh: 106, flag: '',  collectedH: -18, resultedH: -17.5 },
        { panelId: 'bmp', testName: 'CO2',        value: 9,   unit: 'mmol/L',refLow: 22,  refHigh: 30,  flag: 'LL',collectedH: -18, resultedH: -17.5, notes: 'Critical - severe metabolic acidosis' },
        { panelId: 'bmp', testName: 'Anion gap',  value: 24,  unit: '',      refLow: 8,   refHigh: 12,  flag: 'H', collectedH: -18, resultedH: -17.5, notes: 'High anion gap acidosis' },
        { panelId: 'bmp', testName: 'BUN',        value: 32,  unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: 'H', collectedH: -18, resultedH: -17.5, notes: 'Pre-renal from osmotic diuresis' },
        { panelId: 'bmp', testName: 'Creatinine', value: 1.4, unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: 'H', collectedH: -18, resultedH: -17.5 },
        { panelId: 'bmp', testName: 'Glucose',    value: 487, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'HH',collectedH: -18, resultedH: -17.5, notes: 'Critical hyperglycemia - DKA' },
        // Serial glucose post-insulin gtt
        { panelId: 'bmp', testName: 'Glucose',    value: 312, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H', collectedH: -10, resultedH: -10, notes: 'On insulin gtt - coming down' },
        { panelId: 'bmp', testName: 'Glucose',    value: 198, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H', collectedH: -2,  resultedH: -2,  notes: 'Add D5 - approaching 200 threshold per protocol' },
        // Repeat K (now low after insulin shifted intracellularly)
        { panelId: 'bmp', testName: 'K',          value: 3.3, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: 'L', collectedH: -2,  resultedH: -1.5, notes: 'Replete K - classic DKA pattern' },
        // Ketones
        { panelId: 'misc',testName: 'Beta-hydroxybutyrate', value: 5.8, unit: 'mmol/L', refLow: 0, refHigh: 0.4, flag: 'HH', collectedH: -18, resultedH: -17.5 },
        { panelId: 'ua', testName: 'Ketones',     value: 'Large +',     unit: '', flag: 'H', collectedH: -18, resultedH: -17.5 },
        { panelId: 'ua', testName: 'Glucose',     value: '>1000 mg/dL', unit: '', flag: 'H', collectedH: -18, resultedH: -17.5 },
        // CBC - stress demargination (NOT infection)
        { panelId: 'cbc', testName: 'WBC', value: 14.2, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -18, resultedH: -17.5, notes: 'Stress demargination - no left shift, low suspicion for infxn' },
        { panelId: 'cbc', testName: 'Hgb', value: 13.6, unit: 'g/dL', refLow: 12.0, refHigh: 16.0, flag: '', collectedH: -18, resultedH: -17.5 },
        { panelId: 'cbc', testName: 'Plt', value: 312,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -18, resultedH: -17.5 }
    ],

    // -----------------------------------------------------
    // Robert DiMaggio - acute decompensated CHF
    // -----------------------------------------------------
    p_robert_dimaggio: [
        // Cardiac
        { panelId: 'cardiac', testName: 'BNP',        value: 1840, unit: 'pg/mL', refLow: 0, refHigh: 100, flag: 'HH', collectedH: -22, resultedH: -21.5, notes: 'Critical - acute decompensation' },
        { panelId: 'cardiac', testName: 'BNP',        value: 980,  unit: 'pg/mL', refLow: 0, refHigh: 100, flag: 'H',  collectedH: -2,  resultedH: -1.5, notes: 'Down-trending after diuresis' },
        { panelId: 'cardiac', testName: 'Troponin I', value: 0.05, unit: 'ng/mL', refLow: 0, refHigh: 0.04,flag: 'H',  collectedH: -22, resultedH: -21.5, notes: 'Mild bump c/w demand from CHF; not ACS' },
        // BMP - cardiorenal + diuretic effects
        { panelId: 'bmp', testName: 'Na',         value: 128, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: 'L',  collectedH: -22, resultedH: -21.5, notes: 'Dilutional hyponatremia of CHF' },
        { panelId: 'bmp', testName: 'K',          value: 3.2, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: 'L',  collectedH: -22, resultedH: -21.5, notes: 'Loop diuretic-induced - replete' },
        { panelId: 'bmp', testName: 'Cl',         value: 90,  unit: 'mmol/L',refLow: 96,  refHigh: 106, flag: 'L',  collectedH: -22, resultedH: -21.5, notes: 'Contraction alkalosis from diuresis' },
        { panelId: 'bmp', testName: 'CO2',        value: 31,  unit: 'mmol/L',refLow: 22,  refHigh: 30,  flag: 'H',  collectedH: -22, resultedH: -21.5 },
        { panelId: 'bmp', testName: 'BUN',        value: 42,  unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: 'H',  collectedH: -22, resultedH: -21.5, notes: 'Pre-renal from diuresis + low CO' },
        { panelId: 'bmp', testName: 'Creatinine', value: 1.7, unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: 'H',  collectedH: -22, resultedH: -21.5, notes: 'Cardiorenal syndrome (baseline 1.2)' },
        { panelId: 'bmp', testName: 'Glucose',    value: 118, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H',  collectedH: -22, resultedH: -21.5 },
        { panelId: 'bmp', testName: 'Mg',         value: 1.6, unit: 'mg/dL', refLow: 1.8, refHigh: 2.4, flag: 'L',  collectedH: -22, resultedH: -21.5, notes: 'Diuretic-induced - replete' },
        // CBC
        { panelId: 'cbc', testName: 'WBC', value: 8.4,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '', collectedH: -22, resultedH: -21.5 },
        { panelId: 'cbc', testName: 'Hgb', value: 11.9, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: 'L', collectedH: -22, resultedH: -21.5, notes: 'Mild anemia of chronic disease' },
        { panelId: 'cbc', testName: 'Plt', value: 198,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -22, resultedH: -21.5 }
    ],

    // -----------------------------------------------------
    // Leonard Kowalski - TIA/CVA on warfarin, supratherapeutic INR
    // -----------------------------------------------------
    p_leonard_kowalski: [
        // Coags - supratherapeutic INR (bleed risk)
        { panelId: 'coags', testName: 'INR', value: 4.2, unit: '',    refLow: 2.0, refHigh: 3.0, flag: 'HH', collectedH: -1, resultedH: -0.5, notes: 'Critical - supratherapeutic. Hold warfarin. Consider Vit K if any bleeding.' },
        { panelId: 'coags', testName: 'PT',  value: 42.1,unit: 'sec', refLow: 11,  refHigh: 14,  flag: 'H',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'coags', testName: 'PTT', value: 38,  unit: 'sec', refLow: 25,  refHigh: 35,  flag: '',   collectedH: -1, resultedH: -0.5, notes: 'Within normal - warfarin specifically affects extrinsic (PT/INR)' },
        // BMP - stress glucose, otherwise normal
        { panelId: 'bmp', testName: 'Na',         value: 137, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'bmp', testName: 'K',          value: 4.1, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'bmp', testName: 'BUN',        value: 22,  unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: 'H', collectedH: -1, resultedH: -0.5 },
        { panelId: 'bmp', testName: 'Creatinine', value: 1.1, unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',  collectedH: -1, resultedH: -0.5 },
        { panelId: 'bmp', testName: 'Glucose',    value: 142, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H', collectedH: -1, resultedH: -0.5, notes: 'Stress hyperglycemia - common in acute stroke' },
        // CBC normal
        { panelId: 'cbc', testName: 'WBC', value: 7.8,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '', collectedH: -1, resultedH: -0.5 },
        { panelId: 'cbc', testName: 'Hgb', value: 13.2, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: 'L', collectedH: -1, resultedH: -0.5 },
        { panelId: 'cbc', testName: 'Plt', value: 218,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -1, resultedH: -0.5 },
        // Lipid (admission baseline)
        { panelId: 'misc', testName: 'LDL',           value: 142, unit: 'mg/dL', refLow: 0,  refHigh: 100, flag: 'H', collectedH: -1, resultedH: -0.5, notes: 'Above goal - review statin dosing' },
        { panelId: 'misc', testName: 'HbA1c',         value: 6.4, unit: '%',     refLow: 4,  refHigh: 5.6, flag: 'H', collectedH: -1, resultedH: -0.5, notes: 'Pre-diabetic range' }
    ],

    // -----------------------------------------------------
    // Marcus Webb - atypical chest pain (low-pretest, ruling out)
    // -----------------------------------------------------
    p_marcus_webb: [
        { panelId: 'cardiac', testName: 'Troponin I', value: 0.02, unit: 'ng/mL', refLow: 0, refHigh: 0.04, flag: '', collectedH: -1.5, resultedH: -1, notes: 'Initial - negative' },
        { panelId: 'cardiac', testName: 'Troponin I', value: 0.02, unit: 'ng/mL', refLow: 0, refHigh: 0.04, flag: '', collectedH: -0.2, resultedH: 0,  notes: 'Repeat at 90 min - flat. Reassuring.' },
        { panelId: 'cbc', testName: 'WBC', value: 8.2,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'cbc', testName: 'Hgb', value: 15.4, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'cbc', testName: 'Plt', value: 256,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'bmp', testName: 'Na',         value: 139, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'bmp', testName: 'K',          value: 4.2, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'bmp', testName: 'Creatinine', value: 0.9, unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '', collectedH: -1.5, resultedH: -1 },
        { panelId: 'bmp', testName: 'Glucose',    value: 96,  unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: '', collectedH: -1.5, resultedH: -1 }
    ],

    // -----------------------------------------------------
    // James Holloway - acute pancreatitis (alcohol-induced)
    // -----------------------------------------------------
    p_james_holloway: [
        { panelId: 'misc', testName: 'Lipase',  value: 1240, unit: 'U/L', refLow: 13, refHigh: 60, flag: 'HH', collectedH: -2, resultedH: -1.5, notes: '>3x ULN - diagnostic for acute pancreatitis' },
        { panelId: 'misc', testName: 'Amylase', value: 412,  unit: 'U/L', refLow: 25, refHigh: 125,flag: 'H',  collectedH: -2, resultedH: -1.5 },
        // LFTs - alcoholic hepatitis pattern (AST > ALT, ratio >2)
        { panelId: 'lfts', testName: 'AST',     value: 178, unit: 'U/L',  refLow: 10,  refHigh: 40,  flag: 'H',  collectedH: -2, resultedH: -1.5, notes: 'AST/ALT >2:1 c/w alcoholic liver injury' },
        { panelId: 'lfts', testName: 'ALT',     value: 84,  unit: 'U/L',  refLow: 7,   refHigh: 56,  flag: 'H',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'lfts', testName: 'Alk Phos',value: 142, unit: 'U/L',  refLow: 44,  refHigh: 147, flag: '',   collectedH: -2, resultedH: -1.5 },
        { panelId: 'lfts', testName: 'Total bili',value: 2.4,unit: 'mg/dL',refLow: 0.1, refHigh: 1.2, flag: 'H',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'lfts', testName: 'Albumin', value: 3.1, unit: 'g/dL', refLow: 3.5, refHigh: 5.0, flag: 'L',  collectedH: -2, resultedH: -1.5, notes: 'Chronic ETOH - synthetic dysfunction' },
        // BMP
        { panelId: 'bmp', testName: 'Na',         value: 134, unit: 'mmol/L',refLow: 135, refHigh: 145, flag: 'L', collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'K',          value: 3.6, unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Mg',         value: 1.4, unit: 'mg/dL', refLow: 1.8, refHigh: 2.4, flag: 'L', collectedH: -2, resultedH: -1.5, notes: 'Chronic ETOH - replete; CIWA risk' },
        { panelId: 'bmp', testName: 'Glucose',    value: 158, unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H', collectedH: -2, resultedH: -1.5 },
        // CBC
        { panelId: 'cbc', testName: 'WBC', value: 12.1, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'Inflammatory leukocytosis' },
        { panelId: 'cbc', testName: 'Hgb', value: 12.4, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: 'L', collectedH: -2, resultedH: -1.5 },
        { panelId: 'cbc', testName: 'Plt', value: 102,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: 'L', collectedH: -2, resultedH: -1.5, notes: 'Mild thrombocytopenia c/w chronic ETOH' }
    ],

    // -----------------------------------------------------
    // Sofia Reyes - acute appendicitis
    // -----------------------------------------------------
    p_sofia_reyes: [
        { panelId: 'cbc', testName: 'WBC',         value: 16.4, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'Leukocytosis c/w acute appendicitis' },
        { panelId: 'cbc', testName: 'Neut %',      value: 86,   unit: '%',    refLow: 40,   refHigh: 70,   flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'Neutrophilic predominance' },
        { panelId: 'cbc', testName: 'Hgb',         value: 13.4, unit: 'g/dL', refLow: 12.0, refHigh: 16.0, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'cbc', testName: 'Plt',         value: 312,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Na',          value: 138,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'K',           value: 3.9,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 0.8,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Glucose',     value: 102,  unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: '',  collectedH: -2, resultedH: -1.5 },
        // hCG - important pre-op for any reproductive-age female
        { panelId: 'misc', testName: 'Beta-hCG (qual)', value: 'Negative', unit: '', flag: '', collectedH: -2, resultedH: -1.5, notes: 'Pre-op - pregnancy excluded' },
        // Coags - pre-op
        { panelId: 'coags', testName: 'INR', value: 1.0, unit: '', refLow: 0.8, refHigh: 1.2, flag: '', collectedH: -2, resultedH: -1.5, notes: 'Pre-op clearance' }
    ],

    // -----------------------------------------------------
    // Walter Huang - recurrent aspiration pneumonia
    // -----------------------------------------------------
    p_walter_huang: [
        { panelId: 'cbc', testName: 'WBC',         value: 14.8, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -16, resultedH: -15.5 },
        { panelId: 'cbc', testName: 'Bands',       value: 8,    unit: '%',    refLow: 0,    refHigh: 5,    flag: 'H', collectedH: -16, resultedH: -15.5 },
        { panelId: 'cbc', testName: 'Hgb',         value: 11.2, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: 'L', collectedH: -16, resultedH: -15.5 },
        { panelId: 'cbc', testName: 'Plt',         value: 188,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '',  collectedH: -16, resultedH: -15.5 },
        { panelId: 'bmp', testName: 'Na',          value: 132,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: 'L', collectedH: -16, resultedH: -15.5 },
        { panelId: 'bmp', testName: 'K',           value: 3.7,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -16, resultedH: -15.5 },
        { panelId: 'bmp', testName: 'BUN',         value: 28,   unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: 'H', collectedH: -16, resultedH: -15.5 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 1.0,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',  collectedH: -16, resultedH: -15.5 },
        { panelId: 'misc', testName: 'Albumin',    value: 2.6,  unit: 'g/dL',  refLow: 3.5, refHigh: 5.0, flag: 'L', collectedH: -16, resultedH: -15.5, notes: 'Malnutrition - advanced dementia' },
        { panelId: 'cultures', testName: 'Sputum culture', value: 'Pending - preliminary mixed flora c/w aspiration', unit: '', flag: '', collectedH: -16, resultedH: -8 }
    ],

    // -----------------------------------------------------
    // Helen Cho - POD#2 TKR, doing well
    // -----------------------------------------------------
    p_helen_cho: [
        { panelId: 'cbc', testName: 'WBC',         value: 9.4,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'cbc', testName: 'Hgb',         value: 9.8,  unit: 'g/dL', refLow: 12.0, refHigh: 16.0, flag: 'L', collectedH: -8, resultedH: -7.5, notes: 'Post-op anemia from intra-op blood loss' },
        { panelId: 'cbc', testName: 'Hct',         value: 30,   unit: '%',    refLow: 36,   refHigh: 47,   flag: 'L', collectedH: -8, resultedH: -7.5 },
        { panelId: 'cbc', testName: 'Plt',         value: 268,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'Na',          value: 138,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'K',           value: 4.0,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 0.9,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'Glucose',     value: 108,  unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: '',  collectedH: -8, resultedH: -7.5 }
    ],

    // -----------------------------------------------------
    // Thomas Brandt - R hip fracture, pre-op
    // -----------------------------------------------------
    p_thomas_brandt: [
        { panelId: 'cbc', testName: 'WBC',         value: 11.8, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'Mild - stress + hematoma' },
        { panelId: 'cbc', testName: 'Hgb',         value: 10.4, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: 'L', collectedH: -2, resultedH: -1.5, notes: 'Anemia from hematoma + chronic disease' },
        { panelId: 'cbc', testName: 'Plt',         value: 198,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Na',          value: 134,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: 'L', collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'K',           value: 4.2,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'BUN',         value: 24,   unit: 'mg/dL', refLow: 7,   refHigh: 20,  flag: 'H', collectedH: -2, resultedH: -1.5 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 1.3,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'Age + dehydration' },
        { panelId: 'coags', testName: 'INR',       value: 1.1,  unit: '',     refLow: 0.8, refHigh: 1.2, flag: '',  collectedH: -2, resultedH: -1.5, notes: 'Pre-op - cleared' }
    ],

    // -----------------------------------------------------
    // Denise Abara - POD#3 CABG
    // -----------------------------------------------------
    p_denise_abara: [
        { panelId: 'cbc', testName: 'WBC',         value: 11.2, unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: 'H', collectedH: -8, resultedH: -7.5, notes: 'Post-op inflammatory - trending down' },
        { panelId: 'cbc', testName: 'Hgb',         value: 10.1, unit: 'g/dL', refLow: 12.0, refHigh: 16.0, flag: 'L', collectedH: -8, resultedH: -7.5 },
        { panelId: 'cbc', testName: 'Plt',         value: 178,  unit: 'K/uL', refLow: 150,  refHigh: 400,  flag: '',  collectedH: -8, resultedH: -7.5, notes: 'No HIT pattern (>50% drop) - but heparin contraindicated regardless per allergy' },
        { panelId: 'bmp', testName: 'Na',          value: 137,  unit: 'mmol/L',refLow: 135, refHigh: 145, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'K',           value: 3.7,  unit: 'mmol/L',refLow: 3.5, refHigh: 5.0, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'Creatinine',  value: 1.1,  unit: 'mg/dL', refLow: 0.6, refHigh: 1.2, flag: '',  collectedH: -8, resultedH: -7.5 },
        { panelId: 'bmp', testName: 'Glucose',     value: 142,  unit: 'mg/dL', refLow: 70,  refHigh: 110, flag: 'H', collectedH: -8, resultedH: -7.5, notes: 'Post-op stress' }
    ],

    // -----------------------------------------------------
    // Rachel Okonkwo - postpartum eclampsia on Mag
    // -----------------------------------------------------
    p_rachel_okonkwo: [
        { panelId: 'misc',  testName: 'Mg level',         value: 6.8,  unit: 'mg/dL', refLow: 1.8, refHigh: 2.4, flag: 'H', collectedH: -1, resultedH: -0.5, notes: 'Therapeutic for eclampsia (4-7 mg/dL); monitor reflexes/RR' },
        { panelId: 'lfts',  testName: 'AST',              value: 78,   unit: 'U/L',   refLow: 10,  refHigh: 40,  flag: 'H', collectedH: -2, resultedH: -1.5, notes: 'HELLP r/o' },
        { panelId: 'lfts',  testName: 'ALT',              value: 64,   unit: 'U/L',   refLow: 7,   refHigh: 56,  flag: 'H', collectedH: -2, resultedH: -1.5 },
        { panelId: 'lfts',  testName: 'LDH',              value: 412,  unit: 'U/L',   refLow: 140, refHigh: 280, flag: 'H', collectedH: -2, resultedH: -1.5 },
        { panelId: 'cbc',   testName: 'Plt',              value: 88,   unit: 'K/uL',  refLow: 150, refHigh: 400, flag: 'L', collectedH: -2, resultedH: -1.5, notes: 'Thrombocytopenia c/w HELLP - escalate to MFM' },
        { panelId: 'cbc',   testName: 'Hgb',              value: 10.8, unit: 'g/dL',  refLow: 12.0,refHigh: 16.0,flag: 'L', collectedH: -2, resultedH: -1.5 },
        { panelId: 'misc',  testName: 'Uric acid',        value: 7.2,  unit: 'mg/dL', refLow: 2.5, refHigh: 6.0, flag: 'H', collectedH: -2, resultedH: -1.5 },
        { panelId: 'ua',    testName: 'Protein (urine)',  value: '3+', unit: '',      flag: 'H', collectedH: -2, resultedH: -1.5 }
    ],

    // -----------------------------------------------------
    // Frank Ostrowski - COPD on O2 wean
    // -----------------------------------------------------
    p_frank_ostrowski: [
        { panelId: 'abg', testName: 'pH',     value: 7.36, unit: '',     refLow: 7.35, refHigh: 7.45, flag: '',  collectedH: -12, resultedH: -11.5, notes: 'Compensated chronic resp acidosis at baseline' },
        { panelId: 'abg', testName: 'PaCO2',  value: 52,   unit: 'mmHg', refLow: 35,   refHigh: 45,   flag: 'H', collectedH: -12, resultedH: -11.5, notes: 'Chronic CO2 retention - patient baseline' },
        { panelId: 'abg', testName: 'HCO3',   value: 30,   unit: 'mmol/L',refLow: 22,  refHigh: 26,   flag: 'H', collectedH: -12, resultedH: -11.5 },
        { panelId: 'abg', testName: 'PaO2',   value: 68,   unit: 'mmHg', refLow: 80,   refHigh: 100,  flag: 'L', collectedH: -12, resultedH: -11.5, notes: 'On 2L NC - appropriate for COPD' },
        { panelId: 'cbc', testName: 'WBC',    value: 8.6,  unit: 'K/uL', refLow: 4.0,  refHigh: 11.0, flag: '',  collectedH: -12, resultedH: -11.5 },
        { panelId: 'cbc', testName: 'Hgb',    value: 16.2, unit: 'g/dL', refLow: 13.5, refHigh: 17.5, flag: '',  collectedH: -12, resultedH: -11.5, notes: 'Upper-normal - chronic hypoxemia' }
    ]
};

// =========================================================
// SEED_IMAGING - keyed by patientId.
// Each entry is an array of imaging studies written to:
//     emr/imaging/{patientId}/{studyId}
//
// Schema:
//   studyName    - display ('CXR PA/lat', 'CT head w/o contrast', 'ECG 12-lead')
//   region       - body region
//   indication   - clinical reason
//   status       - 'ordered' | 'in-progress' | 'resulted'
//   impression   - radiologist read / interpreter summary (free text)
//   orderedH     - hours-from-now ordered (negative)
//   resultedH    - hours-from-now resulted (negative; may be null if pending)
//   orderedBy / resultedBy - defaults to 'Provider (seeded)' / 'Radiology (seeded)'
// =========================================================
const SEED_IMAGING = {
    p_priya_kapoor: [
        { studyName: 'CXR portable',  region: 'Chest', indication: 'Sepsis source eval - r/o PNA',
          status: 'resulted', orderedH: -3.5, resultedH: -2.5,
          impression: 'Bibasilar patchy opacities, R > L, c/w multifocal pneumonia. No effusion. No pneumothorax. Heart size normal.' }
    ],
    p_miguel_torres: [
        { studyName: 'ECG 12-lead', region: 'Cardiac', indication: 'Chest pain, EMS - STEMI alert',
          status: 'resulted', orderedH: -6, resultedH: -5.8,
          impression: 'Sinus rhythm rate 88. ST elevation 3 mm V2-V4 c/w anterior STEMI. Reciprocal STD inferior leads. Activate cath lab.' },
        { studyName: 'TTE (echo)', region: 'Cardiac', indication: 'Post-PCI EF + wall-motion eval',
          status: 'in-progress', orderedH: -2, resultedH: null,
          impression: 'Pending - scheduled today after cardiology consult.' },
        { studyName: 'CXR portable', region: 'Chest', indication: 'Post-PCI / line check',
          status: 'resulted', orderedH: -3, resultedH: -2.7,
          impression: 'Right IJ central line tip in distal SVC. No pneumothorax. Lungs clear. Heart size normal. ETT not present.' }
    ],
    p_dorothy_nguyen: [
        { studyName: 'CXR portable', region: 'Chest', indication: 'COPD exacerbation - r/o PNA, eval hyperinflation',
          status: 'resulted', orderedH: -4, resultedH: -3.2,
          impression: 'Hyperinflation with flattened diaphragms c/w COPD. No focal infiltrate. No effusion. No pneumothorax. Heart size normal.' }
    ],
    p_robert_dimaggio: [
        { studyName: 'CXR portable', region: 'Chest', indication: 'CHF - eval pulmonary edema',
          status: 'resulted', orderedH: -22, resultedH: -21.5,
          impression: 'Cardiomegaly. Bilateral interstitial markings, Kerley B lines, small bilateral pleural effusions c/w pulmonary edema. No focal consolidation.' },
        { studyName: 'TTE (echo)', region: 'Cardiac', indication: 'CHF exacerbation - re-eval EF',
          status: 'resulted', orderedH: -22, resultedH: -8,
          impression: 'EF 25-30% (down from 35% prior). Severe LV systolic dysfunction. Moderate MR. Akinetic apex (chronic).' }
    ],
    p_leonard_kowalski: [
        { studyName: 'CT head w/o contrast', region: 'Brain', indication: 'TIA vs CVA r/o; on warfarin r/o ICH',
          status: 'resulted', orderedH: -1, resultedH: -0.3,
          impression: 'No acute intracranial hemorrhage. Small hypodensity left MCA territory c/w evolving acute infarct. Old lacunar infarcts in pons. Recommend MRI brain w/ DWI for further characterization.' },
        { studyName: 'MRI brain w/ DWI', region: 'Brain', indication: 'Confirm acute infarct',
          status: 'ordered', orderedH: -0.5, resultedH: null,
          impression: 'Pending - scheduled.' },
        { studyName: 'Carotid US', region: 'Neck', indication: 'Stroke workup',
          status: 'ordered', orderedH: -0.5, resultedH: null,
          impression: 'Pending - scheduled.' }
    ],
    p_marcus_webb: [
        { studyName: 'ECG 12-lead', region: 'Cardiac', indication: 'Atypical chest pain',
          status: 'resulted', orderedH: -1.5, resultedH: -1.4,
          impression: 'Sinus rhythm rate 78. No ST changes. No T-wave inversions. No prior available for comparison.' },
        { studyName: 'CXR PA/lat', region: 'Chest', indication: 'Chest pain - r/o PNA / pneumothorax',
          status: 'resulted', orderedH: -1.5, resultedH: -1.2,
          impression: 'Lungs clear. No focal consolidation. No effusion. Heart size normal. Mediastinal contour normal.' }
    ],
    p_walter_huang: [
        { studyName: 'CXR portable', region: 'Chest', indication: 'Recurrent aspiration - eval',
          status: 'resulted', orderedH: -16, resultedH: -15.5,
          impression: 'RLL infiltrate c/w aspiration pneumonia. No effusion. Heart size normal.' }
    ],
    p_sofia_reyes: [
        { studyName: 'CT abdomen/pelvis w/ IV contrast', region: 'Abdomen/Pelvis', indication: 'RLQ pain - r/o appendicitis',
          status: 'resulted', orderedH: -2, resultedH: -1.5,
          impression: 'Acute appendicitis. Appendix dilated to 12 mm with periappendiceal fat stranding. No perforation. No abscess. Recommend surgical consult.' }
    ],
    p_thomas_brandt: [
        { studyName: 'XR R hip + pelvis', region: 'R hip', indication: 'Mechanical fall, R hip pain',
          status: 'resulted', orderedH: -2, resultedH: -1.7,
          impression: 'Displaced intertrochanteric R femur fracture. No other acute fracture. Severe degenerative changes bilateral hips (chronic).' },
        { studyName: 'CXR PA/lat', region: 'Chest', indication: 'Pre-op clearance',
          status: 'resulted', orderedH: -2, resultedH: -1.5,
          impression: 'Mild cardiomegaly, otherwise unremarkable. No acute infiltrate.' }
    ],
    p_helen_cho: [
        { studyName: 'XR R knee', region: 'R knee', indication: 'POD#2 - confirm hardware position',
          status: 'resulted', orderedH: -36, resultedH: -34,
          impression: 'TKR hardware in good anatomic alignment. No periprosthetic fracture. Mild post-op soft tissue swelling.' }
    ],
    p_denise_abara: [
        { studyName: 'CXR portable', region: 'Chest', indication: 'POD#3 CABG - line/tube check',
          status: 'resulted', orderedH: -8, resultedH: -7.5,
          impression: 'Median sternotomy wires intact. Mediastinal chest tube tip in expected position. No pneumothorax. Mild bibasilar atelectasis (expected post-op).' }
    ],
    p_amara_diallo: [
        { studyName: 'CXR PA/lat', region: 'Chest', indication: 'Asthma exacerbation - r/o PNA',
          status: 'resulted', orderedH: -1, resultedH: -0.5,
          impression: 'Hyperinflation. No focal consolidation. No effusion. No pneumothorax.' }
    ],
    p_angela_freeman: [
        { studyName: 'CXR PA/lat', region: 'Chest', indication: 'DKA - r/o source of trigger',
          status: 'resulted', orderedH: -18, resultedH: -17.2,
          impression: 'Lungs clear. No focal consolidation. No acute cardiopulmonary process.' }
    ]
};

// =========================================================
// EXPORT
// =========================================================
window.EMR_SEED = {
    SEED_VERSION: SEED_VERSION,
    ALLERGY_TRIGGERS: ALLERGY_TRIGGERS,
    ALLERGY_REACTION_MAP: ALLERGY_REACTION_MAP,
    CROSS_REACTIVITY_MAP: CROSS_REACTIVITY_MAP,
    DRUG_CLASS_MAP: DRUG_CLASS_MAP,
    expandAllergy: expandAllergy,
    SEED_PATIENTS: SEED_PATIENTS,
    SEED_UNADMITTED_PATIENTS: SEED_UNADMITTED_PATIENTS,
    CHART_BY_PATIENT: CHART_BY_PATIENT,
    UNADMITTED_PRIOR_CHART: UNADMITTED_PRIOR_CHART,
    SEED_LDAS: SEED_LDAS,
    SEED_ORDERS: SEED_ORDERS,
    SEED_MD_LIST: SEED_MD_LIST,
    findMdByName: findMdByName,
    pickMdForEncounter: pickMdForEncounter,
    LAB_PANELS: LAB_PANELS,
    SEED_LABS: SEED_LABS,
    SEED_IMAGING: SEED_IMAGING
};
