/**
 * core.ts — business logic
 *
 * createNotification flow:
 *  1. Validate candidate, application & job exist
 *  2. Build Notification object (all channels pending)
 *  3. Persist to store + attach to candidate's notification list
 *  4. Fire-and-forget dispatch to queue (non-blocking for the HTTP response)
 */

import { v4 as uuidv4 } from 'uuid';
import { Notification, ChannelName, NotificationStatus } from './models/notification';
import * as store from './store';
import * as queue from './queue';
import { logger } from './logger';

const CHANNELS: ChannelName[] = ['email', 'sms', 'inapp'];

export interface CreateNotificationInput {
  candidateId: string;
  jobId: string;
  applicationId: string;
  recruiterId: string;
  notificationDetails: string;
}

export function createNotification(input: CreateNotificationInput): Notification {
  const { candidateId, jobId, applicationId, recruiterId, notificationDetails } = input;

  // Validate references
  if (!store.getCandidate(candidateId))     throw new Error(`Candidate not found: ${candidateId}`);
  if (!store.getJob(jobId))                 throw new Error(`Job not found: ${jobId}`);
  const application = store.getApplication(applicationId);
  if (!application)                         throw new Error(`Application not found: ${applicationId}`);

  const now = new Date();
  const notification: Notification = {
    notificationId:      uuidv4(),
    candidateId,
    jobId,
    applicationId,
    recruiterId,
    notificationDetails,
    applicationStatus:   application.status,
    status:       'pending',
    channels:     CHANNELS.map(ch => ({ channel: ch, retries: 0, status: 'pending' })),
    dateSent:     now,
    dateModified: now,
  };

  // Persist
  store.insertNotification(notification);
  store.pushNotificationToCandidate(candidateId, notification.notificationId);
  if (store.getRecruiter(recruiterId)) {
    store.pushNotificationToRecruiter(recruiterId, notification.notificationId);
  }

  logger.info('Notification created', {
    notificationId: notification.notificationId,
    candidateId,
    jobId,
    applicationId,
  });

  // Dispatch asynchronously — HTTP response returns immediately with "pending"
  queue.dispatch(notification.notificationId, candidateId).catch(err => {
    logger.error('Unexpected dispatch error', {
      notificationId: notification.notificationId,
      error: String(err),
    });
  });

  return notification;
}

export function getNotificationStatus(notificationId: string): Notification | null {
  return store.getNotification(notificationId) ?? null;
}

export function queryNotifications(filters: {
  jobId?: string;
  status?: NotificationStatus;
  channel?: ChannelName;
  applicationId?: string;
}) {
  return store.queryNotifications(filters);
}

export function getStats() {
  return store.getStats();
}
