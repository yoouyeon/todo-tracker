import { TFile, type App } from "obsidian";
import type { MonthNoteWriter } from "../data/actions";

/** 월 노트를 `Vault.process()`와 `Vault.create()`로 쓴다. `process`는 읽고 고치고 쓰는 사이에 다른 쓰기가 끼어들지 않게 한다. */
export function createVaultWriter(app: App): MonthNoteWriter {
  return {
    async process(path, fn) {
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return false;
      await app.vault.process(file, fn);
      return true;
    },

    async create(path, content) {
      const slash = path.lastIndexOf("/");
      const folder = slash === -1 ? "" : path.slice(0, slash);
      if (folder !== "" && !app.vault.getAbstractFileByPath(folder)) {
        try {
          await app.vault.createFolder(folder);
        } catch {
          // 그 사이 다른 곳에서 폴더를 만들었으면 그대로 쓴다.
        }
      }
      await app.vault.create(path, content);
    },
  };
}
