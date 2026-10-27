import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type { NoteLanguage } from "../data/monthNoteSyntax";
import type TodoTrackerPlugin from "../main";
import { t } from "../i18n";

export interface TodoTrackerSettings {
  /** 월별 할 일 노트가 있는 폴더 */
  folder: string;
  /** 새로 쓰는 필드 이름과 frontmatter 키의 언어 */
  noteLanguage: NoteLanguage;
}

export const DEFAULT_FOLDER: Record<NoteLanguage, string> = { ko: "할일", en: "Todos" };

export const DEFAULT_SETTINGS: TodoTrackerSettings = { folder: DEFAULT_FOLDER.ko, noteLanguage: "ko" };

export const languageName = (lang: NoteLanguage) => (lang === "ko" ? t("settings.languageKo") : t("settings.languageEn"));

const isNoteLanguage = (value: unknown): value is NoteLanguage => value === "ko" || value === "en";

/**
 * 저장된 설정을 읽는다. 값이 없으면 Obsidian 언어가 한국어일 때만 한국어 노트를 기본으로 한다.
 * 폴더만 저장된 설정은 노트 언어 설정이 생기기 전(0.1.x)에 만든 것이라 한국어 노트로 본다.
 */
export function readSettings(data: unknown, uiLanguage: string): TodoTrackerSettings {
  const saved = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const hasFolder = typeof saved.folder === "string";
  const noteLanguage = isNoteLanguage(saved.noteLanguage) ? saved.noteLanguage : hasFolder || uiLanguage === "ko" ? "ko" : "en";
  return { folder: typeof saved.folder === "string" ? saved.folder : DEFAULT_FOLDER[noteLanguage], noteLanguage };
}

export class TodoTrackerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TodoTrackerPlugin,
  ) {
    super(app, plugin);
  }

  /** 옵시디언이 그리고 설정 검색에도 넣는다. 값은 `plugin.settings`에서 읽는다. */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: t("settings.folderName"),
        desc: t("settings.folderDesc"),
        control: { type: "text", key: "folder", placeholder: DEFAULT_FOLDER[this.plugin.settings.noteLanguage] },
      },
      {
        name: t("settings.languageName"),
        desc: t("settings.languageDesc"),
        control: { type: "dropdown", key: "noteLanguage", options: { ko: t("settings.languageKo"), en: t("settings.languageEn") } },
      },
      {
        name: t("settings.convertName"),
        desc: t("settings.convertDesc", { language: languageName(this.plugin.settings.noteLanguage) }),
        action: () => void this.plugin.convertNotes(),
      },
    ];
  }

  /** 기본 동작은 저장만 하므로, 폴더가 바뀌면 월 노트를 다시 읽도록 플러그인의 저장을 거친다. */
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "folder" && typeof value === "string") {
      this.plugin.settings.folder = value;
      await this.plugin.saveSettings();
    } else if (key === "noteLanguage" && isNoteLanguage(value)) {
      this.plugin.settings.noteLanguage = value;
      await this.plugin.saveSettings();
      // 아래 '필드 이름 바꾸기' 설명에 적힌 언어를 새로 그린다.
      this.update();
    }
  }
}
