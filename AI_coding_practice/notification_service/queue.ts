/**
 * queue.ts — pub/sub dispatch with retry logic
 *
 * Each channel (email, sms, inapp) has its own async processor.
 * On failure it retries up to MAX_RETRIES times before marking the channel failed.
 * When all channels for a notification settle, the notification-level status is resolved.
 */

import { ChannelName, NotificationStatus } from './models/notification';
import { logger } from './logger';
import * as store from './store';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200; // kept short; increase in production

// ── Simulated channel adapters ────────────────────────────────────────────────
// In a real system these would call SES, Twilio, etc.
// They randomly fail ~30% of the time to exercise retry logic.
async function dispatchEmail(_notificationId: string, _candidateId: string): Promise<void> {
  if (Math.random() < 0.3) throw new Error('Email delivery failed (simulated)');
}

async function dispatchSms(_notificationId: string, _candidateId: string): Promise<void> {
  if (Math.random() < 0.3) throw new Error('SMS delivery failed (simulated)');
}

async function dispatchInApp(_notificationId: string, _candidateId: string): Promise<void> {
  if (Math.random() < 0.3) throw new Error('In-app delivery failed (simulated)');
}

const adapters: Record<ChannelName, (notifId: string, candidateId: string) => Promise<void>> = {
  email: dispatchEmail,
  sms:   dispatchSms,
  inapp: dispatchInApp,
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Per-channel processor with retry ─────────────────────────────────────────
async function processChannel(
  notificationId: string,
  candidateId: string,
  channel: ChannelName
): Promise<'sent' | 'failed'> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      await adapters[channel](notificationId, candidateId);
      logger.info(`Channel delivered`, { notificationId, channel, attempt });
      return 'sent';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Channel attempt failed`, { notificationId, channel, attempt, error: message });

      // Update retry count in store
      const notif = store.getNotification(notificationId);
      if (notif) {
        const ch = notif.channels.find(c => c.channel === channel);
        if (ch) ch.retries = attempt;
      }

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  logger.error(`Channel exhausted retries`, { notificationId, channel });
  return 'failed';
}

// ── Public: dispatch all channels for a notification ─────────────────────────
export async function dispatch(notificationId: string, candidateId: string): Promise<void> {
  const notif = store.getNotification(notificationId);
  if (!notif) {
    logger.error('dispatch: notification not found', { notificationId });
    return;
  }

  logger.info('Dispatching notification to all channels', { notificationId });

  // Run all three channels concurrently
  const results = await Promise.all(
    notif.channels.map(async ch => {
      const result = await processChannel(notificationId, candidateId, ch.channel);

      // Write channel result back to store
      store.updateNotification(notificationId, {}); // touch dateModified
      const n = store.getNotification(notificationId)!;
      const chEntry = n.channels.find(c => c.channel === ch.channel);
      if (chEntry) chEntry.status = result;

      return result;
    })
  );

  // Resolve notification-level status
  const allSent   = results.every(r => r === 'sent');
  const allFailed = results.every(r => r === 'failed');
  const overallStatus: NotificationStatus = allSent ? 'sent' : allFailed ? 'failed' : 'failed';

  store.updateNotification(notificationId, { status: overallStatus });
  logger.info('Notification settled', { notificationId, status: overallStatus });
}
