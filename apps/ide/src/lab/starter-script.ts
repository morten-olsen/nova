/*
 * The canonical starter bot, imported rather than copied.
 *
 * `nova init` scaffolds this same file into every new factory and the builder
 * manual walks through it, so a second copy here would drift — and the drift
 * would be invisible until someone compared a scaffolded bot against the one the
 * lab seeds.
 *
 * TypeScript, like everything else the lab edits. It is compiled on the way to
 * the sandbox, which is also why it stays a single file with no imports: the lab
 * strips types, and only the CLI bundles.
 */
import starterScript from '@morten-olsen/nova-docs/examples/starter-builder.ts?raw';

export { starterScript };
