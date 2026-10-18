// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "../../src/data/actions";
import { findOpenDuplicates } from "../../src/logic/selectors";
import { CancelForm, CompleteForm, DateForm, EditForm, NewTaskForm } from "../../src/ui/forms";
import { TODAY, TOMORROW, loaded, taskOf } from "./support";

afterEach(cleanup);

const OK: ActionResult = { ok: true };
const okRun = <A extends unknown[]>() => vi.fn(async (..._args: A): Promise<ActionResult> => OK);
const failRun = <A extends unknown[]>(message: string) => vi.fn(async (..._args: A): Promise<ActionResult> => ({ ok: false, message }));
const button = (name: string) => screen.getByRole("button", { name });

describe("CompleteForm", () => {
  const setup = (run = okRun<[string]>()) => {
    const handlers = { onSuccess: vi.fn(), onCancel: vi.fn(), onOpenNote: vi.fn() };
    render(<CompleteForm task={taskOf("여행 사진 정리")} today={TODAY} run={run} {...handlers} />);
    return { run, ...handlers };
  };

  it("완료한 날의 기본값은 오늘이고 저장하면 그 날짜로 요청한 뒤 닫는다", async () => {
    const { run, onSuccess } = setup();
    expect((screen.getByLabelText("완료한 날") as HTMLInputElement).value).toBe(TODAY);
    fireEvent.click(button("완료로 기록"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(run).toHaveBeenCalledWith(TODAY);
  });

  it("날짜를 바꿔서 저장할 수 있다", async () => {
    const { run, onSuccess } = setup();
    fireEvent.change(screen.getByLabelText("완료한 날"), { target: { value: "2026-10-17" } });
    fireEvent.click(button("완료로 기록"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith("2026-10-17");
  });

  it("저장하기 전에는 아무것도 요청하지 않고, 돌아가기는 요청 없이 닫는다", () => {
    const { run, onCancel, onSuccess } = setup();
    fireEvent.click(button("돌아가기"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("실패하면 닫지 않고 이유를 보여 주며 노트를 열 수 있다", async () => {
    const { onSuccess, onOpenNote } = setup(failRun<[string]>("노트에서 이 항목이 바뀌어서 저장하지 않았어요."));
    fireEvent.click(button("완료로 기록"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("바뀌어서 저장하지 않았어요");
    expect(onSuccess).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "노트에서 열기" }));
    expect(onOpenNote).toHaveBeenCalledTimes(1);
  });

  it("저장하는 동안 연달아 눌러도 한 번만 요청한다", async () => {
    let finish: (result: ActionResult) => void = () => {};
    const run = vi.fn(() => new Promise<ActionResult>((resolve) => (finish = resolve)));
    const { onSuccess } = setup(run);
    const submit = button("완료로 기록") as HTMLButtonElement;
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    expect(run).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(true);
    finish(OK);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("날짜를 지우면 저장할 수 없다", () => {
    setup();
    fireEvent.change(screen.getByLabelText("완료한 날"), { target: { value: "" } });
    expect((button("완료로 기록") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("CancelForm", () => {
  const setup = (run = okRun<[string, string]>()) => {
    const handlers = { onSuccess: vi.fn(), onCancel: vi.fn(), onOpenNote: vi.fn() };
    render(<CancelForm task={taskOf("여행 사진 정리")} today={TODAY} run={run} {...handlers} />);
    return { run, ...handlers };
  };

  it("이유를 입력하기 전에는 저장할 수 없다", () => {
    setup();
    expect((button("취소로 기록") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("이유"), { target: { value: "   " } });
    expect((button("취소로 기록") as HTMLButtonElement).disabled).toBe(true);
  });

  it("취소한 날의 기본값은 오늘이고 날짜와 이유로 요청한다", async () => {
    const { run, onSuccess } = setup();
    expect((screen.getByLabelText("취소한 날") as HTMLInputElement).value).toBe(TODAY);
    fireEvent.change(screen.getByLabelText("이유"), { target: { value: "더는 필요 없음" } });
    fireEvent.click(button("취소로 기록"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith(TODAY, "더는 필요 없음");
  });

  it("실패하면 이유를 보여 주고 닫지 않는다", async () => {
    const { onSuccess } = setup(failRun<[string, string]>("저장하지 못했어요: 디스크가 가득 찼어요"));
    fireEvent.change(screen.getByLabelText("이유"), { target: { value: "필요 없음" } });
    fireEvent.click(button("취소로 기록"));
    expect((await screen.findByRole("alert")).textContent).toContain("디스크가 가득 찼어요");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("DateForm", () => {
  const setup = (title: string, run = okRun<[string]>()) => {
    const handlers = { onSuccess: vi.fn(), onCancel: vi.fn(), onOpenNote: vi.fn() };
    render(<DateForm task={taskOf(title)} today={TODAY} run={run} {...handlers} />);
    return { run, ...handlers };
  };

  it("오늘·내일 버튼을 누르면 바로 그 날짜로 요청한다", async () => {
    const { run, onSuccess } = setup("여행 사진 정리");
    fireEvent.click(button("내일 10/19"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith(TOMORROW);
  });

  it("이미 계획한 날짜는 누를 수 없다", () => {
    setup("보고서 초안 제출"); // 계획 날짜 10/14, 10/18
    expect((button("오늘 10/18") as HTMLButtonElement).disabled).toBe(true);
    expect((button("내일 10/19") as HTMLButtonElement).disabled).toBe(false);
  });

  it("현재 계획 날짜보다 앞선 날짜는 누를 수 없다", () => {
    setup("부모님 선물 주문"); // 현재 계획 날짜 10/22
    expect((button("오늘 10/18") as HTMLButtonElement).disabled).toBe(true);
    expect((button("내일 10/19") as HTMLButtonElement).disabled).toBe(true);
  });

  it("다른 날짜의 기본값과 가장 이른 날짜를 현재 계획 날짜 뒤로 맞춘다", () => {
    setup("부모님 선물 주문");
    const input = screen.getByLabelText("다른 날짜") as HTMLInputElement;
    expect(input.min).toBe("2026-10-23");
    expect(input.value).toBe("2026-10-23");
  });

  it("다른 날짜를 골라 저장한다", async () => {
    const { run, onSuccess } = setup("여행 사진 정리");
    expect((screen.getByLabelText("다른 날짜") as HTMLInputElement).value).toBe("2026-10-20");
    fireEvent.change(screen.getByLabelText("다른 날짜"), { target: { value: "2026-10-25" } });
    fireEvent.click(button("추가"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith("2026-10-25");
  });

  it("기존 날짜를 그대로 둔다고 알려 준다", () => {
    setup("보고서 초안 제출");
    expect(screen.getByText(/기존 날짜 10\/14, 10\/18는 그대로 두고/)).toBeTruthy();
  });

  it("규칙에 어긋나서 실패하면 이유를 보여 주고 닫지 않는다", async () => {
    const { onSuccess } = setup("여행 사진 정리", failRun<[string]>("현재 계획 날짜(10/12)보다 뒤의 날짜만 추가할 수 있어요."));
    fireEvent.click(button("추가"));
    expect((await screen.findByRole("alert")).textContent).toContain("10/12");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("EditForm", () => {
  const task = taskOf("여행 사진 정리");
  const setup = (run = okRun<[import("../../src/data/editLedger").TaskPatch]>()) => {
    const handlers = { onSuccess: vi.fn(), onCancel: vi.fn(), onOpenNote: vi.fn() };
    render(<EditForm task={task} categories={["개인", "공부", "생활"]} run={run} {...handlers} />);
    return { run, ...handlers };
  };

  it("지금 값을 채워서 보여 주고, 다른 이름은 읽기 전용이라고 알린다", () => {
    setup();
    expect((screen.getByLabelText("분류") as HTMLInputElement).value).toBe(task.category);
    expect((screen.getByLabelText("메모") as HTMLInputElement).value).toBe(task.memo);
    expect((screen.getByLabelText("외부 마감일") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/다른 이름\(.+\)은 플러그인에서 고치지 않아요/)).toBeTruthy();
  });

  it("분류 제안 목록을 보여 준다", () => {
    setup();
    const options = [...document.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"));
    expect(options).toEqual(["개인", "공부", "생활"]);
  });

  it("고치지 않고 저장하면 지금 값 그대로 요청한다", async () => {
    const { run, onSuccess } = setup();
    fireEvent.click(button("저장"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith({ deadline: null, category: task.category, memo: task.memo });
  });

  it("마감 날짜와 시각과 분류와 메모를 바꿔서 저장한다", async () => {
    const { run, onSuccess } = setup();
    fireEvent.change(screen.getByLabelText("외부 마감일"), { target: { value: "2026-10-30" } });
    fireEvent.change(screen.getByLabelText("마감 시각 (선택)"), { target: { value: "17:30" } });
    fireEvent.change(screen.getByLabelText("분류"), { target: { value: "공부" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "다시 정함" } });
    fireEvent.click(button("저장"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith({ deadline: { date: "2026-10-30", time: "17:30" }, category: "공부", memo: "다시 정함" });
  });

  it("마감 날짜만 입력하면 시각은 없는 마감일이 된다", async () => {
    const { run, onSuccess } = setup();
    fireEvent.change(screen.getByLabelText("외부 마감일"), { target: { value: "2026-10-30" } });
    fireEvent.click(button("저장"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ deadline: { date: "2026-10-30", time: null } }));
  });

  it("마감 시각만 입력하면 요청하지 않고 알린다", async () => {
    const { run, onSuccess } = setup();
    fireEvent.change(screen.getByLabelText("마감 시각 (선택)"), { target: { value: "17:30" } });
    fireEvent.click(button("저장"));
    expect((await screen.findByRole("alert")).textContent).toContain("마감 날짜를 함께 입력");
    expect(run).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("NewTaskForm", () => {
  const setup = (overrides: { onCreate?: ReturnType<typeof okRun<[import("../../src/data/editLedger").NewTaskInput]>> } = {}) => {
    const onCreate = overrides.onCreate ?? okRun<[import("../../src/data/editLedger").NewTaskInput]>();
    const onAddDate = okRun<[import("../../src/data/types").TaskRecord, string]>();
    const onSuccess = vi.fn();
    const onCancel = vi.fn();
    render(
      <NewTaskForm
        defaultDate={TODAY}
        categories={["개인", "공부"]}
        findDuplicates={(title) => findOpenDuplicates(loaded.ledgers, title)}
        onCreate={onCreate}
        onAddDate={onAddDate}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );
    return { onCreate, onAddDate, onSuccess, onCancel };
  };
  const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => fireEvent.click(button("추가"));

  it("제목을 입력하기 전에는 저장할 수 없다", () => {
    setup();
    expect((button("추가") as HTMLButtonElement).disabled).toBe(true);
    type("제목", "   ");
    expect((button("추가") as HTMLButtonElement).disabled).toBe(true);
    type("제목", "새 일");
    expect((button("추가") as HTMLButtonElement).disabled).toBe(false);
  });

  it("처음 하기로 한 날의 기본값을 받는다", () => {
    setup();
    expect((screen.getByLabelText("처음 하기로 한 날") as HTMLInputElement).value).toBe(TODAY);
  });

  it("같은 제목이 없으면 입력한 값으로 바로 만들고 닫는다", async () => {
    const { onCreate, onAddDate, onSuccess } = setup();
    type("제목", "완전히 새로운 일");
    type("분류", "공부");
    type("메모", "첫 메모");
    type("외부 마감일", "2026-10-30");
    type("마감 시각 (선택)", "09:00");
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onCreate).toHaveBeenCalledWith({
      title: "완전히 새로운 일",
      date: TODAY,
      category: "공부",
      memo: "첫 메모",
      deadline: { date: "2026-10-30", time: "09:00" },
    });
    expect(onAddDate).not.toHaveBeenCalled();
  });

  it("마감 시각만 입력하면 요청하지 않고 알린다", async () => {
    const { onCreate } = setup();
    type("제목", "새 일");
    type("마감 시각 (선택)", "09:00");
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain("마감 날짜를 함께 입력");
    expect(onCreate).not.toHaveBeenCalled();
  });

  describe("같은 제목의 진행 중 항목이 있을 때", () => {
    const askAboutDuplicate = async () => {
      const handlers = setup();
      type("제목", "알고리즘 2문제");
      submit();
      await screen.findByText(/진행 중인 같은 제목이 이미 있어요: 알고리즘 2문제/);
      return handlers;
    };

    it("자동으로 합치거나 만들지 않고 먼저 고르게 한다", async () => {
      const { onCreate, onAddDate, onSuccess } = await askAboutDuplicate();
      expect(onCreate).not.toHaveBeenCalled();
      expect(onAddDate).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(2);
      expect(screen.getByText(/기존 항목에 10\/18 추가 \(할일\/2026-10\.md · 처음 10\/17\)/)).toBeTruthy();
      expect(screen.getByText("새 항목으로 만들기 (2026-10.md)")).toBeTruthy();
    });

    it("고르지 않고 다시 저장하면 어느 쪽도 하지 않고 고르라고 알린다", async () => {
      const { onCreate, onAddDate } = await askAboutDuplicate();
      submit();
      expect((await screen.findByRole("alert")).textContent).toContain("골라 주세요");
      expect(onCreate).not.toHaveBeenCalled();
      expect(onAddDate).not.toHaveBeenCalled();
    });

    it("기존 항목을 고르면 그 항목에 입력한 날짜를 더한다", async () => {
      const { onCreate, onAddDate, onSuccess } = await askAboutDuplicate();
      fireEvent.click(screen.getAllByRole("radio")[0] as HTMLElement);
      submit();
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(onAddDate).toHaveBeenCalledWith(expect.objectContaining({ title: "알고리즘 2문제", status: "open" }), TODAY);
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("새 항목으로 만들기를 고르면 새로 만든다", async () => {
      const { onCreate, onAddDate, onSuccess } = await askAboutDuplicate();
      fireEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);
      submit();
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "알고리즘 2문제", date: TODAY }));
      expect(onAddDate).not.toHaveBeenCalled();
    });

    it("제목을 바꾸면 고르던 것을 처음부터 다시 확인한다", async () => {
      const { onCreate } = await askAboutDuplicate();
      fireEvent.click(screen.getAllByRole("radio")[0] as HTMLElement);
      type("제목", "알고리즘 3문제");
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      submit();
      await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "알고리즘 3문제" })));
    });

    it("끝난 항목과 같은 제목은 묻지 않는다", async () => {
      const { onCreate, onSuccess } = setup();
      type("제목", "아침 스트레칭"); // 이미 끝난 항목
      submit();
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(onCreate).toHaveBeenCalledTimes(1);
    });
  });

  it("저장에 실패하면 이유를 보여 주고 입력을 남긴 채 닫지 않는다", async () => {
    const onCreate = failRun<[import("../../src/data/editLedger").NewTaskInput]>("노트를 만들지 못했어요: 폴더를 만들 수 없음");
    const { onSuccess } = setup({ onCreate });
    type("제목", "새 일");
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain("폴더를 만들 수 없음");
    expect(onSuccess).not.toHaveBeenCalled();
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("새 일");
  });
});
