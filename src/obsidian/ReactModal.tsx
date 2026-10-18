import { Modal, type App } from "obsidian";
import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/** 옵시디언 `Modal` 안에 React 화면을 그린다. `render`가 받는 `close`로 입력창을 닫는다. */
export class ReactModal extends Modal {
  private root: Root | null = null;

  constructor(
    app: App,
    private readonly heading: string,
    private readonly render: (close: () => void) => ReactNode,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.heading);
    this.root = createRoot(this.contentEl);
    this.root.render(<StrictMode>{this.render(() => this.close())}</StrictMode>);
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}
