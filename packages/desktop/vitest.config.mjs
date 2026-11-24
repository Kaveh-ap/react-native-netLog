import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against the workspace source, not a built lib/.
    alias: { 'react-native-netlog': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)) },
  },
});
