import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { androidEventSchema, buildingTypeSchema, directionSchema } from '@morten-olsen/nova-game';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * The editor's ambient declarations are hand-written, because generating a
 * readable `.d.ts` from Zod costs more than it returns at this size. The
 * trade-off is drift — an action added to the engine that the editor never
 * offers — so the two are compared here instead.
 *
 * This caught an invented `refinery` building type and a missing
 * `android.salvage` on the first run.
 */
const declarations = await readFile(
  fileURLToPath(new URL('../src/editor/android-globals.d.txt', import.meta.url)),
  'utf8',
);

const literalsOf = (schema: z.ZodType): string[] =>
  (schema as unknown as { options: { shape: { type: { value: string } } }[] }).options.map(
    (option) => option.shape.type.value,
  );

describe('editor ambient declarations', () => {
  it('offers every action the engine accepts', () => {
    for (const action of literalsOf(androidEventSchema)) {
      expect(declarations, `missing action ${action}`).toContain(`'${action}'`);
    }
  });

  it('offers no action the engine would reject', () => {
    const known = new Set(literalsOf(androidEventSchema));
    const declared = [...declarations.matchAll(/'(android\.[a-z-]+)'/g)].map((match) => match[1]);
    expect(declared.length).toBeGreaterThan(0);
    for (const action of declared) {
      expect(known, `declares unknown action ${action}`).toContain(action);
    }
  });

  it('lists every building type and direction', () => {
    for (const building of buildingTypeSchema.options) {
      expect(declarations, `missing building type ${building}`).toContain(`'${building}'`);
    }
    for (const direction of directionSchema.options) {
      expect(declarations, `missing direction ${direction}`).toContain(`'${direction}'`);
    }
  });
});
