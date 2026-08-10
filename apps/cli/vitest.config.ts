import { defineConfig } from 'vitest/config';
import { getAliases } from '@morten-olsen/nova-tests/vitest';

export default defineConfig(async () => {
  const aliases = await getAliases();
  return {
    resolve: {
      alias: aliases,
    },
  };
});
