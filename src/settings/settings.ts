import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type TodoTrackerPlugin from "../main";
import { T } from "../ui/strings";

export interface TodoTrackerSettings {
  /** 월별 할 일 노트가 있는 폴더 */
  folder: string;
}

export const DEFAULT_SETTINGS: TodoTrackerSettings = { folder: "할일" };

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
        name: T.settings.folderName,
        desc: T.settings.folderDesc,
        control: { type: "text", key: "folder", placeholder: T.settings.folderPlaceholder },
      },
    ];
  }

  /** 기본 동작은 저장만 하므로, 폴더가 바뀌면 월 노트를 다시 읽도록 플러그인의 저장을 거친다. */
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "folder" && typeof value === "string") {
      this.plugin.settings.folder = value;
      await this.plugin.saveSettings();
    }
  }
}
