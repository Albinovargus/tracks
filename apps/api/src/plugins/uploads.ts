import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ApiSuccessSchema, ApiErrorSchema, UploadResultSchema } from '@tracks/types';
import * as uploadService from '../services/upload.service.js';

const BucketSchema = z.enum(['avatars']).default('avatars');

const uploadsPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.post('/uploads', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: z.object({ bucket: BucketSchema }),
      response: { 200: ApiSuccessSchema(UploadResultSchema), 400: ApiErrorSchema },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No file provided' },
      });
    }
    const { bucket } = request.query;
    const result = await uploadService.upload(data, bucket);
    return { success: true as const, data: result };
  });

  fastify.get('/uploads/:path', {
    preHandler: [fastify.authenticate],
    schema: {
      params: z.object({ path: z.string() }),
      querystring: z.object({ bucket: BucketSchema }),
    },
  }, async (request, reply) => {
    const { path } = request.params;
    const { bucket } = request.query;
    const url = await uploadService.getSignedUrl(path, bucket);
    return reply.redirect(url);
  });
};

export default uploadsPlugin;
