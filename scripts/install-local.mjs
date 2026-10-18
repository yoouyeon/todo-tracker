// 빌드 결과(main.js, styles.css, manifest.json)를 vault의 플러그인 폴더에 복사한다.
// 사용법: npm run install-local -- <vault 경로>   (또는 OBSIDIAN_VAULT 환경 변수)
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FILES = ["main.js", "styles.css", "manifest.json"];

const vaultArg = process.argv[2] ?? process.env.OBSIDIAN_VAULT;
if (!vaultArg) {
  console.error("vault 경로가 필요해요. 예: npm run install-local -- ~/Obsidian/my-vault");
  process.exit(1);
}
const vault = resolve(vaultArg.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"));
if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`옵시디언 vault가 아니에요(.obsidian 폴더가 없음): ${vault}`);
  process.exit(1);
}
const missing = FILES.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`빌드 결과가 없어요: ${missing.join(", ")}. 먼저 npm run build를 실행하세요.`);
  process.exit(1);
}

const { id } = JSON.parse(readFileSync("manifest.json", "utf8"));
const dest = join(vault, ".obsidian", "plugins", id);
mkdirSync(dest, { recursive: true });
for (const file of FILES) copyFileSync(file, join(dest, file));
console.log(`복사했어요 → ${dest}\n  ${FILES.join(", ")}`);
