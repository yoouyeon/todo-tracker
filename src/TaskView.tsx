import { ItemView, type WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type TodoTrackerPlugin from "./main";
import { App } from "./ui/App";
import { T } from "./ui/strings";

export const VIEW_TYPE = "todo-tracker-view";

export class TaskView extends ItemView {
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TodoTrackerPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return T.viewName;
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <App store={this.plugin.store} onOpenNote={(task) => void this.plugin.openNote(task)} />
      </StrictMode>,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
