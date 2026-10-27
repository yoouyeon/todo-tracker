import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../src/i18n/en.json";
import ko from "../../src/i18n/ko.json";

type Tree = { [key: string]: string | Tree };

const PLURAL = /_(zero|one|two|few|many|other)$/;

/** 키마다 문구 안의 변수 이름. 복수형 접미사는 떼고 합친다. */
function flatten(tree: Tree, prefix = "", out = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value !== "string") {
      flatten(value, path, out);
      continue;
    }
    const base = path.replace(PLURAL, "");
    const vars = out.get(base) ?? new Set<string>();
    for (const m of value.matchAll(/\{\{(\w+)\}\}/g)) if (m[1]) vars.add(m[1]);
    out.set(base, vars);
  }
  return out;
}

const sorted = (vars: Set<string> | undefined) => [...(vars ?? [])].sort();

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

describe("문구 파일", () => {
  const base = flatten(ko as Tree);

  it("영어 문구가 한국어 문구와 같은 키와 변수를 쓴다", () => {
    const other = flatten(en as Tree);
    expect([...other.keys()].sort()).toEqual([...base.keys()].sort());
    for (const [key, vars] of base) expect({ key, vars: sorted(other.get(key)) }).toEqual({ key, vars: sorted(vars) });
  });

  it("코드의 t() 호출이 문구의 변수를 모두 넘긴다", () => {
    const calls = sourceFiles("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\bt\("([\w.]+)"(?:, \{ ([^}]*) \})?\)/g)].map((m) => ({ file, key: m[1] ?? "", args: m[2] ?? "" })),
    );
    expect(calls.length).toBeGreaterThan(100);
    for (const { file, key, args } of calls) {
      const names = args === "" ? [] : args.split(",").map((arg) => arg.split(":")[0]?.trim() ?? "");
      expect({ file, key, known: base.has(key) }).toEqual({ file, key, known: true });
      expect({ file, key, names: names.sort() }).toEqual({ file, key, names: sorted(base.get(key)) });
    }
  });
});
