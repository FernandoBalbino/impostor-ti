import { z } from 'zod';
import { CATEGORIES } from '@impostor/shared';
const requestId = z.string().min(8).max(80);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/);
const avatar = z.number().int().min(0).max(23);
const simple = (type: string) => z.object({ type: z.literal(type), requestId }).strict();
export const CommandSchema = z.discriminatedUnion('type', [
  simple('room:create'),
  z
    .object({ type: z.literal('room:join'), code, name: z.string().max(100), avatar, requestId })
    .strict(),
  z
    .object({
      type: z.literal('session:resume'),
      code,
      token: z.string().min(32).max(100),
      requestId,
    })
    .strict(),
  z.object({ type: z.literal('display:join'), code, requestId }).strict(),
  z.object({ type: z.literal('player:ready'), ready: z.boolean(), avatar, requestId }).strict(),
  z
    .object({
      type: z.literal('teacher:settings'),
      settings: z
        .object({
          categories: z
            .array(z.enum(CATEGORIES))
            .min(1)
            .max(5)
            .refine((v) => new Set(v).size === v.length),
          clueSeconds: z.number().int().min(15).max(300),
          allowSpectators: z.boolean(),
          selectionMode: z.enum(['random', 'manual']),
        })
        .strict(),
      manualImpostorId: z.string().max(40).nullable(),
      requestId,
    })
    .strict(),
  z.object({ type: z.literal('teacher:remove'), playerId: z.string().max(40), requestId }).strict(),
  z.object({ type: z.literal('clue:submit'), text: z.string().max(500), requestId }).strict(),
  z.object({ type: z.literal('vote:submit'), targetId: z.string().max(40), requestId }).strict(),
  ...[
    'game:start',
    'clues:close',
    'vote:open',
    'vote:close',
    'round:next',
    'game:end',
    'game:reset',
    'session:leave',
  ].map(simple),
]);
