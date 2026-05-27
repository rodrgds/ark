import { z } from 'zod';

export const noteInputSchema = z.object({
  title: z.string().trim().max(140).default(''),
  body: z.string().max(200_000).default(''),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
});

export const notePatchSchema = z.object({
  title: z.string().trim().max(140).optional(),
  body: z.string().max(200_000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  isFavorite: z.boolean().optional(),
});

export const vaultPasswordSchema = z
  .string()
  .trim()
  .min(8, 'Use at least 8 characters for the vault passphrase.')
  .max(256, 'Passphrase is too long.');

export const chatMessageSchema = z.object({
  threadId: z.string().min(1).optional(),
  content: z.string().trim().min(1, 'Message cannot be empty.').max(12_000),
  useRag: z.boolean().default(true),
  selectedModelId: z.string().min(1).nullable().optional(),
  chatModelDisabled: z.boolean().optional(),
});

export const contentPackIdSchema = z.string().trim().min(1).max(160);

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? 'Invalid input.');
}
