import { z } from 'zod';
import { NOTE_CONTENT_FORMATS } from '@/constants/note-content';
import { NOTE_THEME_IDS } from '@/constants/note-themes';

export const noteInputSchema = z.object({
  title: z.string().trim().max(140).default(''),
  body: z.string().max(200_000).default(''),
  contentHtml: z.string().max(500_000).nullable().default(null),
  contentJson: z.string().max(1_000_000).nullable().default(null),
  contentFormat: z.enum(NOTE_CONTENT_FORMATS).default('plain-text'),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  themeId: z.enum(NOTE_THEME_IDS).default('default'),
});

export const notePatchSchema = z.object({
  title: z.string().trim().max(140).optional(),
  body: z.string().max(200_000).optional(),
  contentHtml: z.string().max(500_000).nullable().optional(),
  contentJson: z.string().max(1_000_000).nullable().optional(),
  contentFormat: z.enum(NOTE_CONTENT_FORMATS).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  themeId: z.enum(NOTE_THEME_IDS).optional(),
  isFavorite: z.boolean().optional(),
});

export const vaultPasswordSchema = z
  .string()
  .trim()
  .min(8, 'Use at least 8 characters for the vault passphrase.')
  .max(256, 'Passphrase is too long.');

const textAttachmentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(24_000),
  sourceId: z.string().trim().min(1).max(180).optional(),
});

const imageAttachmentSchema = z.object({
  type: z.literal('image'),
  title: z.string().trim().min(1).max(180),
  uri: z.string().trim().min(1).max(2048),
  mimeType: z
    .string()
    .trim()
    .regex(/^image\//i)
    .max(80),
});

export const chatMessageSchema = z.object({
  threadId: z.string().min(1).optional(),
  content: z.string().trim().min(1, 'Message cannot be empty.').max(12_000),
  useRag: z.boolean().default(true),
  selectedModelId: z.string().min(1).nullable().optional(),
  chatModelDisabled: z.boolean().optional(),
  attachments: z
    .array(
      z.discriminatedUnion('type', [
        textAttachmentSchema.extend({ type: z.literal('note') }),
        textAttachmentSchema.extend({ type: z.literal('library') }),
        textAttachmentSchema.extend({ type: z.literal('document') }),
        imageAttachmentSchema,
      ])
    )
    .max(6)
    .optional(),
});

export const contentPackIdSchema = z.string().trim().min(1).max(160);

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? 'Invalid input.');
}
