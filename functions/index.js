'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueCreated } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Presence entries older than this are considered stale.
// 60 minutes = 2× the 30-min auto-logout threshold, giving a comfortable buffer
// for onDisconnect() to fire under normal conditions before the function runs.
const STALE_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * cleanupStalePresence
 *
 * Scheduled safety-net cleanup that removes ghost entries from chat/presence/{uid}.
 * Runs every 30 minutes.
 *
 * onDisconnect() handles normal disconnects (tab close, navigation, explicit logout)
 * but can fail when:
 *   - Browser is force-killed or crashes
 *   - Device loses power or network before the disconnect handler fires
 *   - Firebase connection drops without a clean handshake
 *
 * Data shape expected at chat/presence/{uid}:
 *   { user, username, uid, status: "online"|"away", lastActive: <epoch ms> }
 */
exports.cleanupStalePresence = onSchedule('every 30 minutes', async () => {
    const db = admin.database();
    const presenceRef = db.ref('chat/presence');

    const snap = await presenceRef.once('value');

    if (!snap.exists()) {
        logger.info('cleanupStalePresence: no presence entries — nothing to do');
        return;
    }

    const now = Date.now();
    const updates = {};
    let staleCount = 0;
    let freshCount = 0;

    snap.forEach(child => {
        const data = child.val();
        // Treat missing lastActive as epoch 0 (always stale)
        const lastActive = (data && data.lastActive) ? data.lastActive : 0;
        const ageMs = now - lastActive;

        if (ageMs > STALE_THRESHOLD_MS) {
            updates[child.key] = null; // null = delete in RTDB multi-path update
            staleCount++;
            logger.debug(
                `stale: uid=${child.key} user="${data && data.user || '?'}"` +
                ` lastActive=${new Date(lastActive).toISOString()}` +
                ` age=${Math.round(ageMs / 60000)}min`
            );
        } else {
            freshCount++;
        }
    });

    if (staleCount > 0) {
        await presenceRef.update(updates);
        logger.info(
            `cleanupStalePresence: removed ${staleCount} stale` +
            ` (${freshCount} fresh remaining)`
        );
    } else {
        logger.info(
            `cleanupStalePresence: all ${freshCount} entries are fresh — nothing removed`
        );
    }
});

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
        const pending = Object.entries(profiles).filter(
            ([, p]) => p && !p.welcomeEmailSent && p.email
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
 * onDMSent
 *
 * Fires when a new direct message is written. Sends a push notification to the
 * recipient using any FCM tokens stored under userFCMTokens/{recipientUid}.
 * Invalid tokens are cleaned up automatically.
 */
exports.onDMSent = onValueCreated(
    { ref: '/directMessages/{convId}/messages/{msgId}', region: 'us-central1' },
    async (event) => {
        const msg = event.data.val();
        if (!msg || !msg.recipientUid || !msg.senderName) return;

        const db = admin.database();
        const tokensSnap = await db.ref(`userFCMTokens/${msg.recipientUid}`).get();
        if (!tokensSnap.exists()) return;

        const tokens = Object.values(tokensSnap.val())
            .map(t => t.token)
            .filter(Boolean);
        if (!tokens.length) return;

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: `DM from ${msg.senderName}`,
                body: (msg.text || 'New message').substring(0, 100)
            },
            data: { url: '/chat/', tag: `dm-${event.params.convId}` },
            webpush: { fcmOptions: { link: 'https://bendbsn.com/chat/' } }
        });

        // Remove tokens that FCM reports as invalid or unregistered
        const cleanupPromises = [];
        response.responses.forEach((r, i) => {
            const code = r.error?.code;
            if (!r.success && (
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/registration-token-not-registered'
            )) {
                const badKey = tokens[i].replace(/\./g, ',').substring(0, 768);
                cleanupPromises.push(
                    db.ref(`userFCMTokens/${msg.recipientUid}/${badKey}`).remove()
                );
            }
        });
        await Promise.all(cleanupPromises);
    }
);

/**
 * onChatMention
 *
 * Fires when a new channel message is written. Scans the message text for
 * @firstName mentions, resolves matching UIDs from userProfiles, and sends a
 * push notification to each mentioned user (excluding the sender).
 */
exports.onChatMention = onValueCreated(
    { ref: '/chat/messages/{channelId}/{msgId}', region: 'us-central1' },
    async (event) => {
        const msg = event.data.val();
        if (!msg || !msg.text) return;

        const mentionRegex = /@([\w.-]+)/g;
        const mentions = [...msg.text.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
        if (!mentions.length) return;

        const db = admin.database();
        const profilesSnap = await db.ref('userProfiles').get();
        if (!profilesSnap.exists()) return;

        // Match first names to UIDs, skip the sender
        const notifiedUids = new Set();
        profilesSnap.forEach(child => {
            const profile = child.val();
            const uid = child.key;
            if (!profile || !profile.displayName || uid === msg.senderUid) return;
            const firstName = profile.displayName.split(' ')[0].toLowerCase();
            if (mentions.includes(firstName)) {
                notifiedUids.add(uid);
            }
        });

        for (const uid of notifiedUids) {
            const tokensSnap = await db.ref(`userFCMTokens/${uid}`).get();
            if (!tokensSnap.exists()) continue;

            const tokens = Object.values(tokensSnap.val())
                .map(t => t.token)
                .filter(Boolean);
            if (!tokens.length) continue;

            await admin.messaging().sendEachForMulticast({
                tokens,
                notification: {
                    title: `${msg.user || 'Someone'} mentioned you`,
                    body: (msg.text || '').substring(0, 100)
                },
                data: {
                    url: '/chat/',
                    tag: `mention-${event.params.channelId}`
                },
                webpush: { fcmOptions: { link: 'https://bendbsn.com/chat/' } }
            });
        }
    }
);
