// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseMonthNote } from "../../src/data/parseMonthNote";
import { App } from "../../src/ui/App";
import type { Tab } from "../../src/ui/StatCards";
import { NOW, TODAY, TOMORROW, createHostStub, createSource, loaded, taskOf } from "./support";

afterEach(cleanup);

function setup(initialTab?: Tab) {
  const host = createHostStub();
  const source = createSource();
  render(<App store={source} host={host} getNow={NOW} initialTab={initialTab} />);
  return { host, source };
}

/** 제목 글자가 들어 있는 항목 한 줄 */
const itemOf = (title: string): HTMLElement => {
  const item = screen.getByText(title).closest<HTMLElement>(".tt-item");
  if (!item) throw new Error(`"${title}" 항목이 없음`);
  return item;
};
const titleButton = (title: string) => within(itemOf(title)).getByRole("button", { name: title });
const stat = (label: string): HTMLElement => {
  const card = screen.getAllByRole("button").find((b) => b.classList.contains("tt-stat") && (b.textContent ?? "").startsWith(label));
  if (!card) throw new Error(`"${label}" 카드가 없음`);
  return card;
};
const sectionTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("머리말과 추가 버튼", () => {
  it("새 할 일 버튼은 오늘 날짜를 기본값으로 입력창을 연다", () => {
    const { host } = setup();
    fireEvent.click(screen.getByRole("button", { name: "새 할 일" }));
    expect(host.newTask).toHaveBeenCalledWith(TODAY);
  });

  it("오늘 머리글의 추가 버튼은 오늘, 예정 머리글의 추가 버튼은 내일을 기본값으로 한다", () => {
    const { host } = setup();
    fireEvent.click(screen.getByRole("button", { name: "오늘에 추가" }));
    expect(host.newTask).toHaveBeenLastCalledWith(TODAY);
    fireEvent.click(screen.getByRole("button", { name: "예정에 추가" }));
    expect(host.newTask).toHaveBeenLastCalledWith(TOMORROW);
  });
});

describe("체크박스와 행 버튼", () => {
  it("체크박스를 누르면 그 항목의 완료 입력창을 오늘 날짜와 함께 연다", () => {
    const { host } = setup();
    fireEvent.click(screen.getByRole("button", { name: "완료로 기록: 겨울옷 꺼내기" }));
    expect(host.complete).toHaveBeenCalledTimes(1);
    expect(host.complete).toHaveBeenCalledWith(expect.objectContaining({ title: "겨울옷 꺼내기", sourcePath: "할일/2026-09.md" }), TODAY);
  });

  it("체크박스는 Enter와 Space로도 누를 수 있다", () => {
    const { host } = setup();
    const check = screen.getByRole("button", { name: "완료로 기록: 여행 사진 정리" });
    fireEvent.keyDown(check, { key: "Enter" });
    fireEvent.keyDown(check, { key: " " });
    fireEvent.keyDown(check, { key: "a" });
    expect(host.complete).toHaveBeenCalledTimes(2);
  });

  it("행 버튼의 완료는 완료 입력창을 연다", () => {
    const { host } = setup();
    const pills = itemOf("여행 사진 정리").querySelector<HTMLElement>(".tt-pills");
    fireEvent.click(within(pills as HTMLElement).getByRole("button", { name: "완료" }));
    expect(host.complete).toHaveBeenCalledWith(taskOf("여행 사진 정리"), TODAY);
  });

  it("행 버튼의 날짜는 날짜 메뉴를, 더 보기는 전체 메뉴를 연다", () => {
    const { host } = setup();
    const pills = within(itemOf("여행 사진 정리").querySelector<HTMLElement>(".tt-pills") as HTMLElement);
    fireEvent.click(pills.getByRole("button", { name: "10/12" }));
    expect(host.showMenu).toHaveBeenLastCalledWith(expect.any(MouseEvent), taskOf("여행 사진 정리"), TODAY, "date");
    fireEvent.click(pills.getByRole("button", { name: "더 보기" }));
    expect(host.showMenu).toHaveBeenLastCalledWith(expect.any(MouseEvent), taskOf("여행 사진 정리"), TODAY, "task");
  });

  it("오른쪽 클릭이나 길게 누르기로 전체 메뉴를 연다", () => {
    const { host } = setup();
    fireEvent.contextMenu(itemOf("여행 사진 정리"));
    expect(host.showMenu).toHaveBeenCalledWith(expect.any(MouseEvent), taskOf("여행 사진 정리"), TODAY, "task");
  });

  it("끝난 항목에는 체크박스와 행 버튼이 없고, 메뉴에서는 노트를 열 수 있게 한다", () => {
    const { host } = setup();
    const done = itemOf("아침 스트레칭");
    expect(within(done).queryByRole("button", { name: /완료로 기록/ })).toBeNull();
    expect(done.querySelector(".tt-pills")).toBeNull();
    fireEvent.contextMenu(done);
    expect(host.showMenu).toHaveBeenCalledWith(expect.any(MouseEvent), expect.objectContaining({ status: "done" }), TODAY, "task");
  });
});

describe("상세 정보", () => {
  it("제목을 누르면 그 자리에서 펼치고 다시 누르면 접는다", () => {
    setup();
    const button = titleButton("여행 사진 정리");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(itemOf("여행 사진 정리").querySelector(".tt-detail")).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const detail = within(itemOf("여행 사진 정리").querySelector<HTMLElement>(".tt-detail") as HTMLElement);
    expect(detail.getByText(/처음 계획부터 9일/)).toBeTruthy();
    expect(detail.getByText("사진 정리")).toBeTruthy();

    fireEvent.click(button);
    expect(itemOf("여행 사진 정리").querySelector(".tt-detail")).toBeNull();
  });

  it("하기로 한 날을 바꾼 항목은 처음 날짜와 지금 날짜를 함께 보여 준다", () => {
    setup();
    fireEvent.click(titleButton("여행 사진 정리"));
    const changed = [...(itemOf("여행 사진 정리").querySelectorAll(".tt-date") ?? [])].map((d) => d.textContent);
    expect(changed).toEqual(["10/9처음", "10/12현재"]);

    fireEvent.click(titleButton("부모님 선물 주문"));
    const unchanged = [...(itemOf("부모님 선물 주문").querySelectorAll(".tt-date") ?? [])].map((d) => d.textContent);
    expect(unchanged).toEqual(["10/22"]);
  });

  it("처음 계획한 날이 아직 오지 않았으면 지난 일수를 보여 주지 않는다", () => {
    setup();
    fireEvent.click(titleButton("부모님 선물 주문"));
    const detail = itemOf("부모님 선물 주문").querySelector<HTMLElement>(".tt-detail") as HTMLElement;
    expect(within(detail).queryByText(/처음 계획부터/)).toBeNull();
  });

  it("Enter와 Space로도 펼친다", () => {
    setup();
    const button = titleButton("여행 사진 정리");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(button, { key: " " });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("한 번에 하나만 펼친다", () => {
    setup();
    fireEvent.click(titleButton("겨울옷 꺼내기"));
    fireEvent.click(titleButton("여행 사진 정리"));
    expect(titleButton("겨울옷 꺼내기").getAttribute("aria-expanded")).toBe("false");
    expect(titleButton("여행 사진 정리").getAttribute("aria-expanded")).toBe("true");
  });

  it("상세의 버튼이 알맞은 동작을 요청한다", () => {
    const { host } = setup();
    fireEvent.click(titleButton("여행 사진 정리"));
    const detail = within(itemOf("여행 사진 정리").querySelector<HTMLElement>(".tt-detail") as HTMLElement);
    const task = taskOf("여행 사진 정리");

    fireEvent.click(detail.getByRole("button", { name: "편집" }));
    expect(host.edit).toHaveBeenCalledWith(task);
    fireEvent.click(detail.getByRole("button", { name: "노트에서 열기" }));
    expect(host.openNote).toHaveBeenCalledWith(task);
    fireEvent.click(detail.getByRole("button", { name: "취소…" }));
    expect(host.cancel).toHaveBeenCalledWith(task, TODAY);
    // 모바일에서만 보이는 버튼도 같은 요청을 한다.
    fireEvent.click(detail.getByRole("button", { name: "완료" }));
    expect(host.complete).toHaveBeenCalledWith(task, TODAY);
    fireEvent.click(detail.getByRole("button", { name: "날짜 바꾸기" }));
    expect(host.pickDate).toHaveBeenCalledWith(task, TODAY);
  });

  it("완료한 항목의 상세에서는 완료한 날을 바꾸거나 되돌릴 수 있다", () => {
    const { host } = setup();
    fireEvent.click(titleButton("아침 스트레칭"));
    const detail = within(itemOf("아침 스트레칭").querySelector<HTMLElement>(".tt-detail") as HTMLElement);
    expect(detail.getAllByRole("button").map((b) => b.textContent)).toEqual(["완료한 날 바꾸기", "완료 되돌리기", "노트에서 열기"]);
    const task = taskOf("아침 스트레칭");
    fireEvent.click(detail.getByRole("button", { name: "완료한 날 바꾸기" }));
    expect(host.changeCompletedOn).toHaveBeenCalledWith(task);
    fireEvent.click(detail.getByRole("button", { name: "완료 되돌리기" }));
    expect(host.reopen).toHaveBeenCalledWith(task);
    fireEvent.click(detail.getByRole("button", { name: "노트에서 열기" }));
    expect(host.openNote).toHaveBeenCalledTimes(1);
  });

  it("취소한 항목의 상세에서는 취소 내용을 바꾸거나 되돌릴 수 있다", () => {
    const { host } = setup("records");
    fireEvent.click(titleButton("헬스장 1일권 구매"));
    const detail = within(itemOf("헬스장 1일권 구매").querySelector<HTMLElement>(".tt-detail") as HTMLElement);
    expect(detail.getAllByRole("button").map((b) => b.textContent)).toEqual(["취소 내용 바꾸기", "취소 되돌리기", "노트에서 열기"]);
    const task = taskOf("헬스장 1일권 구매");
    fireEvent.click(detail.getByRole("button", { name: "취소 내용 바꾸기" }));
    expect(host.changeCancellation).toHaveBeenCalledWith(task);
    fireEvent.click(detail.getByRole("button", { name: "취소 되돌리기" }));
    expect(host.reopen).toHaveBeenCalledWith(task);
  });
});

describe("요약 카드", () => {
  it("카드를 누르면 그 묶음만 보이고, 같은 카드를 다시 누르면 전체로 돌아온다", () => {
    setup();
    expect(sectionTitles()).toEqual(["지난 계획", "오늘", "예정", "확인이 필요한 항목"]);

    fireEvent.click(stat("오늘"));
    expect(sectionTitles()).toEqual(["오늘"]);
    expect(stat("오늘").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("오늘만 보는 중 ·")).toBeTruthy();

    fireEvent.click(stat("오늘"));
    expect(sectionTitles()).toEqual(["지난 계획", "오늘", "예정", "확인이 필요한 항목"]);
  });

  it("전체 보기 버튼으로 돌아온다", () => {
    setup();
    fireEvent.click(stat("예정"));
    expect(sectionTitles()).toEqual(["예정"]);
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(sectionTitles()).toEqual(["지난 계획", "오늘", "예정", "확인이 필요한 항목"]);
  });

  it("카드를 바꾸면 펼쳐 둔 항목을 접는다", () => {
    setup();
    fireEvent.click(titleButton("여행 사진 정리"));
    fireEvent.click(stat("지난 계획"));
    expect(titleButton("여행 사진 정리").getAttribute("aria-expanded")).toBe("false");
  });

  it("기록 카드를 누르면 완료·취소 항목을 보여 준다", () => {
    setup();
    fireEvent.click(stat("기록"));
    expect(sectionTitles()).toEqual(["기록"]);
    expect(screen.getByText("이사 준비 목록 쓰기")).toBeTruthy();
    expect(screen.queryByText("겨울옷 꺼내기")).toBeNull();
  });
});

describe("도구 바", () => {
  it("검색하면 제목이나 다른 이름이 맞는 항목만 남긴다", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const input = screen.getByRole("searchbox", { name: "검색" });
    fireEvent.change(input, { target: { value: "사진" } });
    expect(screen.getByText("여행 사진 정리")).toBeTruthy();
    expect(screen.queryByText("겨울옷 꺼내기")).toBeNull();
    expect(screen.queryByText("보고서 초안 제출")).toBeNull();
  });

  it("검색을 닫으면 검색어를 지우고 전체를 다시 보여 준다", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "검색" }), { target: { value: "사진" } });
    fireEvent.click(screen.getByRole("button", { name: "검색 닫기" }));
    expect(screen.getByText("겨울옷 꺼내기")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("검색어가 있는 채로 Esc로 닫으면 필터는 남고 검색 버튼이 켜져 있다", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const input = screen.getByRole("searchbox", { name: "검색" });
    fireEvent.change(input, { target: { value: "사진" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText("겨울옷 꺼내기")).toBeNull();
    expect(screen.getByRole("button", { name: "검색" }).classList.contains("is-active")).toBe(true);
  });

  it("마감 필터는 지났거나 임박한 항목만 남긴다", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /마감 1/ }));
    expect(screen.getByText("보고서 초안 제출")).toBeTruthy();
    expect(screen.queryByText("겨울옷 꺼내기")).toBeNull();
    expect(screen.queryByText("아침 스트레칭")).toBeNull();
  });

  it("분류를 고르면 그 분류만 남긴다", () => {
    setup();
    fireEvent.change(screen.getByRole("combobox", { name: "분류" }), { target: { value: "공부" } });
    expect(screen.getByText("보고서 초안 제출")).toBeTruthy();
    expect(screen.getByText("독서 모임 발제문 쓰기")).toBeTruthy();
    expect(screen.queryByText("여행 사진 정리")).toBeNull();
  });

  it("조건에 맞는 항목이 없으면 안내한다", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "검색" }), { target: { value: "없는 제목" } });
    expect(screen.getAllByText("조건에 맞는 할 일이 없어요.").length).toBeGreaterThan(0);
  });
});

describe("기록 필터", () => {
  it("상태 드롭다운으로 완료나 취소만 본다", () => {
    setup("records");
    fireEvent.change(screen.getByRole("combobox", { name: "상태" }), { target: { value: "cancelled" } });
    expect(screen.getByText("헬스장 1일권 구매")).toBeTruthy();
    expect(screen.queryByText("아침 스트레칭")).toBeNull();
  });

  it("월 드롭다운으로 그 달에 시작한 항목만 본다", () => {
    setup("records");
    fireEvent.change(screen.getByRole("combobox", { name: "월" }), { target: { value: "2026-09" } });
    expect(screen.getByText("이사 준비 목록 쓰기")).toBeTruthy();
    expect(screen.queryByText("아침 스트레칭")).toBeNull();
  });

  it("조건에 맞는 기록이 없으면 안내한다", () => {
    setup("records");
    fireEvent.change(screen.getByRole("combobox", { name: "상태" }), { target: { value: "cancelled" } });
    fireEvent.change(screen.getByRole("combobox", { name: "월" }), { target: { value: "2026-09" } });
    expect(screen.getByText("조건에 맞는 기록이 없어요.")).toBeTruthy();
  });
});

describe("확인이 필요한 항목", () => {
  it("항목마다 노트를 열 수 있고, 같은 항목의 노트를 요청한다", () => {
    const { host } = setup();
    const row = screen.getByText("알 수 없는 기호").closest<HTMLElement>(".tt-item");
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "노트에서 열기" }));
    expect(host.openNote).toHaveBeenCalledWith(expect.objectContaining({ title: "알 수 없는 기호", sourcePath: "할일/2026-10.md" }));
  });
});

describe("파일이 바뀌면 화면이 따라 바뀐다", () => {
  it("저장소가 새 내용을 알리면 항목과 개수를 다시 계산한다", () => {
    const { source } = setup();
    expect(screen.queryByText("새로 생긴 일")).toBeNull();
    expect(stat("오늘").textContent).toContain("2");

    const next = parseMonthNote(
      "할일/2026-10.md",
      "---\n월: 2026-10\n미완료: true\n---\n\n- [ ] 새로 생긴 일\n  - 하기로 한 날: 2026-10-18\n",
    );
    act(() => source.set({ loaded: true, folder: "할일", monthNotes: [next] }));

    expect(screen.getByText("새로 생긴 일")).toBeTruthy();
    expect(stat("오늘").textContent).toContain("1");
    expect(screen.queryByText("겨울옷 꺼내기")).toBeNull();
  });
});

describe("loaded 월 노트 자체", () => {
  it("테스트 입력이 기대한 모양이다", () => {
    expect(loaded.monthNotes.map((l) => l.path)).toEqual(["할일/2026-09.md", "할일/2026-10.md"]);
  });
});
