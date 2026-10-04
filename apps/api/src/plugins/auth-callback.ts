import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { UserProfileSchema, ApiSuccessSchema } from '@tracks/types';
import * as usersService from '../services/users.service.js';
import { enqueue as enqueueWelcomeEmail } from '../jobs/send-welcome-email.job.js';

const authCallbackPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.post('/auth/callback', {
    preHandler: [fastify.authenticate],
    schema: {
      response: { 200: ApiSuccessSchema(UserProfileSchema) },
    },
  }, async (request) => {
    const profile = await usersService.getById(request.user.id);

    // Only send welcome email on first callback (profile just created)
    const createdAt = new Date(profile.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (createdAt > fiveMinutesAgo) {
      await enqueueWelcomeEmail({
        userId: request.user.id,
        email: request.user.email,
        displayName: profile.display_name,
      });
    }

    return { success: true as const, data: profile };
  });
};

export default authCallbackPlugin;
