import { ButtonComponent, Modal, type App } from "obsidian";

/** 되돌리기 어려운 작업 전에 묻는다. 확인을 누르면 true, 닫거나 취소하면 false */
export function confirm(app: App, options: { title: string; message: string; submit: string; cancel: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const modal = new (class extends Modal {
      onOpen(): void {
        this.setTitle(options.title);
        this.contentEl.createEl("p", { text: options.message });
        const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
        new ButtonComponent(buttons).setButtonText(options.cancel).onClick(() => this.close());
        new ButtonComponent(buttons)
          .setButtonText(options.submit)
          .setCta()
          .onClick(() => {
            answered = true;
            this.close();
          });
      }

      onClose(): void {
        this.contentEl.empty();
        resolve(answered);
      }
    })(app);
    modal.open();
  });
}
