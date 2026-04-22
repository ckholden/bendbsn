/* BendBSN — Clinical Assessment Packet — Module catalog + presets
   ------------------------------------------------------------------
   Shared between /clinical/ (index, picks initial enabledModules from
   a preset) and /clinical/packet/ (editor, renders tabs + drawer from
   the catalog).

   To add a new module: append to MODULE_CATALOG. The editor's render
   functions look up by id; module renderers ship in subsequent
   commits as the per-module code is filled in.

   `alwaysOn: true` means the toggle in the drawer is locked enabled
   (Info, Notes — every packet should keep these).
*/
(function () {
    'use strict';
    if (window.CAP_MODULES) return;

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

        { id: 'meds',          label: 'Medications',                  category: 'Default',                          icon: '💊' },
        { id: 'sbar',          label: 'SBAR Report',                  category: 'Default',                          icon: '📞' },
        { id: 'progressNotes', label: 'Progress Notes',               category: 'Default',                          icon: '✏️' },
        { id: 'carePlan',      label: 'Care Plan',                    category: 'Default',                          icon: '🗂️' },
        { id: 'ncsbn',         label: 'Clinical Judgment (NCSBN)',    category: 'Default',                          icon: '⚖️' },

        { id: 'morse',         label: 'Morse Fall Scale',             category: 'Scales',                           icon: '⚠️' },
        { id: 'braden',        label: 'Braden Scale',                 category: 'Scales',                           icon: '🛌' },
        { id: 'hendrich',      label: 'Hendrich II Fall Model',       category: 'Scales',                           icon: '🚶' },

        // ---- Validated screening tools (from RN Notes / app) ----
        { id: 'phq9',          label: 'PHQ-9 (Depression)',           category: 'Screenings',                       icon: '💭' },
        { id: 'gad7',          label: 'GAD-7 (Anxiety)',              category: 'Screenings',                       icon: '😰' },
        { id: 'cssrs',         label: 'C-SSRS (Suicide Risk)',        category: 'Screenings',                       icon: '🚨' },
        { id: 'cage',          label: 'CAGE (Alcohol)',               category: 'Screenings',                       icon: '🍷' },
        { id: 'cam',           label: 'CAM (Confusion / Delirium)',   category: 'Screenings',                       icon: '🌀' },

        { id: 'omega',         label: 'OMEGA-7',                      category: 'Memory care / AL',                 icon: 'Ω' },
        { id: 'minicog',       label: 'Mini-Cog',                     category: 'Memory care / AL',                 icon: '🧠' },
        { id: 'behavior',      label: 'Behavior (ABC)',               category: 'Memory care / AL',                 icon: '🎭' },

        { id: 'headToToe',     label: 'Head-to-Toe Assessment',       category: 'Acute care',                       icon: '👁' },

        { id: 'caseStudy',     label: 'Case Study',                   category: 'Academic',                         icon: '🎓' },
        { id: 'conceptMap',    label: 'Concept Map',                  category: 'Academic',                         icon: '🗺️' },
        { id: 'references',    label: 'APA References',               category: 'Academic',                         icon: '📚' }
    ];

    // Preset templates — picked at packet creation time. Always include
    // the always-on modules (info + notes); the rest is per-template.
    const MODULE_PRESETS = {
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
            'info', 'phq9', 'gad7', 'cssrs', 'cage',
            'ncsbn', 'sbar', 'progressNotes', 'notes', 'carePlan'
        ],
        'custom': ['info', 'notes']
    };

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

    window.CAP_MODULES = {
        CATEGORY_ORDER: CATEGORY_ORDER,
        MODULE_CATALOG: MODULE_CATALOG,
        MODULE_PRESETS: MODULE_PRESETS,
        MODULE_BY_ID: MODULE_BY_ID,
        modulesByCategory: modulesByCategory,
        SCHEMA_VERSION: 2  // bumped for screening modules
    };
})();
