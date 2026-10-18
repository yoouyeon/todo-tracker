import { Notice, Plugin, TFile } from "obsidian";
import { TaskActions } from "./data/actions";
import { TaskStore } from "./data/taskStore";
import type { TaskRecord } from "./data/types";
import { createHost } from "./obsidian/host";
import { createVaultWriter } from "./obsidian/vaultWriter";
import { DEFAULT_SETTINGS, TodoTrackerSettingTab, type TodoTrackerSettings } from "./settings/settings";
import { TaskView, VIEW_TYPE } from "./TaskView";
import type { AppHost } from "./ui/host";
import { T } from "./ui/strings";

export default class TodoTrackerPlugin extends Plugin {
  settings: TodoTrackerSettings = { ...DEFAULT_SETTINGS };
  store!: TaskStore;
  host!: AppHost;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.store = new TaskStore(
      {
        listMarkdownFiles: () => this.app.vault.getMarkdownFiles(),
        read: (file) => this.app.vault.read(file as TFile),
      },
      () => this.settings.folder,
    );
    const actions = new TaskActions(createVaultWriter(this.app), () => this.settings.folder);
    this.host = createHost({ app: this.app, store: this.store, actions, openNote: (task) => this.openNote(task) });

    this.registerView(VIEW_TYPE, (leaf) => new TaskView(leaf, this));
    this.addRibbonIcon("list-checks", T.ribbonTitle, () => void this.activateView());
    this.addCommand({ id: "open", name: T.commandOpen, callback: () => void this.activateView() });
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

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 폴더가 바뀌면 새 폴더의 장부를 다시 읽는다.
    await this.store.scan();
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
      new Notice(T.noteMissing);
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }
}
