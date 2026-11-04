'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

// Welcome emails go out through Resend (https://resend.com) from the verified bendbsn.com domain.
// Set the key with: firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const WELCOME_FROM = 'BendBSN <hello@bendbsn.com>';
const WELCOME_REPLY_TO = 'hello@bendbsn.com';
// Resend's free plan allows 100 emails a day and 2 API requests a second. One run sends at most
// WELCOME_DAILY_CAP, leaving room for test sends; anyone left over stays pending for the next run.
const WELCOME_DAILY_CAP = 90;
const WELCOME_SEND_GAP_MS = 700;
// sendWelcomeEmailOnSignup waits this long after a profile is created, then re-reads it. While the
// sign-up page still sends its own browser (EmailJS) welcome and sets welcomeEmailSent, this stops a
// second email; once the page stops sending, every sign-up gets the Resend email after this delay.
const WELCOME_SIGNUP_WAIT_MS = 20000;

function welcomeEmailText(name, email) {
    return (
        `Hi ${name},\n\n` +
        `Your BendBSN account has been successfully created!\n\n` +
        `Please use your email address (${email}) and the password ` +
        `you created to log in.\n\n` +
        `Click the link below to access your account.\n\n` +
        `https://bendbsn.com\n`
    );
}

// Sends one welcome email. The idempotency key stops a retried request from sending twice (Resend
// keeps it for 24 hours). Returns { ok, status, id, body } and never throws for an HTTP error.
async function sendWelcomeEmail(apiKey, { name, email, idempotencyKey }) {
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            from: WELCOME_FROM,
            to: [email],
            reply_to: WELCOME_REPLY_TO,
            subject: 'Welcome to BendBSN',
            text: welcomeEmailText(name, email)
        })
    });
    const body = await response.text();
    let id = null;
    try { id = JSON.parse(body).id || null; } catch (e) { /* non-JSON error body */ }
    return { ok: response.ok, status: response.status, id, body };
}

// userProfiles/{uid}/isAdmin in the RTDB is the source of truth for admin rights: database.rules.json
// and the admin panel both check it. The isAdmin custom claim is only a mirror of that flag, so every
// admin check here reads the RTDB, and grant/revoke always writes both.
async function isRtdbAdmin(uid) {
    if (!uid) return false;
    const snap = await admin.database().ref('userProfiles/' + uid + '/isAdmin').once('value');
    return snap.val() === true;
}

/**
 * sendDailyWelcomeEmails
 *
 * Runs every day at 07:00 America/Los_Angeles (Pacific time, DST-aware).
 *
 * Finds users in userProfiles whose welcomeEmailSent flag is not set and sends
 * them a welcome email through Resend. Marks welcomeEmailSent: true on success
 * so the email is never sent twice.
 *
 * Catch-up for sendWelcomeEmailOnSignup: picks up anyone whose sign-up send failed.
 *
 * Safety: only fires once per day, only touches users who have never gotten
 * a welcome email, and skips anyone already marked as sent. No random sends.
 * At most WELCOME_DAILY_CAP sends per run; a 429 (rate or daily quota) ends the
 * run and leaves the rest pending for tomorrow.
 */
exports.sendDailyWelcomeEmails = onSchedule(
    {
        schedule: '0 7 * * *',
        timeZone: 'America/Los_Angeles',
        secrets: [RESEND_API_KEY],
        timeoutSeconds: 300
    },
    async () => {
        const db = admin.database();
        const profilesRef = db.ref('userProfiles');

        const snap = await profilesRef.once('value');
        if (!snap.exists()) {
            logger.info('sendDailyWelcomeEmails: no userProfiles found — nothing to do');
            return;
        }

        const profiles = snap.val();
        // manual_ keys are admin-added placeholders for people who have not registered yet; the
        // welcome text ("use the password you created") would be wrong for them.
        const pending = Object.entries(profiles).filter(
            ([uid, p]) => p && !p.welcomeEmailSent && p.email && !uid.startsWith('manual_') && p.welcomeEmailSkipped !== true
        );

        if (pending.length === 0) {
            logger.info('sendDailyWelcomeEmails: no pending welcome emails — nothing to do');
            return;
        }

        logger.info(`sendDailyWelcomeEmails: found ${pending.length} pending user(s)`);

        const batch = pending.slice(0, WELCOME_DAILY_CAP);
        if (pending.length > batch.length) {
            logger.info(
                `sendDailyWelcomeEmails: sending ${batch.length} today (daily cap);` +
                ` ${pending.length - batch.length} left for the next run`
            );
        }

        const apiKey = RESEND_API_KEY.value();
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < batch.length; i++) {
            const [uid, p] = batch[i];
            const name = p.displayName || (p.email ? p.email.split('@')[0] : 'Student');
            try {
                const result = await sendWelcomeEmail(apiKey, {
                    name,
                    email: p.email,
                    idempotencyKey: `welcome-${uid}`
                });

                if (result.ok) {
                    await profilesRef.child(uid).update({ welcomeEmailSent: true });
                    sent++;
                    logger.info(`sendDailyWelcomeEmails: sent to ${p.email} (resend id ${result.id})`);
                } else {
                    logger.error(
                        `sendDailyWelcomeEmails: Resend returned ${result.status} for` +
                        ` ${p.email}: ${result.body}`
                    );
                    failed++;
                    if (result.status === 429) {
                        logger.warn('sendDailyWelcomeEmails: Resend rate or daily limit reached; stopping this run');
                        break;
                    }
                }
            } catch (err) {
                logger.error(`sendDailyWelcomeEmails: exception for ${p.email}:`, err);
                failed++;
            }

            // Stay under Resend's 2 requests a second
            if (i < batch.length - 1) {
                await new Promise(r => setTimeout(r, WELCOME_SEND_GAP_MS));
            }
        }

        logger.info(
            `sendDailyWelcomeEmails: complete — sent=${sent}, failed=${failed}`
        );
    }
);

/**
 * sendWelcomeEmailOnSignup
 *
 * Sends the welcome email through Resend when a new userProfiles/{uid} node is
 * created, after WELCOME_SIGNUP_WAIT_MS. It uses the same rules as
 * sendDailyWelcomeEmails (skips manual_ placeholders, profiles with no email,
 * anyone already sent or marked welcomeEmailSkipped) and the same idempotency key
 * (welcome-<uid>), so the daily job cannot send it a second time. On failure it
 * leaves welcomeEmailSent false and the 07:00 run retries.
 */
exports.sendWelcomeEmailOnSignup = onValueCreated(
    {
        ref: '/userProfiles/{uid}',
        instance: 'bendbsn-17377-default-rtdb',
        secrets: [RESEND_API_KEY],
        timeoutSeconds: 60
    },
    async (event) => {
        const uid = event.params.uid;
        if (uid.startsWith('manual_')) return;

        await new Promise(r => setTimeout(r, WELCOME_SIGNUP_WAIT_MS));

        const ref = admin.database().ref('userProfiles/' + uid);
        const p = (await ref.once('value')).val();
        if (!p || !p.email || p.welcomeEmailSent || p.welcomeEmailSkipped === true) {
            logger.info(`sendWelcomeEmailOnSignup: nothing to send for uid=${uid}`);
            return;
        }

        const name = p.displayName || p.email.split('@')[0];
        try {
            const result = await sendWelcomeEmail(RESEND_API_KEY.value(), {
                name,
                email: p.email,
                idempotencyKey: `welcome-${uid}`
            });
            if (result.ok) {
                await ref.update({ welcomeEmailSent: true });
                logger.info(`sendWelcomeEmailOnSignup: sent to ${p.email} (resend id ${result.id})`);
            } else {
                logger.error(
                    `sendWelcomeEmailOnSignup: Resend returned ${result.status} for ${p.email}: ${result.body};` +
                    ' the daily run will retry'
                );
            }
        } catch (err) {
            logger.error(`sendWelcomeEmailOnSignup: exception for ${p.email}; the daily run will retry:`, err);
        }
    }
);

/**
 * sendTestWelcomeEmail
 *
 * Admin-only callable that sends the welcome email to the CALLER's own sign-in
 * address, never anyone else's, through the same path as sendDailyWelcomeEmails.
 * It does not touch welcomeEmailSent. Used to check delivery and SPF/DKIM/DMARC.
 *
 * Usage from the admin panel console:
 *   await firebase.functions().httpsCallable('sendTestWelcomeEmail')();
 */
exports.sendTestWelcomeEmail = onCall(
    { region: 'us-central1', secrets: [RESEND_API_KEY] },
    async (request) => {
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'Authentication required.');
        if (!(await isRtdbAdmin(auth.uid))) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }
        const email = auth.token.email;
        if (!email) throw new HttpsError('failed-precondition', 'Your account has no email address.');

        const name = auth.token.name || email.split('@')[0];
        const result = await sendWelcomeEmail(RESEND_API_KEY.value(), { name, email });
        if (!result.ok) {
            logger.error(`sendTestWelcomeEmail: Resend returned ${result.status} for ${email}: ${result.body}`);
            throw new HttpsError('internal', `Resend returned ${result.status}.`);
        }
        logger.info(`sendTestWelcomeEmail: sent to ${email} (resend id ${result.id}) by caller=${auth.uid}`);
        return { id: result.id, to: email };
    }
);

/**
 * setAdminClaim
 *
 * Callable function that grants or revokes admin rights: it writes both the RTDB
 * userProfiles/{uid}/isAdmin flag (what the rules check) and the isAdmin custom claim.
 * Caller must have isAdmin: true in their userProfiles RTDB node.
 *
 * Usage from admin panel:
 *   const fn = firebase.functions().httpsCallable('setAdminClaim');
 *   await fn({ uid: targetUid, revoke: false });
 */
exports.setAdminClaim = onCall({ region: 'us-central1' }, async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    // The RTDB flag is authoritative. A stale custom claim alone (e.g. left over after a revoke)
    // must not be enough to grant or revoke admin rights.
    if (!(await isRtdbAdmin(auth.uid))) {
        throw new HttpsError('permission-denied', 'Admins only.');
    }

    const { uid, revoke } = request.data || {};
    if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'uid is required.');
    if (uid.startsWith('manual_')) {
        throw new HttpsError('failed-precondition', 'That account has not registered yet.');
    }
    if (revoke && uid === auth.uid) {
        throw new HttpsError('failed-precondition', 'You cannot remove your own admin rights.');
    }
    try {
        await admin.auth().getUser(uid);
    } catch (e) {
        if (e.code === 'auth/user-not-found') throw new HttpsError('not-found', 'That account has not registered yet.');
        throw new HttpsError('internal', 'Could not look up user.');
    }
    if (revoke) {
        const admins = await admin.database().ref('userProfiles').orderByChild('isAdmin').equalTo(true).once('value');
        if (admins.numChildren() <= 1 && admins.hasChild(uid)) {
            throw new HttpsError('failed-precondition', 'Cannot remove the last remaining admin.');
        }
    }

    // Write both, so the rules (RTDB flag) and the claim can never disagree. Previously a revoke only
    // cleared the claim; the RTDB flag stayed true and bootstrapAdminClaims re-granted the claim nightly.
    await admin.auth().setCustomUserClaims(uid, revoke ? {} : { isAdmin: true });
    if (revoke) {
        await admin.database().ref('userProfiles/' + uid + '/isAdmin').remove();
    } else {
        await admin.database().ref('userProfiles/' + uid + '/isAdmin').set(true);
    }
    logger.info(`setAdminClaim: ${revoke ? 'revoked' : 'granted'} isAdmin for uid=${uid} by caller=${auth.uid}`);
    return { success: true };
});

/**
 * bootstrapAdminClaims
 *
 * Scheduled function that runs daily and keeps custom claims in sync with the RTDB:
 * every userProfile with isAdmin: true gets the claim, and any user holding the claim
 * whose RTDB flag is gone has it cleared.
 * Idempotent — safe to run repeatedly.
 */
exports.bootstrapAdminClaims = onSchedule(
    { schedule: 'every 24 hours', region: 'us-central1' },
    async () => {
        const snap = await admin.database().ref('userProfiles')
            .orderByChild('isAdmin').equalTo(true).once('value');
        const rtdbAdmins = new Set();
        snap.forEach(child => { rtdbAdmins.add(child.key); });

        // Clear stale claims: anyone holding isAdmin in their token whose RTDB flag is gone.
        let cleared = 0;
        let pageToken;
        do {
            const page = await admin.auth().listUsers(1000, pageToken);
            for (const u of page.users) {
                if (u.customClaims?.isAdmin === true && !rtdbAdmins.has(u.uid)) {
                    try {
                        await admin.auth().setCustomUserClaims(u.uid, {});
                        cleared++;
                        logger.info(`bootstrapAdminClaims: cleared stale claim for uid=${u.uid}`);
                    } catch (err) {
                        logger.error(`bootstrapAdminClaims: failed to clear claim for uid=${u.uid}`, err);
                    }
                }
            }
            pageToken = page.pageToken;
        } while (pageToken);
        if (cleared) logger.info(`bootstrapAdminClaims: cleared ${cleared} stale claim(s)`);

        if (!snap.exists()) {
            logger.info('bootstrapAdminClaims: no admin profiles found');
            return;
        }

        const promises = [];
        snap.forEach(child => {
            promises.push(
                admin.auth().setCustomUserClaims(child.key, { isAdmin: true })
                    .then(() => logger.info(`bootstrapAdminClaims: set claim for uid=${child.key}`))
                    .catch(err => logger.error(`bootstrapAdminClaims: failed for uid=${child.key}`, err))
            );
        });
        await Promise.all(promises);
        logger.info(`bootstrapAdminClaims: processed ${promises.length} admin user(s)`);
    }
);

/**
 * backfillTenantId
 *
 * One-time callable that writes tenantId: 'bendbsn' to every userProfile
 * that is missing it. Call once from the admin panel after deploy.
 */
exports.backfillTenantId = onCall({ region: 'us-central1' }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Authentication required.');
    if (!(await isRtdbAdmin(auth.uid))) {
        throw new HttpsError('permission-denied', 'Admins only.');
    }

    const snap = await admin.database().ref('userProfiles').once('value');
    const updates = {};
    snap.forEach(child => {
        if (!child.val()?.tenantId) {
            updates[child.key + '/tenantId'] = 'bendbsn';
        }
    });

    if (Object.keys(updates).length > 0) {
        await admin.database().ref('userProfiles').update(updates);
    }
    logger.info(`backfillTenantId: updated ${Object.keys(updates).length} profile(s)`);
    return { updated: Object.keys(updates).length };
});
