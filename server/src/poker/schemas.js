// FILE: server/src/poker/schemas.js
import { z } from 'zod';

export const STARTING_CHIPS_OPTIONS = [500, 1000, 2000];
export const BLIND_LEVEL_OPTIONS = ['5/10', '10/20', '25/50'];
export const TURN_TIMEOUT_OPTIONS = [15, 30, 45];
export const QUICK_EMOTES = ['👍', '😂', '😮', '👏', 'GG', '🔥'];
export const REPORT_REASONS = ['harassment', 'inappropriate', 'spam', 'cheating', 'other'];

export const roomIdSchema = z
  .string({ required_error: 'ID room wajib diisi.' })
  .trim()
  .min(4, 'ID room harus 6 karakter.')
  .max(10, 'ID room tidak valid.')
  .transform((val) => val.toUpperCase());

export const roomCreateSchema = z.object({
  startingChips: z
    .coerce.number()
    .refine((v) => STARTING_CHIPS_OPTIONS.includes(v), {
      message: 'Chip awal harus 500, 1000, atau 2000.',
    })
    .default(1000),
  blindLevel: z.enum(['5/10', '10/20', '25/50']).default('10/20'),
  turnTimeoutSec: z
    .coerce.number()
    .refine((v) => TURN_TIMEOUT_OPTIONS.includes(v), {
      message: 'Timer giliran harus 15, 30, atau 45 detik.',
    })
    .default(30),
});

export const roomJoinSchema = z.object({
  roomId: roomIdSchema,
});

export const roomLeaveSchema = z.object({
  roomId: roomIdSchema.optional(),
});

export const roomReadySchema = z.object({
  roomId: roomIdSchema,
  ready: z.boolean(),
});

export const roomControlSchema = z.object({
  roomId: roomIdSchema,
});

export const roomKickSchema = z.object({
  roomId: roomIdSchema,
  targetUserId: z.coerce.number().int().positive('Target pemain tidak valid.'),
});

export const gameActionSchema = z.object({
  roomId: roomIdSchema,
  handNumber: z.coerce.number().int().nonnegative(),
  turnToken: z.string().trim().min(1, 'Token giliran wajib ada.'),
  action: z.enum(['fold', 'check', 'call', 'bet', 'raise', 'all_in']),
  amount: z.coerce.number().finite().nonnegative().optional(),
});

export const gameSyncSchema = z.object({
  roomId: roomIdSchema,
  lastVersion: z.coerce.number().int().nonnegative().optional(),
});

export const reactionSendSchema = z.object({
  roomId: roomIdSchema,
  emote: z.enum(['👍', '😂', '😮', '👏', 'GG', '🔥']),
});

export const authRefreshSocketSchema = z.object({
  token: z.string().trim().min(10, 'Token tidak valid.'),
});

export const pokerReportHttpSchema = z.object({
  roomId: roomIdSchema,
  reportedUserId: z.coerce.number().int().positive(),
  reason: z.enum(['harassment', 'inappropriate', 'spam', 'cheating', 'other']).default('other'),
  description: z.string().trim().max(500).optional(),
});

export const adminFeatureToggleSchema = z.object({
  enabled: z.boolean(),
});
