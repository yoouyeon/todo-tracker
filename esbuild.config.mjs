import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";

const shared = {
  bundle: true,
  logLevel: "info",
  minify: prod,
};

// src/main.ts → main.js
const js = await esbuild.context({
  ...shared,
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  format: "cjs",
  target: "es2020",
  platform: "browser",
  jsx: "automatic",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  define: { "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development") },
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
});

// src/styles/index.css(@import로 영역별 CSS를 모음) → styles.css
const css = await esbuild.context({
  ...shared,
  entryPoints: ["src/styles/index.css"],
  outfile: "styles.css",
});

if (prod) {
  await js.rebuild();
  await css.rebuild();
  process.exit(0);
} else {
  await js.watch();
  await css.watch();
}
