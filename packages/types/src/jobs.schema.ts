import { z } from 'zod';

export const WelcomeEmailJobDataSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string(),
});
export type WelcomeEmailJobData = z.infer<typeof WelcomeEmailJobDataSchema>;
