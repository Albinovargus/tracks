import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { UserProfileSchema, ApiSuccessSchema } from '@tracks/types';
import * as usersService from '../services/users.service.js';

const usersPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get('/users/me', {
    preHandler: [fastify.authenticate],
    schema: {
      response: { 200: ApiSuccessSchema(UserProfileSchema) },
    },
  }, async (request) => {
    const user = await usersService.getById(request.user.id);
    return { success: true as const, data: user };
  });
};

export default usersPlugin;
