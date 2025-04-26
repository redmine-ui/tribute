import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: ['test/spec/test.ts'],
  plugins: [esbuildPlugin({ ts: true })],
};
