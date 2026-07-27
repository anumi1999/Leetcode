export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type ChannelName = 'email' | 'sms' | 'inapp';

export interface ChannelStatus {
  channel: ChannelName;
  retries: number;
  status: NotificationStatus;
}

export interface Notification {
  notificationId: string;
  candidateId: string;
  jobId: string;
  applicationId: string;
  recruiterId: string;
  notificationDetails: string;
  applicationStatus: string;
  status: NotificationStatus;
  channels: ChannelStatus[];
  dateSent: Date;
  dateModified: Date;
}
