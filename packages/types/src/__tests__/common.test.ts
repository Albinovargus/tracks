import { describe, it, expect } from 'vitest';
import {
  IdSchema,
  SortOrderSchema,
  PaginationParamsSchema,
  TimestampsSchema,
} from '../common.js';

describe('IdSchema', () => {
  it('accepts valid UUID', () => {
    expect(() =>
      IdSchema.parse('550e8400-e29b-41d4-a716-446655440000'),
    ).not.toThrow();
  });

  it('rejects non-UUID string', () => {
    expect(() => IdSchema.parse('not-a-uuid')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => IdSchema.parse('')).toThrow();
  });
});

describe('SortOrderSchema', () => {
  it('accepts asc', () => {
    expect(SortOrderSchema.parse('asc')).toBe('asc');
  });

  it('accepts desc', () => {
    expect(SortOrderSchema.parse('desc')).toBe('desc');
  });

  it('rejects invalid value', () => {
    expect(() => SortOrderSchema.parse('random')).toThrow();
  });
});

describe('PaginationParamsSchema', () => {
  it('applies defaults', () => {
    const result = PaginationParamsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sort_order).toBe('asc');
  });

  it('coerces string numbers', () => {
    const result = PaginationParamsSchema.parse({ page: '2', limit: '50' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('rejects page less than 1', () => {
    expect(() => PaginationParamsSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit greater than 100', () => {
    expect(() => PaginationParamsSchema.parse({ limit: 101 })).toThrow();
  });

  it('accepts optional sort_by', () => {
    const result = PaginationParamsSchema.parse({ sort_by: 'name' });
    expect(result.sort_by).toBe('name');
  });
});

describe('TimestampsSchema', () => {
  it('parses valid timestamps', () => {
    const result = TimestampsSchema.parse({
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    });
    expect(result.created_at).toBe('2024-01-01T00:00:00.000Z');
  });

  it('accepts Postgres timestamptz values with a UTC offset', () => {
    expect(() =>
      TimestampsSchema.parse({
        created_at: '2026-10-04T21:39:39.724427+00:00',
        updated_at: '2026-10-04T21:39:39.724427+00:00',
      }),
    ).not.toThrow();
  });

  it('rejects non-datetime strings', () => {
    expect(() =>
      TimestampsSchema.parse({
        created_at: 'not-a-date',
        updated_at: '2024-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => TimestampsSchema.parse({})).toThrow();
  });
});
