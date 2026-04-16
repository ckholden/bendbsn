/* =========================================================
   BendBSN Sim EMR — Seed Data
   18 fictional patients, allergies, MAR + TAR items.
   Editing this file: bump SEED_VERSION so existing data
   shows the "new scenarios available" banner.

   ALL DATA IS FICTIONAL.
   No real NDC codes, NPIs, MRNs, or provider identities.
   ========================================================= */

const SEED_VERSION = 1;

// ---- Allergy → trigger med name keywords ----
// (case-insensitive substring match against med name)
const ALLERGY_TRIGGERS = {
    'Penicillin':   ['amoxicillin', 'ampicillin', 'piperacillin', 'penicillin', 'nafcillin', 'oxacillin'],
    'Sulfa':        ['sulfamethoxazole', 'bactrim', 'sulfa', 'tmp-smx'],
    'NSAIDs':       ['ibuprofen', 'naproxen', 'ketorolac', 'aspirin'],
    'Aspirin':      ['aspirin'],
    'Codeine':      ['codeine'],
    'Morphine':     ['morphine'],
    'Latex':        [], // documented but no med trigger
    'Iodine':       ['iodine', 'povidone-iodine'],
    'Shellfish':    [], // documented but no med trigger
    'Eggs':         ['propofol'], // propofol contains egg lecithin
    'Peanuts':      [],
    'Heparin':      ['heparin', 'enoxaparin'],
    'Statins':      ['atorvastatin', 'simvastatin', 'rosuvastatin'],
    'ACE inhibitors': ['lisinopril', 'enalapril', 'ramipril']
};

// ---- Patients: 18 across 5 units ----
const SEED_PATIENTS = [
    // ===== ED =====
    {
        id: 'p_marcus_webb', unit: 'ED', bed: 'ED-01',
        name: 'Marcus Webb', sex: 'M', age: 34, dob: '1991-08-12',
        mrn: 'SIM-10001', dx: 'Chest pain — r/o ACS',
        md: 'Dr. Avery Chen, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 4,
        diet: 'NPO until r/o', activity: 'Bed rest', ivAccess: '20g L AC',
        weightKg: 88, heightIn: 71
    },
    {
        id: 'p_amara_diallo', unit: 'ED', bed: 'ED-02',
        name: 'Amara Diallo', sex: 'F', age: 22, dob: '2003-11-04',
        mrn: 'SIM-10002', dx: 'Acute asthma exacerbation',
        md: 'Dr. Avery Chen, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 3,
        diet: 'Regular', activity: 'As tolerated', ivAccess: '22g R hand',
        weightKg: 62, heightIn: 65
    },
    {
        id: 'p_leonard_kowalski', unit: 'ED', bed: 'ED-03',
        name: 'Leonard Kowalski', sex: 'M', age: 67, dob: '1958-05-23',
        mrn: 'SIM-10003', dx: 'TIA / r/o CVA',
        md: 'Dr. Sora Patel, MD-SIM',
        codeStatus: 'Full Code', allergies: ['Aspirin'],
        isolation: null, fallRisk: true, dnr: false, acuity: 4,
        diet: 'NPO pending swallow eval', activity: 'Bed rest', ivAccess: '20g L AC',
        weightKg: 84, heightIn: 70
    },
    {
        id: 'p_sofia_reyes', unit: 'ED', bed: 'ED-04',
        name: 'Sofia Reyes', sex: 'F', age: 28, dob: '1997-02-19',
        mrn: 'SIM-10004', dx: 'Acute appendicitis — pre-op',
        md: 'Dr. Maya Lin, MD-SIM',
        codeStatus: 'Full Code', allergies: ['Penicillin', 'Latex'],
        isolation: null, fallRisk: false, dnr: false, acuity: 3,
        diet: 'NPO', activity: 'Bed rest', ivAccess: '18g L AC',
        weightKg: 64, heightIn: 64
    },
    {
        id: 'p_thomas_brandt', unit: 'ED', bed: 'ED-05',
        name: 'Thomas Brandt', sex: 'M', age: 78, dob: '1947-09-30',
        mrn: 'SIM-10005', dx: 'Right hip fracture — pending OR',
        md: 'Dr. Maya Lin, MD-SIM',
        codeStatus: 'DNR', allergies: ['Codeine'],
        isolation: null, fallRisk: true, dnr: true, acuity: 4,
        diet: 'NPO', activity: 'Bed rest', ivAccess: '20g L hand',
        weightKg: 76, heightIn: 69
    },
    {
        id: 'p_priya_kapoor', unit: 'ED', bed: 'ED-06',
        name: 'Priya Kapoor', sex: 'F', age: 44, dob: '1981-07-15',
        mrn: 'SIM-10006', dx: 'Sepsis — UTI source',
        md: 'Dr. Avery Chen, MD-SIM',
        codeStatus: 'Full Code', allergies: ['Sulfa'],
        isolation: null, fallRisk: false, dnr: false, acuity: 5,
        diet: 'Regular', activity: 'As tolerated', ivAccess: '18g R AC, 20g L AC',
        weightKg: 70, heightIn: 64
    },
    {
        id: 'p_james_holloway', unit: 'ED', bed: 'ED-07',
        name: 'James Holloway', sex: 'M', age: 52, dob: '1973-12-08',
        mrn: 'SIM-10007', dx: 'Acute pancreatitis',
        md: 'Dr. Sora Patel, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 4,
        diet: 'NPO', activity: 'As tolerated', ivAccess: '18g R AC',
        weightKg: 95, heightIn: 72
    },

    // ===== Med-Surg =====
    {
        id: 'p_helen_cho', unit: 'MS', bed: 'MS-02',
        name: 'Helen Cho', sex: 'F', age: 61, dob: '1964-04-11',
        mrn: 'SIM-10008', dx: 'Post-op TKR right knee — POD #2',
        md: 'Dr. Reuben Park, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: true, dnr: false, acuity: 3,
        diet: 'Regular', activity: 'OOB with PT, weight bearing as tolerated',
        ivAccess: 'Saline lock R hand', weightKg: 72, heightIn: 63
    },
    {
        id: 'p_robert_dimaggio', unit: 'MS', bed: 'MS-04',
        name: 'Robert DiMaggio', sex: 'M', age: 71, dob: '1954-06-26',
        mrn: 'SIM-10009', dx: 'CHF exacerbation — fluid mgmt',
        md: 'Dr. Reuben Park, MD-SIM',
        codeStatus: 'DNR/DNI', allergies: ['ACE inhibitors'],
        isolation: null, fallRisk: true, dnr: true, acuity: 3,
        diet: '2g sodium, 1500 mL fluid restriction', activity: 'OOB with assist',
        ivAccess: '22g L hand', weightKg: 92, heightIn: 70
    },
    {
        id: 'p_angela_freeman', unit: 'MS', bed: 'MS-06',
        name: 'Angela Freeman', sex: 'F', age: 38, dob: '1987-03-02',
        mrn: 'SIM-10010', dx: 'DKA resolving — insulin protocol',
        md: 'Dr. Reuben Park, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 3,
        diet: 'Carb-controlled diabetic', activity: 'As tolerated',
        ivAccess: '18g L AC', weightKg: 68, heightIn: 66
    },
    {
        id: 'p_walter_huang', unit: 'MS', bed: 'MS-09',
        name: 'Walter Huang', sex: 'M', age: 83, dob: '1942-10-19',
        mrn: 'SIM-10011', dx: 'Aspiration pneumonia — dysphagia',
        md: 'Dr. Reuben Park, MD-SIM',
        codeStatus: 'DNR', allergies: ['Penicillin'],
        isolation: 'Droplet', fallRisk: true, dnr: true, acuity: 4,
        diet: 'Pureed, thickened liquids (nectar)', activity: 'Bed rest',
        ivAccess: '20g R AC', weightKg: 66, heightIn: 67
    },

    // ===== ICU =====
    {
        id: 'p_dorothy_nguyen', unit: 'ICU', bed: 'ICU-01',
        name: 'Dorothy Nguyen', sex: 'F', age: 76, dob: '1949-01-14',
        mrn: 'SIM-10012', dx: 'COPD — hypercapnic resp failure on BiPAP',
        md: 'Dr. Lin Okafor, MD-SIM',
        codeStatus: 'DNR/DNI', allergies: ['Sulfa'],
        isolation: null, fallRisk: false, dnr: true, acuity: 5,
        diet: 'NPO (BiPAP)', activity: 'Bed rest, HOB 30°',
        ivAccess: 'Triple-lumen R IJ', weightKg: 58, heightIn: 62
    },
    {
        id: 'p_miguel_torres', unit: 'ICU', bed: 'ICU-03',
        name: 'Miguel Torres', sex: 'M', age: 58, dob: '1967-05-29',
        mrn: 'SIM-10013', dx: 'STEMI s/p PCI — cardiac monitoring',
        md: 'Dr. Lin Okafor, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 5,
        diet: 'Cardiac (low-sodium, low-fat)', activity: 'Bed rest x 24h',
        ivAccess: '18g R AC, A-line L radial', weightKg: 88, heightIn: 70
    },
    {
        id: 'p_rachel_okonkwo', unit: 'ICU', bed: 'ICU-07',
        name: 'Rachel Okonkwo', sex: 'F', age: 31, dob: '1994-08-22',
        mrn: 'SIM-10014', dx: 'Eclampsia, postpartum — Mag drip',
        md: 'Dr. Lin Okafor, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: true, dnr: false, acuity: 5,
        diet: 'Clear liquids', activity: 'Bed rest, seizure precautions',
        ivAccess: '18g R AC, 18g L AC', weightKg: 78, heightIn: 65
    },

    // ===== PCU =====
    {
        id: 'p_denise_abara', unit: 'PCU', bed: 'PCU-02',
        name: 'Denise Abara', sex: 'F', age: 66, dob: '1959-09-17',
        mrn: 'SIM-10015', dx: 'Post-CABG POD #3 — step-down',
        md: 'Dr. Lin Okafor, MD-SIM',
        codeStatus: 'Full Code', allergies: ['Heparin'],
        isolation: null, fallRisk: true, dnr: false, acuity: 3,
        diet: 'Cardiac', activity: 'OOB with assist',
        ivAccess: 'Saline lock L hand', weightKg: 80, heightIn: 64
    },
    {
        id: 'p_frank_ostrowski', unit: 'PCU', bed: 'PCU-06',
        name: 'Frank Ostrowski', sex: 'M', age: 74, dob: '1951-11-03',
        mrn: 'SIM-10016', dx: 'COPD — O2 weaning, ambulation log',
        md: 'Dr. Reuben Park, MD-SIM',
        codeStatus: 'DNR', allergies: ['NSAIDs'],
        isolation: null, fallRisk: true, dnr: true, acuity: 3,
        diet: 'Regular', activity: 'Ambulate q4h with O2',
        ivAccess: 'Saline lock R hand', weightKg: 71, heightIn: 68
    },

    // ===== OB / L&D =====
    {
        id: 'p_kezia_williams', unit: 'OB', bed: 'OB-01',
        name: 'Kezia Williams', sex: 'F', age: 29, dob: '1996-06-12',
        mrn: 'SIM-10017', dx: 'Active labor G2P1, oxytocin protocol',
        md: 'Dr. Sora Patel, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 4,
        diet: 'Clear liquids / ice chips', activity: 'Bed/ambulation per provider',
        ivAccess: '18g L AC', weightKg: 82, heightIn: 67
    },
    {
        id: 'p_natalie_chen', unit: 'OB', bed: 'OB-04',
        name: 'Natalie Chen', sex: 'F', age: 33, dob: '1992-12-30',
        mrn: 'SIM-10018', dx: 'Postpartum POD #1 — fundus/lochia q4h',
        md: 'Dr. Sora Patel, MD-SIM',
        codeStatus: 'Full Code', allergies: ['NKDA'],
        isolation: null, fallRisk: false, dnr: false, acuity: 2,
        diet: 'Regular', activity: 'OOB ad lib',
        ivAccess: 'Saline lock R hand', weightKg: 70, heightIn: 65
    }
];

// ---- MAR seed: medications scheduled per patient ----
const SEED_MAR = {
    p_marcus_webb: [
        { medication: 'Aspirin', dose: '325 mg', route: 'PO', frequency: 'Once', scheduledTime: '0800', isPRN: false },
        { medication: 'Nitroglycerin', dose: '0.4 mg', route: 'SL', frequency: 'PRN chest pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Chest pain' },
        { medication: 'Atorvastatin', dose: '40 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false },
        { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false }
    ],
    p_amara_diallo: [
        { medication: 'Albuterol-Ipratropium Nebulizer', dose: '3 mL', route: 'NEB', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000', isPRN: false },
        { medication: 'Methylprednisolone', dose: '60 mg', route: 'IV', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
        { medication: 'Albuterol HFA', dose: '2 puffs', route: 'INH', frequency: 'PRN SOB', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Shortness of breath' }
    ],
    p_leonard_kowalski: [
        { medication: 'Atorvastatin', dose: '80 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false, status: 'held', notes: 'Held per stroke protocol' },
        { medication: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false, status: 'held', notes: 'Held — permissive HTN' },
        { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain or fever' }
    ],
    p_sofia_reyes: [
        { medication: 'Cefazolin', dose: '2 g', route: 'IV', frequency: 'Pre-op once', scheduledTime: '0700', isPRN: false },
        { medication: 'Ondansetron', dose: '4 mg', route: 'IV', frequency: 'Q6H PRN N/V', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Nausea/vomiting' },
        { medication: 'Morphine', dose: '4 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' }
    ],
    p_thomas_brandt: [
        { medication: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
        { medication: 'Enoxaparin', dose: '40 mg', route: 'SubQ', frequency: 'Daily', scheduledTime: '2000', isPRN: false },
        { medication: 'Hydromorphone', dose: '0.5 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' },
        { medication: 'Docusate Sodium', dose: '100 mg', route: 'PO', frequency: 'BID', scheduledTime: '0900,2100', isPRN: false }
    ],
    p_priya_kapoor: [
        { medication: 'Piperacillin-Tazobactam', dose: '4.5 g', route: 'IV', frequency: 'Q8H', scheduledTime: '0800,1600,2400', isPRN: false },
        { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN fever', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Temp >38.5°C' },
        { medication: 'Norepinephrine drip', dose: '0.05 mcg/kg/min', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
        { medication: 'Lactated Ringer\'s', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
    ],
    p_james_holloway: [
        { medication: 'Hydromorphone', dose: '1 mg', route: 'IV', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >5/10' },
        { medication: 'Ondansetron', dose: '4 mg', route: 'IV', frequency: 'Q6H PRN N/V', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Nausea/vomiting' },
        { medication: 'Pantoprazole', dose: '40 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Lactated Ringer\'s', dose: '150 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
    ],
    p_helen_cho: [
        { medication: 'Oxycodone', dose: '5 mg', route: 'PO', frequency: 'Q4H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >4/10' },
        { medication: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
        { medication: 'Enoxaparin', dose: '40 mg', route: 'SubQ', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Cefazolin', dose: '1 g', route: 'IV', frequency: 'Q8H x 24h post-op', scheduledTime: '0800,1600,2400', isPRN: false }
    ],
    p_robert_dimaggio: [
        { medication: 'Furosemide', dose: '40 mg', route: 'IV', frequency: 'BID', scheduledTime: '0800,1600', isPRN: false },
        { medication: 'Carvedilol', dose: '12.5 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
        { medication: 'Spironolactone', dose: '25 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Potassium Chloride', dose: '20 mEq', route: 'PO', frequency: 'Daily', scheduledTime: '0900', isPRN: false }
    ],
    p_angela_freeman: [
        { medication: 'Insulin Regular drip', dose: 'Per protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
        { medication: 'Insulin Lispro (sliding scale)', dose: 'Per scale', route: 'SubQ', frequency: 'AC + HS', scheduledTime: '0700,1130,1700,2100', isPRN: false },
        { medication: 'Potassium Chloride', dose: '20 mEq', route: 'IV', frequency: 'Q4H per protocol', scheduledTime: '0800,1200,1600,2000', isPRN: false },
        { medication: '0.9% Normal Saline', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
    ],
    p_walter_huang: [
        { medication: 'Ceftriaxone', dose: '1 g', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Azithromycin', dose: '500 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Acetaminophen', dose: '650 mg', route: 'PR', frequency: 'Q6H PRN fever', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Temp >38.5°C' }
    ],
    p_dorothy_nguyen: [
        { medication: 'Methylprednisolone', dose: '40 mg', route: 'IV', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
        { medication: 'Albuterol-Ipratropium Nebulizer', dose: '3 mL', route: 'NEB', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000', isPRN: false },
        { medication: 'Levofloxacin', dose: '750 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Pantoprazole', dose: '40 mg', route: 'IV', frequency: 'Daily', scheduledTime: '0800', isPRN: false }
    ],
    p_miguel_torres: [
        { medication: 'Aspirin', dose: '81 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Ticagrelor', dose: '90 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
        { medication: 'Atorvastatin', dose: '80 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false },
        { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
        { medication: 'Heparin drip', dose: 'Per protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
    ],
    p_rachel_okonkwo: [
        { medication: 'Magnesium Sulfate drip', dose: '2 g/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
        { medication: 'Labetalol', dose: '20 mg', route: 'IV', frequency: 'Q15min PRN SBP >160', scheduledTime: 'PRN', isPRN: true, prnIndication: 'SBP >160 mmHg' },
        { medication: 'Calcium Gluconate', dose: '1 g', route: 'IV', frequency: 'PRN Mg toxicity', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Mg toxicity / RR <12' }
    ],
    p_denise_abara: [
        { medication: 'Aspirin', dose: '81 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Metoprolol Tartrate', dose: '25 mg', route: 'PO', frequency: 'BID', scheduledTime: '0800,2000', isPRN: false },
        { medication: 'Furosemide', dose: '20 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain >4/10' }
    ],
    p_frank_ostrowski: [
        { medication: 'Tiotropium', dose: '1 cap', route: 'INH', frequency: 'Daily', scheduledTime: '0800', isPRN: false },
        { medication: 'Albuterol HFA', dose: '2 puffs', route: 'INH', frequency: 'Q4H PRN', scheduledTime: 'PRN', isPRN: true, prnIndication: 'SOB or wheezing' },
        { medication: 'Prednisone', dose: '20 mg', route: 'PO', frequency: 'Daily x 5d', scheduledTime: '0800', isPRN: false }
    ],
    p_kezia_williams: [
        { medication: 'Oxytocin drip', dose: 'Per protocol (titrate to contractions)', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
        { medication: 'Lactated Ringer\'s', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
        { medication: 'Fentanyl', dose: '50 mcg', route: 'IV', frequency: 'Q1H PRN labor pain', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Labor pain' }
    ],
    p_natalie_chen: [
        { medication: 'Ibuprofen', dose: '600 mg', route: 'PO', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400', isPRN: false },
        { medication: 'Acetaminophen', dose: '650 mg', route: 'PO', frequency: 'Q6H PRN', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Pain or fever' },
        { medication: 'Docusate Sodium', dose: '100 mg', route: 'PO', frequency: 'BID', scheduledTime: '0900,2100', isPRN: false }
    ]
};

// ---- TAR seed: treatments per patient ----
const SEED_TAR = {
    p_marcus_webb: [
        { treatment: '12-lead ECG', frequency: 'Q4H x 24h', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'Continuous cardiac monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' }
    ],
    p_amara_diallo: [
        { treatment: 'Pulse oximetry monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Peak flow measurement', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
    ],
    p_leonard_kowalski: [
        { treatment: 'Neuro checks (NIHSS)', frequency: 'Q1H x 12h, then Q2H', scheduledTime: '0800,0900,1000,1100,1200' },
        { treatment: 'Bedside swallow screen', frequency: 'Once before any PO', scheduledTime: '0900' }
    ],
    p_sofia_reyes: [
        { treatment: 'Pre-op skin prep', frequency: 'Once', scheduledTime: '0700' },
        { treatment: 'SCDs to bilateral lower extremities', frequency: 'Continuous', scheduledTime: 'Continuous' }
    ],
    p_thomas_brandt: [
        { treatment: 'SCDs to bilateral lower extremities', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Skin assessment / Braden', frequency: 'Q12H', scheduledTime: '0800,2000' },
        { treatment: 'Fall precautions: bed alarm, low bed', frequency: 'Continuous', scheduledTime: 'Continuous' }
    ],
    p_priya_kapoor: [
        { treatment: 'Hourly vitals + urine output', frequency: 'Q1H', scheduledTime: '0800,0900,1000,1100,1200' },
        { treatment: 'Foley catheter care', frequency: 'Q12H', scheduledTime: '0800,2000' },
        { treatment: 'Lactate level (lab draw)', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400' }
    ],
    p_james_holloway: [
        { treatment: 'Strict I&O', frequency: 'Q1H', scheduledTime: 'Q1H' },
        { treatment: 'Lipase / amylase (lab)', frequency: 'Q12H', scheduledTime: '0600,1800' }
    ],
    p_helen_cho: [
        { treatment: 'Surgical wound assessment + dressing change', frequency: 'Daily', scheduledTime: '0800' },
        { treatment: 'Knee CPM machine 30°→90° as tolerated', frequency: 'Q4H x 30min', scheduledTime: '0900,1300,1700,2100' },
        { treatment: 'SCDs to L lower extremity (R post-op)', frequency: 'Continuous when in bed', scheduledTime: 'Continuous' }
    ],
    p_robert_dimaggio: [
        { treatment: 'Daily weight (same scale, same time)', frequency: 'Daily', scheduledTime: '0600' },
        { treatment: 'Strict I&O', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
    ],
    p_angela_freeman: [
        { treatment: 'Bedside glucose check', frequency: 'Q1H until off drip', scheduledTime: 'Q1H' },
        { treatment: 'BMP / electrolytes (lab)', frequency: 'Q4H', scheduledTime: '0400,0800,1200,1600,2000' }
    ],
    p_walter_huang: [
        { treatment: 'Oral suction + oral care', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'HOB ≥30° at all times', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Droplet precautions sign', frequency: 'Continuous', scheduledTime: 'Continuous' }
    ],
    p_dorothy_nguyen: [
        { treatment: 'BiPAP settings check + mask seal', frequency: 'Q1H', scheduledTime: 'Q1H' },
        { treatment: 'ABG (lab)', frequency: 'Q4H', scheduledTime: '0400,0800,1200,1600,2000,2400' },
        { treatment: 'Central line dressing assessment', frequency: 'Q12H', scheduledTime: '0800,2000' }
    ],
    p_miguel_torres: [
        { treatment: 'Continuous telemetry', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'A-line zero + waveform check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'Femoral access site check', frequency: 'Q1H x 6h', scheduledTime: '0800,0900,1000,1100,1200,1300' },
        { treatment: 'aPTT (heparin protocol)', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400' }
    ],
    p_rachel_okonkwo: [
        { treatment: 'Mag-tox check (DTRs, RR, U/O)', frequency: 'Q1H', scheduledTime: 'Q1H' },
        { treatment: 'Strict I&O', frequency: 'Q1H', scheduledTime: 'Q1H' },
        { treatment: 'Seizure precautions / padded rails', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Neuro check', frequency: 'Q1H', scheduledTime: 'Q1H' }
    ],
    p_denise_abara: [
        { treatment: 'Sternal incision assessment', frequency: 'Q8H', scheduledTime: '0800,1600,2400' },
        { treatment: 'Telemetry', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Daily weight', frequency: 'Daily', scheduledTime: '0600' }
    ],
    p_frank_ostrowski: [
        { treatment: 'O2 weaning trial — RA SpO2 check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'Ambulation log (distance + SpO2)', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' }
    ],
    p_kezia_williams: [
        { treatment: 'Continuous fetal monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' },
        { treatment: 'Cervical exam', frequency: 'Q2H or as indicated', scheduledTime: 'Q2H' },
        { treatment: 'Vital signs + contraction pattern', frequency: 'Q15min', scheduledTime: 'Q15min' }
    ],
    p_natalie_chen: [
        { treatment: 'Fundus + lochia assessment', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'Perineal/peri-pad check', frequency: 'Q4H', scheduledTime: '0800,1200,1600,2000' },
        { treatment: 'Breastfeeding support / latch check', frequency: 'PRN', scheduledTime: 'PRN' }
    ]
};

// Expose globally for emr/index.html
window.EMR_SEED = {
    SEED_VERSION: SEED_VERSION,
    SEED_PATIENTS: SEED_PATIENTS,
    SEED_MAR: SEED_MAR,
    SEED_TAR: SEED_TAR,
    ALLERGY_TRIGGERS: ALLERGY_TRIGGERS
};
