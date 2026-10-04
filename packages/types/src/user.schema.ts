import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.uuid(),
  display_name: z.string().min(1),
  avatar_url: z.url().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const CreateUserProfileSchema = z.object({
  display_name: z.string().min(1),
  avatar_url: z.url().nullable().optional(),
});
export type CreateUserProfile = z.infer<typeof CreateUserProfileSchema>;

export const UpdateUserProfileSchema = z.object({
  display_name: z.string().min(1).optional(),
  avatar_url: z.url().nullable().optional(),
});
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
