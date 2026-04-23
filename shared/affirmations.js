/* BendBSN — Daily login affirmation catalog
   ------------------------------------------------------------------
   Loaded by shared/header.js. After every fresh login, /index.html
   sets sessionStorage.bendbsn_show_affirmation = '1'. The header
   reads + clears that flag and shows ONE random affirmation in a
   soft top-of-screen banner that fades after a few seconds.

   pickAffirmation() avoids the most-recent 5 picks (per browser)
   so students don't see the same line two sessions in a row.

   Tone: short, warm, NCLEX/clinical-rotation-aware. No platitudes.
   Mix of validation + perseverance + showing-up-imperfectly +
   self-care reminders. Add freely — keep each line under ~110
   characters so it fits on a phone without wrapping past 2 lines.
*/
(function () {
    'use strict';
    if (window.AFFIRMATIONS) return;

    const AFFIRMATIONS = [
        // Validation — you belong
        "You belong in this profession.",
        "You earned your seat in that classroom.",
        "Imposter syndrome means you care about doing it right.",
        "Your patients are lucky to have someone learning this carefully.",
        "The fact that you double-check is a feature, not a flaw.",
        "Being new doesn't mean being less.",
        "You were chosen for this. They didn't make a mistake.",
        "Your questions are not annoying. Your questions are nursing.",

        // Perseverance — keep going
        "One shift at a time. One drug, one patient, one breath at a time.",
        "You don't have to know everything — you just have to keep showing up.",
        "Today's hard moment will be tomorrow's clinical wisdom.",
        "Progress isn't a straight line. Neither is becoming a nurse.",
        "The patients you'll never forget are still ahead of you.",
        "Every shift makes you sharper. Even the messy ones.",
        "You've already survived 100% of your hardest days so far.",
        "Med error or near-miss? You learned something forever. Keep going.",
        "Failing a quiz is not failing the dream.",
        "It's a marathon. You're allowed to walk for a minute.",

        // NCLEX / school grind
        "NCLEX is a test, not a verdict.",
        "Knowing the rationale matters more than memorizing the answer.",
        "ABCs first, then everything else. In life and on the test.",
        "You won't remember every electrolyte. You'll remember how to find it. That's enough.",
        "Care plans are scaffolding for thinking, not busywork. You're building a brain.",
        "Pharmacology gets easier. The patterns will start to click.",
        "Pathophys is a story, not a list. Keep reading the story.",
        "You're allowed to ask the same question three times.",

        // Compassion / clinical identity
        "Compassion is a clinical skill. You already have it.",
        "Your patients will remember the nurse who cared, not the one who knew every NCLEX trivia answer.",
        "Holding a hand IS an intervention.",
        "Listening is documentation. Listening is treatment.",
        "Sometimes the best assessment is just sitting at the bedside.",
        "You can be soft and still be safe.",
        "The way you talk to patients matters more than your skill score.",

        // Asking for help / teamwork
        "It's okay to ask the question. It's okay to ask twice.",
        "Asking for help is a competency, not a deficiency.",
        "Your preceptor expected you to be new. Lean on them.",
        "Calling for backup is the right call. Always.",
        "No nurse practices alone. We're a team for a reason.",

        // Self-care reminders
        "Sleep is also a clinical intervention. Take it.",
        "Eat the snack. Drink the water. Pee when you can.",
        "Your body is your instrument. Maintain it like one.",
        "Rest is not the opposite of progress. It IS progress.",
        "You can't pour from an empty IV bag.",
        "Take the break. The MAR will still be there.",
        "Boundaries are part of the assignment.",

        // Mental-health validation
        "Crying in the supply closet is allowed. So is laughing.",
        "Burnout is data, not a personal failing.",
        "Therapy is a nursing skill applied to yourself.",
        "It's okay to not feel okay after a hard shift.",
        "You're not behind. You're on YOUR path.",
        "Comparison is a thief. Don't let it take this from you.",

        // Show-up-imperfectly
        "You don't have to do it perfectly. You just have to do it.",
        "Done is better than polished today.",
        "Showing up tired still counts as showing up.",
        "B+ student becomes A+ nurse all the time. Keep going.",

        // Big picture
        "Someday you'll be the preceptor a new student leans on.",
        "The world needs you in scrubs. Don't quit.",
        "You're going to be somebody's favorite nurse.",
        "Twenty years from now, this will be the chapter that built you.",
        "Healthcare is hard. You being IN it makes it less hard for everyone.",

        // Daily warmth
        "Glad you're here today.",
        "Happy you logged in. Now go take care of someone.",
        "We're proud of you for showing up.",
        "You're doing better than you think.",
        "Good morning, future RN.",
        "Whatever today brings, you've got the tools.",
        "You are exactly where you need to be."
    ];

    // Rotating decorative icons — picked at random alongside the affirmation
    // so the banner's "vibe" varies even when the words repeat eventually.
    const ICONS = ['💚', '🌱', '✨', '🌟', '☀️', '💫', '🤍', '🌿', '💛', '🪷'];

    const RECENT_KEY    = 'bendbsn_recent_affirmations';
    const RECENT_LIMIT  = 5;
    const TOTAL         = AFFIRMATIONS.length;

    /**
     * Returns an affirmation index that is NOT in the most-recent
     * RECENT_LIMIT picks (per browser). Updates the recent list.
     */
    function pickAffirmation() {
        let recent = [];
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            if (raw) recent = JSON.parse(raw) || [];
        } catch (e) { recent = []; }

        // Build candidate pool excluding recent picks. Fallback: full pool.
        const pool = [];
        for (let i = 0; i < TOTAL; i += 1) {
            if (recent.indexOf(i) === -1) pool.push(i);
        }
        const pickFrom = pool.length > 0 ? pool : Array.from({ length: TOTAL }, function (_, i) { return i; });
        const idx = pickFrom[Math.floor(Math.random() * pickFrom.length)];

        // Update recent list (FIFO).
        recent.push(idx);
        while (recent.length > RECENT_LIMIT) recent.shift();
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}

        return {
            text: AFFIRMATIONS[idx],
            icon: ICONS[Math.floor(Math.random() * ICONS.length)],
            index: idx
        };
    }

    window.AFFIRMATIONS = AFFIRMATIONS;
    window.pickAffirmation = pickAffirmation;
})();
