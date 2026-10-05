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
      response: { 200: ApiSuccessSchema(AvatarSchema), 404: ApiErrorSchema },
    },
  }, async (request, reply) => {
    const avatar = await avatarService.getByUserId(request.user.id);
    if (!avatar) {
      return reply.code(404).send({
        success: false,
        error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
      });
    }
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
