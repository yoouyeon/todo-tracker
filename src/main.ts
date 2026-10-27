import { Notice, Plugin, TFile, debounce, getLanguage } from "obsidian";
import { TaskActions } from "./data/actions";
import { convertMonthNote } from "./data/editMonthNote";
import { isMonthNotePath } from "./data/paths";
import { TaskStore } from "./data/taskStore";
import type { TaskRecord } from "./data/types";
import { confirm } from "./obsidian/ConfirmModal";
import { createHost } from "./obsidian/host";
import { createVaultWriter } from "./obsidian/vaultWriter";
import { DEFAULT_SETTINGS, TodoTrackerSettingTab, languageName, readSettings, type TodoTrackerSettings } from "./settings/settings";
import { TaskView, VIEW_TYPE } from "./TaskView";
import type { AppHost } from "./ui/host";
import { t, setUiLanguage } from "./i18n";

export default class TodoTrackerPlugin extends Plugin {
  settings: TodoTrackerSettings = { ...DEFAULT_SETTINGS };
  store!: TaskStore;
  host!: AppHost;

  async onload(): Promise<void> {
    // 문구를 쓰는 다른 코드보다 먼저 언어를 정한다.
    setUiLanguage(getLanguage());
    await this.loadSettings();

    this.store = new TaskStore(
      {
        listFolderFiles: (folder) => {
          const dir = folder === "" ? this.app.vault.getRoot() : this.app.vault.getFolderByPath(folder);
          return dir ? dir.children.filter((file): file is TFile => file instanceof TFile) : [];
        },
        read: (file) => {
          if (!(file instanceof TFile)) return Promise.reject(new Error(`파일이 아님: ${file.path}`));
          return this.app.vault.read(file);
        },
      },
      () => this.settings.folder,
      () => this.settings.noteLanguage,
    );
    const actions = new TaskActions(
      createVaultWriter(this.app),
      () => this.settings.folder,
      () => this.settings.noteLanguage,
    );
    this.host = createHost({ app: this.app, store: this.store, actions, openNote: (task) => this.openNote(task) });

    this.registerView(VIEW_TYPE, (leaf) => new TaskView(leaf, this));
    this.addRibbonIcon("list-checks", t("ribbonTitle"), () => void this.activateView());
    this.addCommand({ id: "open", name: t("commandOpen"), callback: () => void this.activateView() });
    this.addCommand({ id: "convert-notes", name: t("commandConvert"), callback: () => void this.convertNotes() });
    this.addSettingTab(new TodoTrackerSettingTab(this.app, this));

    // 시작할 때는 이미 있는 모든 파일에 create 이벤트가 오므로, 레이아웃이 준비되면 한 번 훑고 그 뒤부터 구독한다.
    this.app.workspace.onLayoutReady(async () => {
      await this.store.scan();
      const vault = this.app.vault;
      this.registerEvent(vault.on("create", (file) => file instanceof TFile && void this.store.refresh(file)));
      this.registerEvent(vault.on("modify", (file) => file instanceof TFile && void this.store.refresh(file)));
      this.registerEvent(vault.on("delete", (file) => this.store.remove(file.path)));
      this.registerEvent(vault.on("rename", (file, oldPath) => file instanceof TFile && void this.store.rename(file, oldPath)));
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = readSettings(await this.loadData(), getLanguage());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 폴더가 바뀌면 새 폴더의 월 노트를 다시 읽는다. 폴더 이름을 입력하는 동안에는 매번 훑지 않고 입력이 멈춘 뒤 한 번만 훑는다.
    this.rescan();
  }

  private readonly rescan = debounce(() => void this.store.scan(), 500, true);

  /** 할 일 폴더의 월 노트에서 필드 이름과 frontmatter 키를 설정한 노트 언어로 바꾼다. 바꿀 노트가 있으면 먼저 묻는다. */
  async convertNotes(): Promise<void> {
    const lang = this.settings.noteLanguage;
    const files = this.app.vault.getMarkdownFiles().filter((file) => isMonthNotePath(file.path, this.settings.folder));
    const targets: TFile[] = [];
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      if (convertMonthNote(content, file.path, lang) !== content) targets.push(file);
    }
    if (targets.length === 0) {
      new Notice(t("convert.nothing"));
      return;
    }

    const language = languageName(lang);
    const ok = await confirm(this.app, {
      title: t("convert.confirmTitle"),
      message: t("convert.confirm", { count: targets.length, language }),
      submit: t("convert.confirmSubmit"),
      cancel: t("convert.cancel"),
    });
    if (!ok) return;

    let changed = 0;
    for (const file of targets) {
      try {
        // 묻는 동안 노트가 바뀌었을 수 있으므로 쓰는 순간의 내용으로 다시 바꾼다.
        await this.app.vault.process(file, (content) => {
          const next = convertMonthNote(content, file.path, lang);
          if (next !== content) changed += 1;
          return next;
        });
      } catch {
        new Notice(t("convert.failed", { path: file.path }));
      }
    }
    new Notice(changed === 0 ? t("convert.nothing") : t("convert.done", { count: changed }));
  }

  /** 이미 열려 있으면 그 탭으로 이동하고, 없으면 새 탭에 연다. */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing ?? workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
  }

  /** 항목이 있는 노트를 새 탭에 열고 그 줄로 이동한다. */
  async openNote(task: TaskRecord): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
    if (!(file instanceof TFile)) {
      new Notice(t("noteMissing"));
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }
}
