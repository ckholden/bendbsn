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

const SEED_VERSION = 2;

// ---- Allergy → med-name substring triggers (case-insensitive) ----
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
            { med: 'Warfarin',     dose: '5 mg',    route: 'PO', freq: 'Daily' },
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
                { medication: 'Atorvastatin', dose: '80 mg', route: 'PO', frequency: 'Daily', scheduledTime: '2100', isPRN: false, status: 'held', notes: 'Held per stroke protocol' },
                { medication: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily', scheduledTime: '0800', isPRN: false, status: 'held', notes: 'Held — permissive HTN' },
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
                { medication: 'Insulin Regular drip', dose: 'Per protocol', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Insulin Lispro (sliding scale)', dose: 'Per scale', route: 'SubQ', frequency: 'AC + HS', scheduledTime: '0700,1130,1700,2100', isPRN: false },
                { medication: 'Potassium Chloride', dose: '20 mEq', route: 'IV', frequency: 'Q4H per protocol', scheduledTime: '0800,1200,1600,2000', isPRN: false },
                { medication: '0.9% Normal Saline', dose: '125 mL/hr', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false }
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
        mar: [{ medication: 'Oxycodone', dose: '5 mg', route: 'PO', frequency: 'Q4H PRN pain', status: 'given' }]
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
// EXPORT
// =========================================================
window.EMR_SEED = {
    SEED_VERSION: SEED_VERSION,
    ALLERGY_TRIGGERS: ALLERGY_TRIGGERS,
    SEED_PATIENTS: SEED_PATIENTS,
    SEED_UNADMITTED_PATIENTS: SEED_UNADMITTED_PATIENTS,
    CHART_BY_PATIENT: CHART_BY_PATIENT,
    UNADMITTED_PRIOR_CHART: UNADMITTED_PRIOR_CHART
};
