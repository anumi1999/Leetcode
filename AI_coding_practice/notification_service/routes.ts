import { Router, Request, Response } from 'express';
import * as core from './core';
import { NotificationStatus, ChannelName } from './models/notification';
import { logger } from './logger';

const router = Router();

const VALID_STATUSES: NotificationStatus[] = ['pending', 'sent', 'failed'];
const VALID_CHANNELS: ChannelName[]        = ['email', 'sms', 'inapp'];

// ── POST /notification ────────────────────────────────────────────────────────
// Create a notification and fire-and-forget dispatch to all channels.
router.post('/notification', (req: Request, res: Response) => {
  const { candidateId, jobId, applicationId, recruiterId, notificationDetails } = req.body;

  if (!candidateId || !jobId || !applicationId || !recruiterId || !notificationDetails) {
    return res.status(400).json({
      error: 'candidateId, jobId, applicationId, recruiterId, and notificationDetails are required',
    });
  }

  try {
    const notification = core.createNotification({
      candidateId:         String(candidateId),
      jobId:               String(jobId),
      applicationId:       String(applicationId),
      recruiterId:         String(recruiterId),
      notificationDetails: String(notificationDetails),
    });

    return res.status(201).json({
      notificationId: notification.notificationId,
      status:         notification.status,
      channels:       notification.channels,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('POST /notification failed', { error: message });
    return res.status(404).json({ error: message });
  }
});

// ── GET /status/stats ─────────────────────────────────────────────────────────
// Must come before /status/:notificationId to avoid "stats" being treated as an id
router.get('/status/stats', (_req: Request, res: Response) => {
  return res.json(core.getStats());
});

// ── GET /status/notification ──────────────────────────────────────────────────
// Dashboard query with optional filters: ?jobId= &status= &channel= &applicationId=
router.get('/status/notification', (req: Request, res: Response) => {
  const { jobId, status, channel, applicationId } = req.query;

  if (status && !VALID_STATUSES.includes(status as NotificationStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (channel && !VALID_CHANNELS.includes(channel as ChannelName)) {
    return res.status(400).json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
  }

  const results = core.queryNotifications({
    jobId:         jobId        as string | undefined,
    status:        status       as NotificationStatus | undefined,
    channel:       channel      as ChannelName | undefined,
    applicationId: applicationId as string | undefined,
  });

  return res.json(results);
});

// ── GET /status/:notificationId ───────────────────────────────────────────────
router.get('/status/:notificationId', (req: Request, res: Response) => {
  const notification = core.getNotificationStatus(req.params.notificationId);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  return res.json(notification);
});

export default router;
