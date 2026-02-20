'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
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
