import { z } from 'zod';
import { CATEGORIES, POWER_IDS, PROTOCOL_VERSION } from '@impostor/shared';
const requestId = z.string().min(8).max(80);
const base = { requestId, protocolVersion: z.literal(PROTOCOL_VERSION) };
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/);
const avatar = z.number().int().min(0).max(23);
const simple = (type: string) => z.object({ type: z.literal(type), ...base }).strict();
export const CommandSchema = z.discriminatedUnion('type', [
  simple('room:create'),
  z
    .object({ type: z.literal('room:join'), code, name: z.string().max(100), avatar, ...base })
    .strict(),
  z
    .object({
      type: z.literal('session:resume'),
      code,
      token: z.string().min(32).max(100),
      ...base,
    })
    .strict(),
  z.object({ type: z.literal('display:join'), code, ...base }).strict(),
  z.object({ type: z.literal('player:ready'), ready: z.boolean(), avatar, ...base }).strict(),
  z
    .object({
      type: z.literal('player:powers'),
      powers: z
        .array(z.enum(POWER_IDS))
        .max(2)
        .refine((v) => new Set(v).size === v.length),
      ...base,
    })
    .strict(),
  z
    .object({
      type: z.literal('power:activate'),
      powerId: z.enum(POWER_IDS),
      targetId: z.string().min(1).max(40).optional(),
      text: z.string().max(500).optional(),
      ...base,
    })
    .strict(),
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
          impostorCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        })
        .strict(),
      manualImpostorIds: z
        .array(z.string().min(1).max(40))
        .max(3)
        .refine((v) => new Set(v).size === v.length),
      ...base,
    })
    .strict(),
  z.object({ type: z.literal('teacher:remove'), playerId: z.string().max(40), ...base }).strict(),
  z.object({ type: z.literal('clue:submit'), text: z.string().max(500), ...base }).strict(),
  z.object({ type: z.literal('vote:submit'), targetId: z.string().max(40), ...base }).strict(),
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
