import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ApiSuccessSchema } from '@tracks/types';

const HealthDataSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

const healthPlugin: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get('/health', {
    schema: {
      response: { 200: ApiSuccessSchema(HealthDataSchema) },
    },
  }, async () => {
    return {
      success: true as const,
      data: { status: 'ok' as const, timestamp: new Date().toISOString() },
    };
  });
};

export default healthPlugin;
