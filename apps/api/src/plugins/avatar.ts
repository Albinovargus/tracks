import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  ApiErrorSchema,
  ApiSuccessSchema,
  AvatarAppearanceSchema,
  AvatarSchema,
} from '@tracks/types';
import * as avatarService from '../services/avatar.service.js';

const avatarPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get('/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      response: { 200: ApiSuccessSchema(AvatarSchema.nullable()) },
    },
  }, async (request) => {
    // A user with no avatar yet gets 200 with null data, not a 404: browsers
    // log every non-2xx response as a console error, and every new user hits this.
    const avatar = await avatarService.getByUserId(request.user.id);
    return { success: true as const, data: avatar };
  });

  // The body schema strips unknown keys, so a user_id sent by the client never
  // reaches the service. The owner always comes from the verified token.
  fastify.put('/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      body: AvatarAppearanceSchema,
      response: { 200: ApiSuccessSchema(AvatarSchema), 400: ApiErrorSchema },
    },
  }, async (request) => {
    const avatar = await avatarService.upsertForUser(request.user.id, request.body);
    return { success: true as const, data: avatar };
  });
};

export default avatarPlugin;
