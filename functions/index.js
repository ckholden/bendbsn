'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
 * them a welcome email via the EmailJS REST API. Marks welcomeEmailSent: true
 * on success so the email is never sent twice.
 *
 * Safety: only fires once per day, only touches users who have never gotten
 * a welcome email, and skips anyone already marked as sent. No random sends.
 */
exports.sendDailyWelcomeEmails = onSchedule(
    { schedule: '0 7 * * *', timeZone: 'America/Los_Angeles' },
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

        // EmailJS REST API credentials (same keys used by the admin panel browser client)
        const EMAILJS_SERVICE_ID = 'service_2dw80zz';
        const EMAILJS_TEMPLATE_ID = 'template_ty32lyw';
        const EMAILJS_PUBLIC_KEY = 'Paf-N3lByYsImp0af';

        let sent = 0;
        let failed = 0;

        for (const [uid, p] of pending) {
            const name = p.displayName || (p.email ? p.email.split('@')[0] : 'Student');
            try {
                const templateParams = {
                    to_name: name,
                    to_email: p.email,
                    reply_to: p.email,
                    login_link: 'https://bendbsn.com',
                    message: (
                        `Your BendBSN account has been successfully created!\n\n` +
                        `Please use your email address (${p.email}) and the password ` +
                        `you created to log in.\n\n` +
                        `Click the link below to access your account.`
                    )
                };

                const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        service_id: EMAILJS_SERVICE_ID,
                        template_id: EMAILJS_TEMPLATE_ID,
                        user_id: EMAILJS_PUBLIC_KEY,
                        template_params: templateParams
                    })
                });

                if (response.ok) {
                    await profilesRef.child(uid).update({ welcomeEmailSent: true });
                    sent++;
                    logger.info(`sendDailyWelcomeEmails: sent to ${p.email}`);
                } else {
                    const body = await response.text();
                    logger.error(
                        `sendDailyWelcomeEmails: EmailJS returned ${response.status} for` +
                        ` ${p.email}: ${body}`
                    );
                    failed++;
                }
            } catch (err) {
                logger.error(`sendDailyWelcomeEmails: exception for ${p.email}:`, err);
                failed++;
            }

            // Respect EmailJS rate limits (~600 ms between sends)
            if (pending.indexOf(pending.find(([u]) => u === uid)) < pending.length - 1) {
                await new Promise(r => setTimeout(r, 700));
            }
        }

        logger.info(
            `sendDailyWelcomeEmails: complete — sent=${sent}, failed=${failed}`
        );
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
