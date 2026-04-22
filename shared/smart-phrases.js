/* BendBSN — Shared smart-phrase catalog + seeder
   ------------------------------------------------------------------
   Single source of truth for the 69 built-in nursing documentation
   shortcuts (.vs, .neuro, .resp, .cv, …). Loaded by:
     • /app/        — picker popover on every rich-textarea toolbar
     • /profile/    — "My Smart Phrases" management panel

   Both pages call seedDefaultSmartPhrases() on init. The first call
   for a given browser/profile copies the 69 defaults into
   localStorage as editable entries. A sticky flag prevents
   re-seeding so any deletions stay deleted.

   To add a new built-in:
     1. Append to DEFAULT_SMART_PHRASES below.
     2. Append the shortcut key to the matching SEED_PHRASE_CATEGORIES
        entry (or add a new category) so the picker groups it.
     3. Bump the seed flag below if you want EXISTING users to pick
        it up (otherwise they'll only get the addition via the
        Restore Defaults button).
*/
(function () {
    'use strict';
    if (window.DEFAULT_SMART_PHRASES) return;

    const DEFAULT_SMART_PHRASES = {
        // Vital Signs
        '.vs': 'BP: __ | HR: __ | O2: __% | RR: __ | T: __ | Pain: __/10',
        // Neuro
        '.neuro': 'A&Ox4. PERRLA. GCS 15. MAE x4. ',
        '.aox4': 'Alert and oriented x4 (person, place, time, situation). ',
        '.aox3': 'Alert and oriented x3 (person, place, time). ',
        '.perrla': 'PERRLA (Pupils Equal, Round, Reactive to Light and Accommodation). ',
        '.mae': 'MAE x4 (Moving All Extremities). ',
        '.gcs15': 'GCS 15 (E4V5M6). ',
        // Respiratory
        '.resp': 'CTA bilat. No adventitious sounds. Unlabored. O2: __% on __. ',
        '.cta': 'CTA bilat (Clear to Auscultation bilaterally). ',
        '.lungs': 'Lung sounds clear bilaterally, no wheezes, crackles, or rhonchi. ',
        '.sob': 'Patient denies shortness of breath. Respirations unlabored. ',
        // Cardiovascular
        '.cv': 'S1S2 RRR. No murmurs. Pulses 2+ x4. Cap refill <3s. No edema. ',
        '.rrr': 'S1S2 RRR (Regular Rate and Rhythm). No murmurs, rubs, or gallops. ',
        '.pulses': 'Peripheral pulses 2+ bilaterally, cap refill <3 seconds. ',
        '.noedema': 'No peripheral edema noted. ',
        // GI
        '.gi': 'BS active x4 quads. Abdomen soft, NT, ND. Last BM: __. ',
        '.bsax4': 'BS active x4 quadrants. ',
        '.ntnd': 'Non-tender, non-distended. ',
        '.npo': 'Patient NPO. ',
        '.tolerated': 'Diet tolerated without nausea or vomiting. ',
        // GU
        '.gu': 'Voiding without difficulty. Urine clear yellow. ',
        '.fs': 'Foley catheter patent, draining clear yellow urine. Secured to thigh. ',
        '.voidclear': 'Voiding clear yellow urine without difficulty. ',
        // Skin
        '.skin': 'Warm, dry, intact. No breakdown or pressure injuries. ',
        '.wdi': 'Skin warm, dry, intact. ',
        '.turgor': 'Skin turgor elastic, no tenting. ',
        '.ivsite': 'IV site clean, dry, intact. No redness, swelling, or drainage. ',
        // Pain
        '.pain': 'Pain __/10 at __. Quality: __. Duration: __. Interventions: __. ',
        '.pain0': 'Patient denies pain. Pain 0/10. ',
        '.painmed': 'Pain medication administered as ordered. Will reassess in 30-60 min. ',
        // Allergies
        '.nkda': 'NKDA (No Known Drug Allergies). ',
        '.nka': 'NKA (No Known Allergies). ',
        // General Assessment
        '.denies': 'Patient denies pain, nausea, SOB, dizziness, chest pain. ',
        '.wdl': 'Within defined limits. ',
        '.nad': 'No acute distress. ',
        '.wdta': 'Will continue to monitor. Patient tolerated well. No adverse effects noted. ',
        // Interventions
        '.medadmin': 'Medication administered as ordered. Patient tolerated without adverse effects. ',
        '.ivp': 'IV patent, no redness/swelling at site. Flushed with 10mL NS. ',
        '.repos': 'Patient repositioned for comfort and pressure relief. ',
        '.amb': 'Assisted patient with ambulation in hallway. Gait steady, tolerated well. ',
        '.tcdb': 'Encouraged to turn, cough, and deep breathe. ',
        '.is': 'Incentive spirometer use encouraged. Patient demonstrated proper technique. ',
        '.scd': 'SCDs applied and functioning bilaterally. ',
        // Safety
        '.fall': 'Fall precautions in place. Bed in low position. Call light within reach. ',
        '.safe': 'Side rails up x2. Bed alarm on. Call light in reach. Non-skid socks on. ',
        '.idbands': 'ID bands verified x2. Patient confirmed identity. ',
        '.safeenv': 'Safe environment maintained: bed low, locked, call light in reach, side rails x2. ',
        // Communication
        '.mdnotify': 'MD notified of findings. Awaiting orders. ',
        '.neworders': 'New orders received from MD and implemented. ',
        '.handoff': 'Bedside handoff report given to oncoming nurse. ',
        // Education/Discharge
        '.edu': 'Patient educated on __. Patient verbalized understanding. ',
        '.dc': 'Discharge instructions reviewed with patient. Patient verbalized understanding. ',
        '.teachback': 'Patient able to teach back key information. ',
        '.dcteach': 'Discharge teaching completed. Patient/family verbalized understanding of medications, follow-up, and return precautions. '
    };

    // Used by the picker for grouping. Order matches the source-comment
    // sections above; "My Phrases" is added by the picker itself for any
    // shortcuts NOT in this map.
    const SEED_PHRASE_CATEGORIES = [
        { name: 'Vital Signs',           keys: ['.vs'] },
        { name: 'Neuro',                 keys: ['.neuro', '.aox4', '.aox3', '.perrla', '.mae', '.gcs15'] },
        { name: 'Respiratory',           keys: ['.resp', '.cta', '.lungs', '.sob'] },
        { name: 'Cardiovascular',        keys: ['.cv', '.rrr', '.pulses', '.noedema'] },
        { name: 'GI',                    keys: ['.gi', '.bsax4', '.ntnd', '.npo', '.tolerated'] },
        { name: 'GU',                    keys: ['.gu', '.fs', '.voidclear'] },
        { name: 'Skin',                  keys: ['.skin', '.wdi', '.turgor', '.ivsite'] },
        { name: 'Pain',                  keys: ['.pain', '.pain0', '.painmed'] },
        { name: 'Allergies',             keys: ['.nkda', '.nka'] },
        { name: 'General',               keys: ['.denies', '.wdl', '.nad', '.wdta'] },
        { name: 'Interventions',         keys: ['.medadmin', '.ivp', '.repos', '.amb', '.tcdb', '.is', '.scd'] },
        { name: 'Safety',                keys: ['.fall', '.safe', '.idbands', '.safeenv'] },
        { name: 'Communication',         keys: ['.mdnotify', '.neworders', '.handoff'] },
        { name: 'Education / Discharge', keys: ['.edu', '.dc', '.teachback', '.dcteach'] }
    ];

    const STORAGE_KEY = 'bendbsn_custom_phrases';
    const SEED_FLAG   = 'bendbsn_phrases_seeded_v1';

    /**
     * Seed the 69 built-ins into localStorage on first call for this
     * browser/profile. Merges with anything the user already has under
     * the same shortcut (no overwrite). Sticky flag prevents re-seeding
     * so deletions stay permanent. Idempotent — safe to call on every
     * page load.
     */
    function seedDefaultSmartPhrases() {
        try {
            if (localStorage.getItem(SEED_FLAG)) return false;
            let existing = {};
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                try { existing = JSON.parse(raw) || {}; } catch (e) { existing = {}; }
            }
            const merged = Object.assign({}, DEFAULT_SMART_PHRASES, existing);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            localStorage.setItem(SEED_FLAG, '1');
            return true;
        } catch (e) {
            console.warn('[smart-phrases] seed failed', e);
            return false;
        }
    }

    /**
     * Add back any built-ins the user has deleted. Never overwrites
     * a current entry under the same shortcut, so renamed/edited
     * built-ins are preserved. Returns the count restored.
     */
    function restoreDefaultSmartPhrases() {
        let added = 0;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const existing = raw ? (JSON.parse(raw) || {}) : {};
            Object.keys(DEFAULT_SMART_PHRASES).forEach(function (sc) {
                if (existing[sc] == null) {
                    existing[sc] = DEFAULT_SMART_PHRASES[sc];
                    added += 1;
                }
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (e) {
            console.warn('[smart-phrases] restore failed', e);
        }
        return added;
    }

    /** Read all phrases (built-ins seeded + user-added) from localStorage. */
    function getAllSmartPhrases() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? (JSON.parse(raw) || {}) : {};
        } catch (e) {
            return Object.assign({}, DEFAULT_SMART_PHRASES);
        }
    }

    /** Map shortcut → category name (or null if not a built-in). */
    function categoryOf(shortcut) {
        for (let i = 0; i < SEED_PHRASE_CATEGORIES.length; i++) {
            if (SEED_PHRASE_CATEGORIES[i].keys.indexOf(shortcut) !== -1) {
                return SEED_PHRASE_CATEGORIES[i].name;
            }
        }
        return null;
    }

    /** Write a phrase: localStorage immediately (sync UX) + Firebase fire-and-forget. */
    function writeSmartPhrase(shortcut, text, db, uid) {
        const all = getAllSmartPhrases();
        all[shortcut] = text;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) {}
        syncToFirebase(db, uid);
    }

    /** Delete a phrase: localStorage + Firebase. */
    function deleteSmartPhrase(shortcut, db, uid) {
        const all = getAllSmartPhrases();
        delete all[shortcut];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) {}
        syncToFirebase(db, uid);
    }

    // ---- Firebase sync ----
    // Phrases live at userProfiles/{uid}/smartPhrases as a JSON string (not
    // a map) to sidestep Firebase's "no dots in keys" restriction (all our
    // shortcuts start with a dot). Write-the-whole-thing is fine — 69
    // phrases × ~80 chars = ~5KB payload.
    let _syncToFirebaseTimer = null;
    function syncToFirebase(db, uid) {
        if (!db || !uid) return;
        // Debounce 500ms so rapid edits don't hammer the database
        if (_syncToFirebaseTimer) clearTimeout(_syncToFirebaseTimer);
        _syncToFirebaseTimer = setTimeout(function () {
            try {
                const raw = localStorage.getItem(STORAGE_KEY) || '{}';
                db.ref('userProfiles/' + uid + '/smartPhrases').set(raw);
            } catch (e) {
                console.warn('[smart-phrases] syncToFirebase failed', e);
            }
        }, 500);
    }

    /**
     * Pull the user's phrases from their Firebase profile and merge into
     * localStorage. Firebase wins on conflicts (canonical). If the user
     * has no profile record yet, seeds from defaults and pushes to Firebase.
     *
     * Call on every page load after Firebase auth is ready. Safe if
     * db/uid are missing — falls back to local-only mode with a seed.
     */
    function syncFromFirebase(db, uid, cb) {
        // No auth available — run local seed and bail.
        if (!db || !uid) {
            seedDefaultSmartPhrases();
            if (cb) cb(getAllSmartPhrases());
            return;
        }
        try {
            db.ref('userProfiles/' + uid + '/smartPhrases').once('value', function (snap) {
                const val = snap.val();
                if (val && typeof val === 'string') {
                    // Profile has phrases — merge into local cache. Firebase
                    // is the source of truth; local additions (if any) layer
                    // on top so offline edits aren't lost.
                    try {
                        const remote = JSON.parse(val) || {};
                        const local = getAllSmartPhrases();
                        const merged = Object.assign({}, local, remote);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                        localStorage.setItem(SEED_FLAG, '1');  // treat as seeded
                    } catch (e) {
                        console.warn('[smart-phrases] remote parse failed', e);
                    }
                } else {
                    // Profile is empty — seed defaults locally + push to Firebase
                    seedDefaultSmartPhrases();
                    syncToFirebase(db, uid);
                }
                if (cb) cb(getAllSmartPhrases());
            }, function (err) {
                console.warn('[smart-phrases] syncFromFirebase failed', err);
                seedDefaultSmartPhrases();
                if (cb) cb(getAllSmartPhrases());
            });
        } catch (e) {
            console.warn('[smart-phrases] syncFromFirebase threw', e);
            seedDefaultSmartPhrases();
            if (cb) cb(getAllSmartPhrases());
        }
    }

    window.DEFAULT_SMART_PHRASES = DEFAULT_SMART_PHRASES;
    window.SEED_PHRASE_CATEGORIES = SEED_PHRASE_CATEGORIES;
    window.SMART_PHRASES_STORAGE_KEY = STORAGE_KEY;
    window.seedDefaultSmartPhrases = seedDefaultSmartPhrases;
    window.restoreDefaultSmartPhrases = restoreDefaultSmartPhrases;
    window.getAllSmartPhrases = getAllSmartPhrases;
    window.smartPhraseCategoryOf = categoryOf;
    window.writeSmartPhrase = writeSmartPhrase;
    window.deleteSmartPhrase = deleteSmartPhrase;
    window.syncSmartPhrasesFromFirebase = syncFromFirebase;
    window.syncSmartPhrasesToFirebase = syncToFirebase;
})();
