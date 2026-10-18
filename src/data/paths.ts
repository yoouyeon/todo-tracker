import { ledgerMonthOfPath } from "./parseLedger";

/** 설정에 적은 폴더에서 앞뒤 공백과 슬래시를 뺀다. 빈 문자열은 vault 루트다. */
export function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "");
}

/** 설정 폴더 바로 아래의 `YYYY-MM.md`인지. 하위 폴더의 파일과 `AGENTS.md` 같은 파일은 읽지 않는다. */
export function isLedgerPath(path: string, folder: string): boolean {
  const slash = path.lastIndexOf("/");
  const parent = slash === -1 ? "" : path.slice(0, slash);
  return parent === normalizeFolder(folder) && ledgerMonthOfPath(path) !== null;
}
