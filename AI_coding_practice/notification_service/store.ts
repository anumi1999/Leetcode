import { Notification, NotificationStatus, ChannelName } from './models/notification';
import { Candidate } from './models/candidate';
import { Recruiter } from './models/recruiter';
import { Application } from './models/application';
import { Job } from './models/job';

// ── Tables ────────────────────────────────────────────────────────────────────
const notifications = new Map<string, Notification>();
const candidates    = new Map<string, Candidate>();
const recruiters    = new Map<string, Recruiter>();
const applications  = new Map<string, Application>();
const jobs          = new Map<string, Job>();

// ── Notifications ─────────────────────────────────────────────────────────────
export function insertNotification(n: Notification): void {
  notifications.set(n.notificationId, n);
}

export function getNotification(id: string): Notification | undefined {
  return notifications.get(id);
}

export function updateNotification(id: string, patch: Partial<Notification>): Notification | null {
  const n = notifications.get(id);
  if (!n) return null;
  Object.assign(n, patch, { dateModified: new Date() });
  return n;
}

export function queryNotifications(filters: {
  jobId?: string;
  status?: NotificationStatus;
  channel?: ChannelName;
  applicationId?: string;
}): Notification[] {
  let result = [...notifications.values()];

  if (filters.jobId)        result = result.filter(n => n.jobId === filters.jobId);
  if (filters.applicationId) result = result.filter(n => n.applicationId === filters.applicationId);
  if (filters.status)       result = result.filter(n => n.status === filters.status);
  if (filters.channel) {
    result = result.filter(n =>
      n.channels.some(c => c.channel === filters.channel && c.status === filters.status)
    );
  }

  return result;
}

export function getStats(): { total: number; sent: number; failed: number; pending: number } {
  let sent = 0, failed = 0, pending = 0;
  for (const n of notifications.values()) {
    if (n.status === 'sent')    sent++;
    else if (n.status === 'failed')  failed++;
    else                             pending++;
  }
  return { total: notifications.size, sent, failed, pending };
}

// ── Candidates ────────────────────────────────────────────────────────────────
export function insertCandidate(c: Candidate): void {
  candidates.set(c.userId, c);
}

export function getCandidate(id: string): Candidate | undefined {
  return candidates.get(id);
}

export function pushNotificationToCandidate(candidateId: string, notificationId: string): void {
  const c = candidates.get(candidateId);
  if (c) c.notificationIds.push(notificationId);
}

// ── Recruiters ────────────────────────────────────────────────────────────────
export function insertRecruiter(r: Recruiter): void {
  recruiters.set(r.recruiterId, r);
}

export function getRecruiter(id: string): Recruiter | undefined {
  return recruiters.get(id);
}

export function pushNotificationToRecruiter(recruiterId: string, notificationId: string): void {
  const r = recruiters.get(recruiterId);
  if (r) r.notificationIds.push(notificationId);
}

// ── Applications ──────────────────────────────────────────────────────────────
export function insertApplication(a: Application): void {
  applications.set(a.applicationId, a);
}

export function getApplication(id: string): Application | undefined {
  return applications.get(id);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export function insertJob(j: Job): void {
  jobs.set(j.jobId, j);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

// ── Seed (dev convenience) ────────────────────────────────────────────────────
export function seed(): void {
  // Jobs
  insertJob({ jobId: 'job-001', name: 'Software Engineer',       description: 'Build scalable backend systems.' });
  insertJob({ jobId: 'job-002', name: 'Product Manager',         description: 'Drive product vision and roadmap.' });
  insertJob({ jobId: 'job-003', name: 'ML Engineer',             description: 'Train and deploy ML models at scale.' });

  // Recruiters
  insertRecruiter({ recruiterId: 'rec-001', name: 'Alice',   company: 'Eightfold', email: 'alice@eightfold.ai',   contact: '+1-555-0001', notificationIds: [] });
  insertRecruiter({ recruiterId: 'rec-002', name: 'Charlie', company: 'Eightfold', email: 'charlie@eightfold.ai', contact: '+1-555-0002', notificationIds: [] });

  // Candidates
  insertCandidate({ userId: 'cand-001', name: 'Bob',     email: 'bob@example.com',     mobileNumber: '+1-555-1001', applicationIds: ['app-001', 'app-003'], notificationIds: [] });
  insertCandidate({ userId: 'cand-002', name: 'Diana',   email: 'diana@example.com',   mobileNumber: '+1-555-1002', applicationIds: ['app-002'],            notificationIds: [] });
  insertCandidate({ userId: 'cand-003', name: 'Ethan',   email: 'ethan@example.com',   mobileNumber: '+1-555-1003', applicationIds: ['app-004'],            notificationIds: [] });
  insertCandidate({ userId: 'cand-004', name: 'Fatima',  email: 'fatima@example.com',  mobileNumber: '+1-555-1004', applicationIds: ['app-005'],            notificationIds: [] });

  // Applications
  insertApplication({ applicationId: 'app-001', status: 'applied',            jobId: 'job-001', recruiterId: 'rec-001', candidateId: 'cand-001' });
  insertApplication({ applicationId: 'app-002', status: 'shortlisted',        jobId: 'job-002', recruiterId: 'rec-001', candidateId: 'cand-002' });
  insertApplication({ applicationId: 'app-003', status: 'interview_scheduled',jobId: 'job-003', recruiterId: 'rec-002', candidateId: 'cand-001' });
  insertApplication({ applicationId: 'app-004', status: 'offer_extended',     jobId: 'job-001', recruiterId: 'rec-002', candidateId: 'cand-003' });
  insertApplication({ applicationId: 'app-005', status: 'rejected',           jobId: 'job-002', recruiterId: 'rec-001', candidateId: 'cand-004' });
}
