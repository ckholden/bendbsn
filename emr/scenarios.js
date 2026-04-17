/* =========================================================
   BendBSN Sim EMR — Scenario Packs (Phase 3F-lite)

   Each scenario is a function that builds a "scenario plan":
       {
         patients: [{...}],       // patient records (with currentEncounter inline)
         unadmitted: [{...}],     // patients without an active encounter
         waitingRoom: [{...}],    // ED encounters with bed: 'WAITING' (separate to keep readable)
         priorEncounters: {...},  // patientId → priorEncounter array (back-history)
         marByPid: {...},         // patientId → array of MAR items
         tarByPid: {...},         // patientId → array of TAR items
         notesByPid: {...},       // patientId → array of seeded notes
         ldasByPid: {...}         // patientId → array of seeded LDAs
       }

   The actual translation to Firebase writes happens in emr/index.html
   (loadScenario() / scenarioToWrites()).

   ALL DATA IS FICTIONAL.
   ========================================================= */

(function () {
    'use strict';

    function daysAgoTS(n, hour) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        d.setHours(hour || 8, 0, 0, 0);
        return d.getTime();
    }
    function minutesAgoTS(n) { return Date.now() - n * 60000; }

    // =========================================================
    // SCENARIO 1: Quiet Day — current 18 admitted + 4 waiting room
    // =========================================================
    function quietDay(seed) {
        // Reuse the existing seed dictionaries verbatim, but inject a pending transfer
        // on Helen Cho (TKR POD#2 — pending PCU step-down for cardiac monitoring)
        // so students can practice the receiving-unit accept workflow.
        const patients = seed.SEED_PATIENTS.map(function (p) {
            if (p.id !== 'p_helen_cho') return p;
            const enc = Object.assign({}, p.currentEncounter, {
                pendingTransfer: {
                    toUnit: 'PCU',
                    reason: 'Step-down for telemetry monitoring x 24h post-op (cardiac hx).',
                    requestedBy: 'Dr. Reuben Park, MD-SIM',
                    requestedAt: minutesAgoTS(45),
                    reportGivenTo: 'PCU Charge RN'
                }
            });
            return Object.assign({}, p, { currentEncounter: enc });
        });
        const unadmitted = seed.SEED_UNADMITTED_PATIENTS.slice();

        // Add 4 patients to ED waiting room. Mix of new + returning.
        // Two are NEW patients (created here); two reference existing unadmitted patients.
        const waitingRoom = [
            // NEW patient — Tomas Reyes
            {
                isNew: true,
                patient: {
                    id: 'p_wr_tomas_reyes',
                    name: 'Tomas Reyes', sex: 'M', age: 38, dob: '1987-09-21',
                    mrn: 'SIM-30001', allergies: ['NKDA'],
                    pmh: 'Unremarkable. Smoker (10 pack-yr).',
                    homeMedications: [],
                    socialHx: 'Plumber. Smoker (10 pack-yr). Social ETOH on weekends.'
                },
                encounter: {
                    unit: 'ED', bed: 'WAITING',
                    admissionSource: 'ED-walkin',
                    admissionDate: minutesAgoTS(45),
                    md: 'Dr. Avery Chen, MD-SIM',
                    dx: 'Cough x 2 weeks, low-grade fever — eval',
                    chiefComplaint: 'Cough x 2 weeks, low-grade fever, fatigue. Tried OTC meds without relief.',
                    esiAcuity: 3, arrivalMode: 'walk-in',
                    codeStatus: 'Full Code',
                    diet: 'Regular', activity: 'As tolerated',
                    isolation: null, fallRisk: false, dnr: false, acuity: 3
                },
                notes: [
                    { authorRole: 'RN', by: 'Triage RN (seeded)', offsetMin: -45,
                      body: 'Triage: Pt amb to triage c/o productive cough x 2 wks, low-grade fever 38.2, fatigue. T 38.2, HR 92, BP 128/78, SpO2 96 RA. No respiratory distress. Awaits bed assignment.' }
                ]
            },
            // RETURNING patient — Olivia Smith (already in unadmitted)
            {
                isNew: false,
                patientId: 'p_olivia_smith',
                encounter: {
                    unit: 'ED', bed: 'WAITING',
                    admissionSource: 'ED-walkin',
                    admissionDate: minutesAgoTS(30),
                    md: 'Dr. Sora Patel, MD-SIM',
                    dx: 'Migraine, possibly status migrainosus',
                    chiefComplaint: 'Severe migraine x 36 hours, photophobia, nausea, similar to prior admission. Sumatriptan x 2 doses ineffective.',
                    esiAcuity: 3, arrivalMode: 'walk-in',
                    codeStatus: 'Full Code',
                    diet: 'NPO until eval', activity: 'Bed rest',
                    isolation: null, fallRisk: false, dnr: false, acuity: 3
                },
                notes: [
                    { authorRole: 'RN', by: 'Triage RN (seeded)', offsetMin: -30,
                      body: 'Triage: Pt arrives via spouse, dimmed sunglasses, holding emesis basin. States "this is the same as last time." Pain 9/10. Prior admission ' + (function () { const d = new Date(); d.setDate(d.getDate() - 45); return d.toISOString().slice(0, 10); })() + ' for status migrainosus — see Encounters tab.' }
                ]
            },
            // NEW patient — Elena Vasquez (peds)
            {
                isNew: true,
                patient: {
                    id: 'p_wr_elena_vasquez',
                    name: 'Elena Vasquez', sex: 'F', age: 0, dob: '2025-10-22',
                    mrn: 'SIM-30002', allergies: ['NKDA'],
                    pmh: 'Term, uncomplicated birth. Up to date on vaccinations.',
                    homeMedications: [],
                    socialHx: 'Lives with mother + father. No daycare. No siblings.'
                },
                encounter: {
                    unit: 'ED', bed: 'WAITING',
                    admissionSource: 'ED-walkin',
                    admissionDate: minutesAgoTS(20),
                    md: 'Dr. Maya Lin, MD-SIM',
                    dx: 'Pediatric fever — eval',
                    chiefComplaint: '6 mo F with fever 38.9, decreased PO intake x 24h, fewer wet diapers. Parents concerned.',
                    esiAcuity: 3, arrivalMode: 'POV',
                    codeStatus: 'Full Code',
                    diet: 'Per parent (breast/bottle)', activity: 'Held by parent',
                    isolation: null, fallRisk: false, dnr: false, acuity: 3
                },
                notes: [
                    { authorRole: 'RN', by: 'Triage RN (seeded)', offsetMin: -20,
                      body: 'Triage: 6 mo F, mother holding. T 38.9 axillary, HR 152, RR 36, SpO2 98 RA. Alert, fussy but consolable. Anterior fontanelle soft + flat. Cap refill 2 sec. Mucous membranes moist. Mother reports last wet diaper 5 hours ago. Parents anxious — needs eval ASAP. NOTE: peds case, may need transfer to peds-equipped facility per protocol.' }
                ]
            },
            // RETURNING patient — Gordon Blake (already in unadmitted, prior was LBP too)
            {
                isNew: false,
                patientId: 'p_gordon_blake',
                encounter: {
                    unit: 'ED', bed: 'WAITING',
                    admissionSource: 'ED-walkin',
                    admissionDate: minutesAgoTS(70),
                    md: 'Dr. Maya Lin, MD-SIM',
                    dx: 'Recurrent low back pain — eval',
                    chiefComplaint: 'Same low back pain as last week, "even worse, can\'t get comfortable, ibuprofen not helping."',
                    esiAcuity: 4, arrivalMode: 'walk-in',
                    codeStatus: 'Full Code',
                    diet: 'Regular', activity: 'As tolerated',
                    isolation: null, fallRisk: false, dnr: false, acuity: 1
                },
                notes: [
                    { authorRole: 'RN', by: 'Triage RN (seeded)', offsetMin: -70,
                      body: 'Triage: Pt amb to triage, slow gait, holding lower back. Pain 6/10. Same complaint as 1 week ago — see Encounters tab. No new neuro symptoms (no incontinence, no saddle anesthesia, no LE weakness). Stable for waiting room. Reminded pt of expected wait.' }
                ]
            }
        ];

        return {
            label: 'Quiet Day',
            description: 'Standard hospital state: 18 admitted patients across all units, 4 in ED waiting room (mix of new + returning). Default for routine teaching.',
            patients: patients,
            unadmitted: unadmitted,
            waitingRoom: waitingRoom,
            chartByPatient: seed.CHART_BY_PATIENT || {},
            unadmittedPriorChart: seed.UNADMITTED_PRIOR_CHART || {},
            ldasByPid: seed.SEED_LDAS || {}
        };
    }

    // =========================================================
    // SCENARIO 2: Empty Hospital
    // =========================================================
    function emptyHospital(seed) {
        return {
            label: 'Empty Hospital',
            description: 'All beds empty. No patients. No encounters. From-scratch practice for ED arrivals + direct admits.',
            patients: [],
            unadmitted: seed.SEED_UNADMITTED_PATIENTS.slice(), // keep them for search/practice
            waitingRoom: [],
            chartByPatient: {},
            unadmittedPriorChart: seed.UNADMITTED_PRIOR_CHART || {},
            ldasByPid: {}
        };
    }

    // =========================================================
    // SCENARIO 3: ED Surge — ED slammed + floors full + boarders
    // (Realistic: when ED is overwhelmed, floors are usually also
    //  full because admits can't move out of the ED.)
    // =========================================================
    function edSurge(seed) {
        const unadmitted = seed.SEED_UNADMITTED_PATIENTS.slice();

        // 6 patients in ED beds + 6 in waiting room
        const surgePatients = [
            // ===== In beds =====
            {
                inBed: 'ED-01',
                patient: {
                    id: 'p_surge_marcus_alvarez',
                    name: 'Marcus Alvarez', sex: 'M', age: 56, dob: '1969-04-12',
                    mrn: 'SIM-31001', allergies: ['NKDA'],
                    pmh: 'HTN, hyperlipidemia, DM2.',
                    homeMedications: [
                        { med: 'Atorvastatin', dose: '40 mg', route: 'PO', freq: 'Daily' },
                        { med: 'Metformin', dose: '1000 mg', route: 'PO', freq: 'BID' },
                        { med: 'Lisinopril', dose: '20 mg', route: 'PO', freq: 'Daily' }
                    ],
                    socialHx: 'Truck driver. Smoker (30 pack-yr). Daily ETOH.'
                },
                encounterOverrides: {
                    admissionSource: 'ED-EMS', md: 'Dr. Avery Chen, MD-SIM',
                    dx: 'STEMI — anterior wall, en route to cath lab',
                    chiefComplaint: 'Crushing chest pain x 30 min, diaphoretic, radiating to L jaw. EMS 12-lead: STE V1-V4.',
                    esiAcuity: 1, arrivalMode: 'EMS',
                    diet: 'NPO', activity: 'Bed rest', acuity: 5
                }
            },
            {
                inBed: 'ED-02',
                patient: {
                    id: 'p_surge_aisha_johnson',
                    name: 'Aisha Johnson', sex: 'F', age: 27, dob: '1998-03-18',
                    mrn: 'SIM-31002', allergies: ['Penicillin'],
                    pmh: 'Asthma. Currently 28 weeks pregnant.',
                    homeMedications: [
                        { med: 'Prenatal vitamin', dose: '1 tab', route: 'PO', freq: 'Daily' },
                        { med: 'Albuterol HFA', dose: '2 puffs', route: 'INH', freq: 'PRN SOB' }
                    ],
                    socialHx: 'Graduate student. Non-smoker.'
                },
                encounterOverrides: {
                    admissionSource: 'ED-walkin', md: 'Dr. Sora Patel, MD-SIM',
                    dx: 'MVA — restrained driver, abdominal pain, fetal monitoring',
                    chiefComplaint: 'Restrained driver MVA at 35 mph. Airbag deployed. C/o abdominal + chest wall pain. 28 wk pregnancy — fetal monitoring initiated.',
                    esiAcuity: 2, arrivalMode: 'EMS',
                    diet: 'NPO', activity: 'Bed rest, L lateral tilt', acuity: 4
                }
            },
            {
                inBed: 'ED-03',
                patient: {
                    id: 'p_surge_robert_kim',
                    name: 'Robert Kim', sex: 'M', age: 62, dob: '1963-08-08',
                    mrn: 'SIM-31003', allergies: ['Sulfa'],
                    pmh: 'CKD stage 3, BPH, recurrent UTIs.',
                    homeMedications: [
                        { med: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'Daily at bedtime' }
                    ],
                    socialHx: 'Accountant. Non-smoker.'
                },
                encounterOverrides: {
                    admissionSource: 'ED-EMS', md: 'Dr. Avery Chen, MD-SIM',
                    dx: 'Septic shock — urinary source',
                    chiefComplaint: 'Fever 39.4, confusion, BP 78/42 on arrival. Lactate 4.8.',
                    esiAcuity: 1, arrivalMode: 'EMS',
                    diet: 'NPO', activity: 'Bed rest', acuity: 5,
                    ivAccess: '18g R AC, 18g L AC, considering CVL'
                }
            },
            {
                inBed: 'ED-04',
                patient: {
                    id: 'p_surge_kevin_kid',
                    name: 'Kevin O\'Brien', sex: 'M', age: 8, dob: '2017-12-04',
                    mrn: 'SIM-31004', allergies: ['NKDA'],
                    pmh: 'Recurrent ear infections. Up to date on vaccinations.',
                    homeMedications: [],
                    socialHx: '3rd grade. Lives with parents + sibling.'
                },
                encounterOverrides: {
                    admissionSource: 'ED-walkin', md: 'Dr. Maya Lin, MD-SIM',
                    dx: 'Pediatric fever 40.1, possible sepsis',
                    chiefComplaint: 'Fever 40.1 x 24h, lethargy, decreased PO. Mother concerned.',
                    esiAcuity: 2, arrivalMode: 'POV',
                    diet: 'Clear liquids', activity: 'Bed rest', acuity: 4
                }
            },
            {
                inBed: 'ED-05',
                patient: {
                    id: 'p_surge_dorothy_morgan',
                    name: 'Dorothy Morgan', sex: 'F', age: 84, dob: '1941-11-19',
                    mrn: 'SIM-31005', allergies: ['Codeine'],
                    pmh: 'Dementia, HTN, CKD, hx falls. Lives in assisted living.',
                    homeMedications: [
                        { med: 'Donepezil', dose: '10 mg', route: 'PO', freq: 'Daily' },
                        { med: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily' }
                    ],
                    socialHx: 'Lives in assisted living. Daughter is POA.'
                },
                encounterOverrides: {
                    admissionSource: 'transfer-from-facility', md: 'Dr. Maya Lin, MD-SIM',
                    dx: 'AMS — eval. UTI vs delirium vs CVA',
                    chiefComplaint: 'Sent from facility for acute change in mental status x 12h. Increased confusion, refusing food, inappropriate speech. Baseline: oriented to self only.',
                    esiAcuity: 2, arrivalMode: 'EMS',
                    diet: 'NPO until eval', activity: 'Bed rest', acuity: 3,
                    fallRisk: true
                }
            },
            {
                inBed: 'ED-06',
                patient: {
                    id: 'p_surge_bradley_torres',
                    name: 'Bradley Torres', sex: 'M', age: 22, dob: '2003-07-30',
                    mrn: 'SIM-31006', allergies: ['NKDA'],
                    pmh: 'Anxiety disorder. Hx ETOH abuse.',
                    homeMedications: [
                        { med: 'Sertraline', dose: '100 mg', route: 'PO', freq: 'Daily' }
                    ],
                    socialHx: 'College student. Heavy weekend ETOH. Reports occasional cannabis.'
                },
                encounterOverrides: {
                    admissionSource: 'ED-EMS', md: 'Dr. Sora Patel, MD-SIM',
                    dx: 'Polysubstance overdose — eval',
                    chiefComplaint: 'Found unresponsive at party. Narcan administered en route with partial response. Pinpoint pupils initially, now sluggish. ETOH suspected.',
                    esiAcuity: 1, arrivalMode: 'EMS',
                    diet: 'NPO', activity: 'Bed rest, suicide precautions pending eval', acuity: 4
                }
            }
        ];

        // 6 patients in waiting room
        const waitingRoom = [
            { isNew: true, patient: { id: 'p_surge_wr_jenny', name: 'Jenny Park', sex: 'F', age: 33, dob: '1992-05-14', mrn: 'SIM-31010', allergies: ['NKDA'], pmh: 'Migraines.', homeMedications: [], socialHx: 'Office worker.' },
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(30), md: 'Dr. Avery Chen, MD-SIM', dx: 'Headache + photophobia', chiefComplaint: 'Worst headache of life x 4 hours, photophobia, neck stiffness', esiAcuity: 2, arrivalMode: 'walk-in', codeStatus: 'Full Code', diet: 'NPO until eval', activity: 'As tolerated', acuity: 3, fallRisk: false, dnr: false }
            },
            { isNew: true, patient: { id: 'p_surge_wr_carlos', name: 'Carlos Mendoza', sex: 'M', age: 47, dob: '1978-02-03', mrn: 'SIM-31011', allergies: ['NKDA'], pmh: 'Smoker.', homeMedications: [], socialHx: 'Construction.' },
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(50), md: 'Dr. Sora Patel, MD-SIM', dx: 'SOB + cough', chiefComplaint: 'SOB + productive cough x 1 week, fever last 2 days', esiAcuity: 3, arrivalMode: 'walk-in', codeStatus: 'Full Code', diet: 'Regular', activity: 'As tolerated', acuity: 3, fallRisk: false, dnr: false }
            },
            { isNew: true, patient: { id: 'p_surge_wr_grace', name: 'Grace Chen', sex: 'F', age: 71, dob: '1954-09-08', mrn: 'SIM-31012', allergies: ['Aspirin'], pmh: 'AFib on apixaban, HTN.', homeMedications: [{med:'Apixaban',dose:'5 mg',route:'PO',freq:'BID'}], socialHx: 'Retired.' },
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(40), md: 'Dr. Avery Chen, MD-SIM', dx: 'Fall, head laceration', chiefComplaint: 'Fall at home, hit head on table corner. 2 cm forehead lac, no LOC reported. On apixaban — needs CT head per protocol.', esiAcuity: 2, arrivalMode: 'POV', codeStatus: 'Full Code', diet: 'Regular', activity: 'Bed rest', acuity: 3, fallRisk: true, dnr: false }
            },
            { isNew: true, patient: { id: 'p_surge_wr_michael', name: 'Michael Brooks', sex: 'M', age: 19, dob: '2006-11-22', mrn: 'SIM-31013', allergies: ['NKDA'], pmh: 'None.', homeMedications: [], socialHx: 'College student.' },
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(25), md: 'Dr. Maya Lin, MD-SIM', dx: 'Ankle injury, possible fracture', chiefComplaint: 'Twisted R ankle playing basketball, swollen, can\'t bear weight', esiAcuity: 4, arrivalMode: 'walk-in', codeStatus: 'Full Code', diet: 'Regular', activity: 'NWB R LE', acuity: 1, fallRisk: false, dnr: false }
            },
            { isNew: false, patientId: 'p_emily_foster',
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(15), md: 'Dr. Avery Chen, MD-SIM', dx: 'Recurrent ETOH intoxication', chiefComplaint: 'Brought in by friend after binge drinking at party. Sleepy but rouseable. "Same as last time."', esiAcuity: 3, arrivalMode: 'walk-in', codeStatus: 'Full Code', diet: 'NPO', activity: 'Bed rest', acuity: 2, fallRisk: true, dnr: false }
            },
            { isNew: true, patient: { id: 'p_surge_wr_helen_ng', name: 'Helen Ng', sex: 'F', age: 58, dob: '1967-06-17', mrn: 'SIM-31014', allergies: ['NKDA'], pmh: 'Type 2 DM, hyperlipidemia.', homeMedications: [{med:'Metformin',dose:'500 mg',route:'PO',freq:'BID'}], socialHx: 'Restaurant manager.' },
              encounter: { unit: 'ED', bed: 'WAITING', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(60), md: 'Dr. Sora Patel, MD-SIM', dx: 'N/V/D x 3 days', chiefComplaint: 'Persistent N/V/D for 3 days, lightheaded, can\'t keep PO down', esiAcuity: 3, arrivalMode: 'walk-in', codeStatus: 'Full Code', diet: 'Clear liquids', activity: 'As tolerated', acuity: 3, fallRisk: false, dnr: false }
            }
        ];

        const surgeNotes = {
            p_surge_marcus_alvarez: [{ authorRole: 'MD', by: 'Dr. Avery Chen, MD-SIM', offsetMin: -30, body: 'STEMI confirmed on EMS 12-lead. Cath lab activated, ETA 5 min. ASA, plavix, heparin given. Anticipate PCI within 90 min door-to-balloon goal.' }],
            p_surge_robert_kim: [{ authorRole: 'MD', by: 'Dr. Avery Chen, MD-SIM', offsetMin: -45, body: 'Septic shock per Sepsis-3 criteria. UA grossly cloudy. Started broad-spectrum abx (vanc + cefepime — sulfa allergy noted, avoiding bactrim). Norepi started for MAP >65. ICU consult placed.' }],
            p_surge_dorothy_morgan: [{ authorRole: 'RN', by: 'Triage RN (seeded)', offsetMin: -30, body: 'Pt confused, intermittently calling out for "George" (deceased husband per facility report). Bed alarm activated, fall risk precautions in place. Daughter notified, ETA 45 min.' }],
            p_surge_bradley_torres: [{ authorRole: 'MD', by: 'Dr. Sora Patel, MD-SIM', offsetMin: -20, body: 'Polysubstance OD. Naloxone partial response. Now intermittently rouseable. Tox panel pending. Considering psych eval pending stabilization.' }]
        };

        const surgeMar = {
            p_surge_marcus_alvarez: [
                { medication: 'Aspirin', dose: '325 mg', route: 'PO', frequency: 'Once', scheduledTime: 'Pre-cath', isPRN: false, status: 'given', administeredAt: minutesAgoTS(28), administeredBy: 'EMS (seeded)' },
                { medication: 'Heparin bolus', dose: '60 units/kg', route: 'IV', frequency: 'Once pre-cath', scheduledTime: 'Pre-cath', isPRN: false, status: 'given', administeredAt: minutesAgoTS(20), administeredBy: 'ED RN (seeded)' }
            ],
            p_surge_robert_kim: [
                { medication: 'Vancomycin', dose: '1750 mg', route: 'IV', frequency: 'Q12H', scheduledTime: '0800,2000', isPRN: false },
                { medication: 'Cefepime', dose: '2 g', route: 'IV', frequency: 'Q8H', scheduledTime: '0800,1600,2400', isPRN: false },
                { medication: 'Norepinephrine drip', dose: 'Titrate for MAP >65', route: 'IV', frequency: 'Continuous', scheduledTime: 'Continuous', isPRN: false },
                { medication: 'Lactated Ringer\'s bolus', dose: '30 mL/kg over 1h', route: 'IV', frequency: 'Once', scheduledTime: 'Now', isPRN: false }
            ],
            p_surge_kevin_kid: [
                { medication: 'Acetaminophen', dose: '160 mg (15 mg/kg)', route: 'PO', frequency: 'Q4H PRN fever', scheduledTime: 'PRN', isPRN: true, prnIndication: 'Temp >38.5°C' }
            ]
        };

        const surgeTar = {
            p_surge_marcus_alvarez: [{ treatment: 'Continuous cardiac monitoring + 12-lead Q15min until cath', frequency: 'Continuous', scheduledTime: 'Continuous' }],
            p_surge_robert_kim: [
                { treatment: 'Hourly vitals + urine output', frequency: 'Q1H', scheduledTime: 'Q1H' },
                { treatment: 'Repeat lactate Q6H', frequency: 'Q6H', scheduledTime: '0600,1200,1800,2400' }
            ],
            p_surge_aisha_johnson: [{ treatment: 'Continuous fetal monitoring', frequency: 'Continuous', scheduledTime: 'Continuous' }]
        };

        // Convert to scenario shape — patients are inline with their encounters
        const acutePatients = surgePatients.map(function (sp) {
            return Object.assign({}, sp.patient, {
                currentEncounter: Object.assign({
                    unit: 'ED', bed: sp.inBed,
                    admissionDate: minutesAgoTS(60 + Math.random() * 60),
                    codeStatus: 'Full Code', isolation: null, fallRisk: false, dnr: false
                }, sp.encounterOverrides)
            });
        });

        // ===== HALL BED BOARDERS — 4 admitted patients with PENDING TRANSFERS to upstairs =====
        // Each has pendingTransfer set so the receiving unit's Incoming Transfers section shows them
        // and students can practice the accept-with-bed-assignment workflow.
        const hallBoarders = [
            {
                id: 'p_surge_boarder_chen', name: 'Margaret Chen', sex: 'F', age: 68, dob: '1957-02-14',
                mrn: 'SIM-31020', allergies: ['NKDA'], pmh: 'CHF (EF 35%), HTN, T2DM.',
                homeMedications: [{med:'Carvedilol',dose:'12.5 mg',route:'PO',freq:'BID'},{med:'Furosemide',dose:'40 mg',route:'PO',freq:'Daily'}],
                socialHx: 'Retired teacher.',
                currentEncounter: { unit: 'ED', bed: 'ED-H1', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(280),
                    md: 'Dr. Reuben Park, MD-SIM', dx: 'CHF exacerbation',
                    chiefComplaint: 'SOB, orthopnea, LE edema', esiAcuity: 3, arrivalMode: 'walk-in',
                    codeStatus: 'Full Code', diet: '2g sodium', activity: 'Bed rest',
                    ivAccess: '20g L AC', acuity: 3, isolation: null, fallRisk: true, dnr: false,
                    pendingTransfer: {
                        toUnit: 'MS', reason: 'Admit to Med-Surg for diuresis and CHF management',
                        requestedBy: 'Dr. Reuben Park, MD-SIM', requestedAt: minutesAgoTS(160),
                        reportGivenTo: 'MS Charge RN'
                    }
                }
            },
            {
                id: 'p_surge_boarder_jackson', name: 'Robert Jackson', sex: 'M', age: 52, dob: '1973-09-08',
                mrn: 'SIM-31021', allergies: ['Sulfa'], pmh: 'Type 2 DM, hyperlipidemia.',
                homeMedications: [{med:'Metformin',dose:'1000 mg',route:'PO',freq:'BID'}],
                socialHx: 'Truck driver.',
                currentEncounter: { unit: 'ED', bed: 'ED-H2', admissionSource: 'ED-walkin', admissionDate: minutesAgoTS(220),
                    md: 'Dr. Reuben Park, MD-SIM', dx: 'DKA resolving',
                    chiefComplaint: 'N/V, polyuria, polydipsia', esiAcuity: 2, arrivalMode: 'walk-in',
                    codeStatus: 'Full Code', diet: 'Carb-controlled diabetic', activity: 'As tolerated',
                    ivAccess: '18g L AC', acuity: 3, isolation: null, fallRisk: false, dnr: false,
                    pendingTransfer: {
                        toUnit: 'MS', reason: 'Admit to Med-Surg for ongoing insulin protocol and observation',
                        requestedBy: 'Dr. Reuben Park, MD-SIM', requestedAt: minutesAgoTS(110),
                        reportGivenTo: 'MS Charge RN'
                    }
                }
            },
            {
                id: 'p_surge_boarder_williams', name: 'Carol Williams', sex: 'F', age: 75, dob: '1950-05-22',
                mrn: 'SIM-31022', allergies: ['Penicillin'], pmh: 'COPD on home O2 2L, HTN.',
                homeMedications: [{med:'Tiotropium',dose:'1 cap',route:'INH',freq:'Daily'}],
                socialHx: 'Retired. Former smoker (40 pack-yr, quit 2015).',
                currentEncounter: { unit: 'ED', bed: 'ED-H3', admissionSource: 'ED-EMS', admissionDate: minutesAgoTS(340),
                    md: 'Dr. Lin Okafor, MD-SIM', dx: 'COPD exacerbation, hypoxic',
                    chiefComplaint: 'Severe SOB, increased sputum production', esiAcuity: 2, arrivalMode: 'EMS',
                    codeStatus: 'DNR/DNI', diet: 'Regular', activity: 'Bed rest, HOB 30°',
                    ivAccess: '20g R AC', acuity: 4, isolation: null, fallRisk: true, dnr: true,
                    pendingTransfer: {
                        toUnit: 'ICU', reason: 'Admit to ICU for BiPAP standby, ABG q4h, hypercapnic resp failure risk',
                        requestedBy: 'Dr. Lin Okafor, MD-SIM', requestedAt: minutesAgoTS(220),
                        reportGivenTo: 'ICU Charge RN'
                    }
                }
            },
            {
                id: 'p_surge_boarder_patel', name: 'Vikram Patel', sex: 'M', age: 60, dob: '1965-12-03',
                mrn: 'SIM-31023', allergies: ['NKDA'], pmh: 'HTN, hyperlipidemia, prior NSTEMI 2022.',
                homeMedications: [{med:'Atorvastatin',dose:'40 mg',route:'PO',freq:'Daily'},{med:'Aspirin',dose:'81 mg',route:'PO',freq:'Daily'}],
                socialHx: 'Software engineer.',
                currentEncounter: { unit: 'ED', bed: 'ED-H4', admissionSource: 'ED-EMS', admissionDate: minutesAgoTS(180),
                    md: 'Dr. Lin Okafor, MD-SIM', dx: 'Unstable angina',
                    chiefComplaint: 'Recurrent chest pain at rest, troponin neg x 2', esiAcuity: 2, arrivalMode: 'EMS',
                    codeStatus: 'Full Code', diet: 'Cardiac', activity: 'Bed rest',
                    ivAccess: '20g L AC', acuity: 3, isolation: null, fallRisk: false, dnr: false,
                    pendingTransfer: {
                        toUnit: 'PCU', reason: 'Admit to PCU/step-down for telemetry and serial troponins',
                        requestedBy: 'Dr. Lin Okafor, MD-SIM', requestedAt: minutesAgoTS(85),
                        reportGivenTo: 'PCU Charge RN'
                    }
                }
            }
        ];

        // ===== FULL FLOOR CENSUS — reuse Quiet Day floor patients to make hospital feel realistically full =====
        const floorPatients = seed.SEED_PATIENTS.filter(function (p) {
            const u = p.currentEncounter && p.currentEncounter.unit;
            return u !== 'ED'; // everyone except current ED patients (since we have our own ED slate)
        });

        const allPatients = acutePatients.concat(hallBoarders).concat(floorPatients);

        // Status note overrides for in-bed acute patients (boarders use pendingTransfer instead)
        const statusNotes = {
            p_surge_marcus_alvarez: 'STEMI — cath lab activated, ETA <5 min. ASA + heparin given.',
            p_surge_robert_kim: 'Septic shock — pressors, awaiting ICU bed. Lactate 4.8.',
            p_surge_dorothy_morgan: 'AMS — daughter (POA) ETA 45 min. CT ordered.',
            p_surge_bradley_torres: 'Polysubstance OD — partial Narcan response, suicide precautions pending eval.',
            p_surge_aisha_johnson: '28 wk pregnancy + MVA — fetal monitoring active, OB notified.',
            p_surge_kevin_kid: 'Peds fever 40.1 — peds eval, possible transfer to peds-equipped facility.'
        };

        return {
            label: 'ED Surge',
            description: 'Realistic ED surge: 6 acute patients in ED beds (STEMI, septic shock, AMS, peds fever, OD, MVA pregnant), 4 boarders in ED hall beds awaiting upstairs admit, 6 in waiting room. Floors at full census — nothing can move. Forces triage, throughput, and bed-management thinking.',
            patients: allPatients,
            unadmitted: unadmitted,
            waitingRoom: waitingRoom,
            chartByPatient: seed.CHART_BY_PATIENT || {}, // floor patients keep their existing chart data
            unadmittedPriorChart: seed.UNADMITTED_PRIOR_CHART || {},
            ldasByPid: Object.assign({}, seed.SEED_LDAS || {}, {
                p_surge_marcus_alvarez: [
                    { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.02, insertedBy: 'EMS (seeded)' },
                    { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.02, insertedBy: 'ED RN (seeded)' }
                ],
                p_surge_robert_kim: [
                    { type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.04, insertedBy: 'ED RN (seeded)' },
                    { type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.04, insertedBy: 'ED RN (seeded)' },
                    { type: 'Foley', site: 'Urethral', size: '14 Fr', daysAgo: 0.03, insertedBy: 'ED RN (seeded)', notes: 'For strict I&O — sepsis protocol' }
                ],
                p_surge_dorothy_morgan: [{ type: 'PIV', site: 'L hand', size: '20g', daysAgo: 0.02, insertedBy: 'ED RN (seeded)' }],
                p_surge_bradley_torres: [{ type: 'PIV', site: 'R AC', size: '18g', daysAgo: 0.02, insertedBy: 'EMS (seeded)' }],
                p_surge_boarder_chen: [{ type: 'PIV', site: 'L AC', size: '20g', daysAgo: 0.2, insertedBy: 'ED RN (seeded)' }],
                p_surge_boarder_jackson: [{ type: 'PIV', site: 'L AC', size: '18g', daysAgo: 0.15, insertedBy: 'ED RN (seeded)' }],
                p_surge_boarder_williams: [{ type: 'PIV', site: 'R AC', size: '20g', daysAgo: 0.24, insertedBy: 'ED RN (seeded)' }],
                p_surge_boarder_patel: [{ type: 'PIV', site: 'L AC', size: '20g', daysAgo: 0.13, insertedBy: 'ED RN (seeded)' }]
            }),
            notesByPid: surgeNotes,
            marByPid: surgeMar,
            tarByPid: surgeTar,
            statusNotes: statusNotes
        };
    }

    // =========================================================
    // SCENARIO 4: Night Shift Cascade
    // =========================================================
    function nightShiftCascade(seed) {
        // Use existing admitted patients but add escalating issues
        // Quick implementation: reuse Quiet Day patients but add specific status notes + held meds + critical labs would be needed in 3C
        const base = quietDay(seed);

        // Mark several patients as having developing issues
        // We do this via statusNote on their encounters (set during the scenario load)
        return {
            label: 'Night Shift Cascade',
            description: 'Same patient roster as Quiet Day, but multiple patients developing issues mid-shift: STEMI on cath, septic shock on pressors, post-op bleeding, agitated patient with elopement risk. Tests rapid response + handoff coordination.',
            patients: base.patients,
            unadmitted: base.unadmitted,
            waitingRoom: base.waitingRoom,
            chartByPatient: base.chartByPatient,
            unadmittedPriorChart: base.unadmittedPriorChart,
            ldasByPid: base.ldasByPid,
            // Patient-specific statusNote overrides applied during load
            statusNotes: {
                p_marcus_webb: 'Troponin POSITIVE — STEMI confirmed, cath lab activated, transferring to ICU after PCI',
                p_priya_kapoor: 'Lactate 5.2 (rising), MAP 58 — escalate norepi, anesthesia at bedside for CVL',
                p_helen_cho: 'Surgical wound POD#2 — bleeding through dressing, OR notified, blood typed and crossed',
                p_dorothy_nguyen: 'BiPAP failing — pH dropping, family meeting goals of care given DNR/DNI',
                p_walter_huang: 'Confused, attempting to pull tubes — sitter requested, restraints discussed with daughter (POA)'
            }
        };
    }

    // =========================================================
    // SCENARIO 5: Med-Surg Steady
    // =========================================================
    function medSurgSteady(seed) {
        // Use existing patients but only Med-Surg + PCU; clear ICU + OB + most ED
        const all = seed.SEED_PATIENTS.slice();
        const filtered = all.filter(function (p) {
            const u = p.currentEncounter && p.currentEncounter.unit;
            return u === 'MS' || u === 'PCU';
        });

        // Add a few extra Med-Surg patients to make it 8 MS + 3 PCU
        // Instead of inventing new ones, just keep the 4 existing MS + 2 PCU patients
        // and add 4 extras
        const extras = [
            {
                id: 'p_ms_patricia_chen', name: 'Patricia Chen', sex: 'F', age: 67, dob: '1958-04-04', mrn: 'SIM-32001',
                allergies: ['NKDA'], pmh: 'COPD, HTN.',
                homeMedications: [{med:'Tiotropium',dose:'1 cap',route:'INH',freq:'Daily'}],
                socialHx: 'Retired teacher. Former smoker.',
                currentEncounter: { unit: 'MS', bed: 'MS-01', admissionSource: 'ED-walkin', admissionDate: daysAgoTS(2, 14),
                    md: 'Dr. Reuben Park, MD-SIM', dx: 'CAP — improving, awaiting PO conversion',
                    codeStatus: 'Full Code', diet: 'Regular', activity: 'OOB ad lib', ivAccess: 'SL R hand', acuity: 2,
                    isolation: null, fallRisk: false, dnr: false }
            },
            {
                id: 'p_ms_eduardo_silva', name: 'Eduardo Silva', sex: 'M', age: 54, dob: '1971-01-17', mrn: 'SIM-32002',
                allergies: ['NKDA'], pmh: 'GERD, hx cholecystitis.',
                homeMedications: [{med:'Omeprazole',dose:'20 mg',route:'PO',freq:'Daily'}],
                socialHx: 'Office worker.',
                currentEncounter: { unit: 'MS', bed: 'MS-03', admissionSource: 'post-op', admissionDate: daysAgoTS(1, 8),
                    md: 'Dr. Reuben Park, MD-SIM', dx: 'Post-op lap chole, POD#1',
                    codeStatus: 'Full Code', diet: 'Clear liquids advancing', activity: 'OOB with assist',
                    ivAccess: 'SL L hand', acuity: 2, isolation: null, fallRisk: false, dnr: false }
            },
            {
                id: 'p_ms_linda_ramirez', name: 'Linda Ramirez', sex: 'F', age: 73, dob: '1952-11-29', mrn: 'SIM-32003',
                allergies: ['Penicillin'], pmh: 'CHF (EF 40%), AFib, T2DM.',
                homeMedications: [
                    {med:'Metoprolol Succinate',dose:'50 mg',route:'PO',freq:'Daily'},
                    {med:'Furosemide',dose:'20 mg',route:'PO',freq:'Daily'},
                    {med:'Apixaban',dose:'5 mg',route:'PO',freq:'BID'}
                ],
                socialHx: 'Retired. Lives alone with cat.',
                currentEncounter: { unit: 'MS', bed: 'MS-07', admissionSource: 'ED-walkin', admissionDate: daysAgoTS(1, 16),
                    md: 'Dr. Reuben Park, MD-SIM', dx: 'CHF exacerbation — clinical decline',
                    codeStatus: 'DNR/DNI', diet: '2g sodium, 1500 mL fluid', activity: 'OOB with assist',
                    ivAccess: '20g L AC', acuity: 4, isolation: null, fallRisk: true, dnr: true,
                    statusNote: 'Worsening hypoxia despite IV diuresis; cardiology recommending ICU transfer for closer monitoring',
                    pendingTransfer: {
                        toUnit: 'ICU',
                        reason: 'Worsening hypoxia, escalating O2 requirement, may need BiPAP. ICU transfer per cardiology.',
                        requestedBy: 'Dr. Reuben Park, MD-SIM',
                        requestedAt: minutesAgoTS(35),
                        reportGivenTo: 'ICU Charge RN'
                    }
                }
            },
            {
                id: 'p_pcu_michael_obrien', name: 'Michael O\'Brien', sex: 'M', age: 65, dob: '1960-08-22', mrn: 'SIM-32004',
                allergies: ['NKDA'], pmh: 'CAD s/p CABG 2020, HTN.',
                homeMedications: [
                    {med:'Aspirin',dose:'81 mg',route:'PO',freq:'Daily'},
                    {med:'Metoprolol Tartrate',dose:'25 mg',route:'PO',freq:'BID'}
                ],
                socialHx: 'Retired firefighter.',
                currentEncounter: { unit: 'PCU', bed: 'PCU-04', admissionSource: 'post-op', admissionDate: daysAgoTS(1, 12),
                    md: 'Dr. Lin Okafor, MD-SIM', dx: 'Post-PCI for unstable angina — telemetry',
                    codeStatus: 'Full Code', diet: 'Cardiac', activity: 'OOB with assist',
                    ivAccess: 'SL R hand', acuity: 3, isolation: null, fallRisk: false, dnr: false }
            }
        ];

        return {
            label: 'Med-Surg Steady',
            description: '8 patients on Med-Surg + 3 on PCU + nobody in ED/ICU/OB. Mix of post-ops, exacerbations, recovering admits. Discharges and admits flowing. Practice routine workflows: handoffs, transfers, discharges, med passes, q-shift assessments.',
            patients: filtered.concat(extras),
            unadmitted: seed.SEED_UNADMITTED_PATIENTS.slice(),
            waitingRoom: [],
            chartByPatient: seed.CHART_BY_PATIENT || {},
            unadmittedPriorChart: seed.UNADMITTED_PRIOR_CHART || {},
            ldasByPid: (function () {
                const out = {};
                filtered.forEach(function (p) { if (seed.SEED_LDAS && seed.SEED_LDAS[p.id]) out[p.id] = seed.SEED_LDAS[p.id]; });
                return out;
            })()
        };
    }

    // =========================================================
    // EXPORT
    // =========================================================
    window.EMR_SCENARIOS = {
        quietDay: { id: 'quietDay', icon: '☀️', build: quietDay },
        edSurge: { id: 'edSurge', icon: '🚨', build: edSurge },
        nightShift: { id: 'nightShift', icon: '🌙', build: nightShiftCascade },
        medSurgSteady: { id: 'medSurgSteady', icon: '🛏️', build: medSurgSteady },
        emptyHospital: { id: 'emptyHospital', icon: '🏥', build: emptyHospital }
    };
})();
