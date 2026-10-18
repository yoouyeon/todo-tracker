import { PluginSettingTab, Setting, type App } from "obsidian";
import type TodoTrackerPlugin from "../main";
import { T } from "../ui/strings";

export interface TodoTrackerSettings {
  /** 월별 장부 파일이 있는 폴더 */
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName(T.settings.folderName)
      .setDesc(T.settings.folderDesc)
      .addText((text) =>
        text
          .setPlaceholder(T.settings.folderPlaceholder)
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
