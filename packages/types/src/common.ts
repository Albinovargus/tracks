import { z } from 'zod';

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const SortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrderSchema>;

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: SortOrderSchema.default('asc'),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const TimestampsSchema = z.object({
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type Timestamps = z.infer<typeof TimestampsSchema>;
