import { z } from 'zod';

const positionSchema = z.object({
  x: z.int().min(0),
  y: z.int().min(0),
});

type Position = z.infer<typeof positionSchema>;

const directionSchema = z.enum(['north', 'south', 'east', 'west']);

type Direction = z.infer<typeof directionSchema>;

const idSchema = z.string();

type Id = z.infer<typeof idSchema>;

export type { Position, Direction, Id };
export { positionSchema, directionSchema, idSchema };
