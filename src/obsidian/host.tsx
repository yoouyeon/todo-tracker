import { Menu, Notice, type App } from "obsidian";
import type { ReactNode } from "react";
import type { ActionResult, TaskActions } from "../data/actions";
import { plannedDateError } from "../data/editMonthNote";
import type { MonthNoteSource } from "../data/taskStore";
import type { TaskRecord } from "../data/types";
import { addDays } from "../logic/dates";
import { formatMonthDay, monthNoteFileName } from "../logic/format";
import { findOpenDuplicates } from "../logic/selectors";
import { CancelForm, CompleteForm, DateForm, EditForm, NewTaskForm } from "../ui/forms";
import type { AppHost } from "../ui/host";
import { T } from "../ui/strings";
import { ReactModal } from "./ReactModal";

interface Deps {
  app: App;
  store: MonthNoteSource;
  actions: TaskActions;
  openNote: (task: TaskRecord) => Promise<void>;
}

/** 화면이 부탁하는 일을 옵시디언의 메뉴, 입력창, 알림과 액션 계층으로 처리한다. */
export function createHost({ app, store, actions, openNote }: Deps): AppHost {
  const open = (task: TaskRecord) => void openNote(task);

  const categories = () => {
    const all = store
      .getSnapshot()
      .monthNotes.flatMap((monthNote) => monthNote.tasks)
      .filter((task) => task.problems.length === 0)
      .map((task) => task.category)
      .filter((category): category is string => category !== null);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, "ko"));
  };

  /** 실패한 이유를 알리고, 노트를 열어 확인할 수 있게 한다. */
  const notifyFailure = (task: TaskRecord, message: string) => {
    const content = createFragment((fragment) => {
      fragment.createDiv({ text: message });
      const button = fragment.createEl("button", { text: T.openNote });
      button.addEventListener("click", () => open(task));
    });
    new Notice(content, 10_000);
  };

  /** 입력창 없이 바로 저장하는 동작. 성공하면 알림을, 실패하면 이유와 노트 열기를 보여 준다. */
  const quick = async (task: TaskRecord, run: () => Promise<ActionResult>, success: string) => {
    const result = await run();
    if (result.ok) new Notice(success);
    else notifyFailure(task, result.message);
  };

  /** 입력창의 저장 요청. 성공하면 알림을 띄우고 결과를 그대로 폼에 돌려준다(실패 이유는 폼이 보여 준다). */
  const notifyOnSuccess = async (run: () => Promise<ActionResult>, success: string): Promise<ActionResult> => {
    const result = await run();
    if (result.ok) new Notice(success);
    return result;
  };

  const showModal = (title: string, render: (close: () => void) => ReactNode) => new ReactModal(app, title, render).open();

  const host: AppHost = {
    openNote: open,

    newTask(defaultDate) {
      showModal(T.form.createTitle, (close) => (
        <NewTaskForm
          defaultDate={defaultDate}
          categories={categories()}
          findDuplicates={(title) => findOpenDuplicates(store.getSnapshot().monthNotes, title)}
          onCreate={(input) => notifyOnSuccess(() => actions.addTask(input), T.notice.created(monthNoteFileName(input.date)))}
          onChangeDate={(task, date) => notifyOnSuccess(() => actions.changeDate(task, date), T.notice.dateChanged(task.title, formatMonthDay(date)))}
          onSuccess={close}
          onCancel={close}
        />
      ));
    },

    complete(task, today) {
      showModal(T.form.completeTitle, (close) => (
        <CompleteForm
          task={task}
          today={today}
          run={(date) => notifyOnSuccess(() => actions.complete(task, date), T.notice.completed(task.title))}
          onSuccess={close}
          onCancel={close}
          onOpenNote={() => open(task)}
        />
      ));
    },

    cancel(task, today) {
      showModal(T.form.cancelTitle, (close) => (
        <CancelForm
          task={task}
          today={today}
          run={(date, reason) => notifyOnSuccess(() => actions.cancel(task, date, reason), T.notice.cancelled(task.title))}
          onSuccess={close}
          onCancel={close}
          onOpenNote={() => open(task)}
        />
      ));
    },

    pickDate(task, today) {
      showModal(T.form.dateTitle, (close) => (
        <DateForm
          task={task}
          today={today}
          run={(date) => notifyOnSuccess(() => actions.changeDate(task, date), T.notice.dateChanged(task.title, formatMonthDay(date)))}
          onSuccess={close}
          onCancel={close}
          onOpenNote={() => open(task)}
        />
      ));
    },

    edit(task) {
      showModal(T.form.editTitle, (close) => (
        <EditForm
          task={task}
          categories={categories()}
          run={(patch) => notifyOnSuccess(() => actions.update(task, patch), T.notice.updated(task.title))}
          onSuccess={close}
          onCancel={close}
          onOpenNote={() => open(task)}
        />
      ));
    },

    showMenu(event, task, today, kind) {
      const menu = new Menu();
      const isOpen = task.status === "open";

      if (isOpen) {
        const days = [
          { title: T.menu.today, date: today, icon: "sun" },
          { title: T.menu.tomorrow, date: addDays(today, 1), icon: "arrow-right" },
        ];
        for (const day of days) {
          menu.addItem((item) =>
            item
              .setTitle(`${day.title} (${formatMonthDay(day.date)})`)
              .setIcon(day.icon)
              // 이미 계획한 날짜와 현재 계획 날짜보다 앞선 날짜는 더할 수 없다.
              .setDisabled(plannedDateError(task, day.date) !== null)
              .onClick(() => void quick(task, () => actions.changeDate(task, day.date), T.notice.dateChanged(task.title, formatMonthDay(day.date)))),
          );
        }
        menu.addItem((item) => item.setTitle(T.menu.pickDate).setIcon("calendar").onClick(() => host.pickDate(task, today)));
      }

      if (kind === "task") {
        if (isOpen) {
          menu.addSeparator();
          menu.addItem((item) => item.setTitle(T.menu.complete).setIcon("check").onClick(() => host.complete(task, today)));
          menu.addItem((item) => item.setTitle(T.menu.edit).setIcon("pencil").onClick(() => host.edit(task)));
        }
        menu.addItem((item) => item.setTitle(T.menu.openNote).setIcon("file-text").onClick(() => open(task)));
        if (isOpen) {
          menu.addSeparator();
          menu.addItem((item) => item.setTitle(T.menu.cancel).setIcon("ban").setWarning(true).onClick(() => host.cancel(task, today)));
        }
      }
      menu.showAtMouseEvent(event);
    },
  };
  return host;
}
