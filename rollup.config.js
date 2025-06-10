import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';
import * as pkg from './package.json' with { type: 'json' };

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
      banner: `/* Tribute.js v${pkg.default.version} license MIT */`,
      plugins: [
        terser({
          format: {
            comments: (node, comments) => {
              if (comments.value.match(/Tribute\.js .* MIT/)) {
                return comments.value;
              }
            },
          },
        }),
      ],
      sourcemap: true,
    },
    {
      file: 'dist/tribute.mjs',
      format: 'es',
    },
    {
      file: 'dist/tribute.min.mjs',
      format: 'es',
      banner: `/* Tribute.js v${pkg.default.version} license MIT */`,
      plugins: [
        terser({
          format: {
            comments: (node, comments) => {
              if (comments.value.match(/Tribute\.js .* MIT/)) {
                return comments.value;
              }
            },
          },
        }),
      ],
      sourcemap: true,
    },
  ],
  plugins: [
    typescript(),
    copy({
      targets: [
        { src: './src/tribute.css', dest: ['./dist', './example'] },
        { src: ['./dist/tribute.min.mjs', './dist/tribute.min.mjs.map'], dest: './example' },
      ],
      copySync: true,
      hook: 'writeBundle',
    }),
    !production && serve({ openPage: '/', contentBase: ['example'] }),
    !production &&
      livereload({
        watch: ['dist', 'example/*.html'],
      }),
  ],
};
