import terser from "@rollup/plugin-terser";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";
import { copy } from '@web/rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;
export default {
  input: "src/index.js",
  output: [
    {
      name: 'Tribute',
      file: 'dist/tribute.js',
      format: "umd"
    },
    {
      name: 'Tribute',
      file: "dist/tribute.min.js",
      format: "umd",
      plugins: [terser()],
      sourcemap: true
    },
    {
      file: 'dist/tribute.mjs',
      format: "es"
    },
    {
      file: 'example/tribute.mjs',
      format: "es"
    },
    {
      file: "dist/tribute.min.mjs",
      format: "es",
      plugins: [terser()],
      sourcemap: true
    }
  ],
  plugins: [
    copy({rootDir: 'src', patterns: '**/*.css'}),
    !production && serve({ openPage: "/", contentBase: ["example"] }),
    !production &&
    livereload({
      watch: ["dist", "example/*.html"]
    })
  ]
};
