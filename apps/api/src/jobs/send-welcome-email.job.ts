import type { Job } from 'bullmq';
import type { WelcomeEmailJobData } from '@tracks/types';
import { getWelcomeEmailQueue, WELCOME_EMAIL_QUEUE } from './queues.js';
import { sendWelcomeEmail } from '../emails/welcome.email.js';

export async function enqueue(data: WelcomeEmailJobData) {
  await getWelcomeEmailQueue().add(WELCOME_EMAIL_QUEUE, data, {
    jobId: `welcome-${data.userId}`,
  });
}

export async function process(job: Job<WelcomeEmailJobData>) {
  await sendWelcomeEmail(job.data);
}
