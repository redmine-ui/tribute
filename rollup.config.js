import { copyFileSync, existsSync } from 'node:fs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';

const production = !process.env.ROLLUP_WATCH;
export default {
  input: './src/index.ts',
  output: [
    {
      name: 'Tribute',
      file: 'dist/tribute.js',
      format: 'umd',
    },
    {
      name: 'Tribute',
      file: 'dist/tribute.min.js',
      format: 'umd',
      plugins: [terser()],
      sourcemap: true,
    },
    {
      file: 'dist/tribute.mjs',
      format: 'es',
    },
    {
      file: 'dist/tribute.min.mjs',
      format: 'es',
      plugins: [terser()],
      sourcemap: true,
    },
  ],
  plugins: [
    typescript(),
    {
      name: 'copy-files',
      buildEnd() {
        copyFileSync('./src/tribute.css', './dist/tribute.css');
        copyFileSync('./src/tribute.css', './example/tribute.css');
        if (existsSync('./dist/tribute.min.mjs')) {
          copyFileSync('./dist/tribute.min.mjs', './example/tribute.min.mjs');
        }
        if (existsSync('./dist/tribute.min.mjs.map')) {
          copyFileSync('./dist/tribute.min.mjs.map', './example/tribute.min.mjs.map');
        }
      },
    },
    !production && serve({ openPage: '/', contentBase: ['example'] }),
    !production &&
      livereload({
        watch: ['dist', 'example/*.html'],
      }),
  ],
};
