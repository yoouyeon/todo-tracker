import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonthNoteSnapshot } from "../../src/data/taskStore";
import { App } from "../../src/ui/App";
import type { Tab } from "../../src/ui/StatCards";
import { NOW, createHostStub, createSource, loaded } from "./support";

function render(snapshot: MonthNoteSnapshot, initialTab?: Tab): string {
  // 서버 렌더링이 글자 사이에 넣는 주석을 지워서 화면에 보이는 글만 남긴다.
  return renderToString(<App store={createSource(snapshot)} host={createHostStub()} getNow={NOW} initialTab={initialTab} />).replace(/<!-- -->/g, "");
}

describe("App 렌더링", () => {
  const html = render(loaded);

  it("머리말에 날짜와 오늘 요약과 새 할 일 버튼을 보여 준다", () => {
    expect(html).toContain("10월 18일 (일)");
    expect(html).toContain("오늘 3개 중 1개 완료");
    expect(html).toMatch(/<button type="button" class="mod-cta tt-new" aria-label="새 할 일">/);
  });

  it("요약 카드 네 개를 보여 준다", () => {
    for (const label of ["지난 계획", "오늘", "예정", "기록"]) expect(html).toContain(`>${label}`);
    expect(html).toContain("오래 밀린 일 2");
    expect(html).toContain("완료 4 · 취소 1");
  });

  it("지난 계획, 오늘, 예정 묶음과 항목을 보여 준다", () => {
    expect(html).toContain("겨울옷 꺼내기");
    expect(html).toContain("보고서 초안 제출");
    expect(html).toContain("독서 모임 발제문 쓰기");
    expect(html).toContain("오래 밀린 일 2개");
  });

  it("오늘과 예정 머리글에 추가 버튼이 있고 지난 계획에는 없다", () => {
    expect(html).toContain('aria-label="오늘에 추가"');
    expect(html).toContain('aria-label="예정에 추가"');
    expect(html).not.toContain('aria-label="지난 계획에 추가"');
  });

  it("오래 밀림과 마감을 색 대신 칩 글자로 보여 준다", () => {
    expect(html).toContain("20일째");
    expect(html).toContain("9일째");
    expect(html).toContain("마감 지남");
    expect(html).toContain("10/28 마감");
  });

  it("진행 중 항목에는 눌러서 완료하는 체크와 행 버튼이 있다", () => {
    expect(html).toContain('aria-label="완료로 기록: 겨울옷 꺼내기"');
    expect(html).toContain('class="tt-pills"');
    expect(html).toContain('aria-label="더 보기"');
  });

  it("오늘 완료한 일은 취소선 항목으로 남기고 완료 체크는 없다", () => {
    expect(html).toMatch(/tt-item is-done[^"]*"[\s\S]*?아침 스트레칭/);
    expect(html).not.toContain("완료로 기록: 아침 스트레칭");
  });

  it("읽을 수 없는 항목을 숨기지 않고 이유와 함께 보여 준다", () => {
    expect(html).toContain("확인이 필요한 항목");
    expect(html).toContain("형식이 틀린 날짜");
    expect(html).toContain("체크박스 기호를 알 수 없음: [?]");
    expect(html).toContain("하기로 한 날 없음");
  });

  it("기록은 기록 카드를 눌러야 보인다", () => {
    expect(html).not.toContain("이사 준비 목록 쓰기");
  });

  it("아래 도구 바에 마감 개수와 분류 선택이 있다", () => {
    expect(html).toContain("마감 1");
    expect(html).toContain('<option value="공부">');
  });

  it("항목 제목은 테마의 버튼 스타일을 받지 않도록 button이 아니다", () => {
    expect(html).not.toMatch(/<button[^>]*class="[^"]*tt-main/);
    expect(html).toMatch(/<span role="button" tabindex="0" class="tt-plain tt-main" aria-expanded="false">/);
  });

  it("플러그인 자체 색을 쓰는 인라인 스타일이 없다", () => {
    expect(html).not.toMatch(/style="[^"]*(color|background)/);
  });
});

describe("App 기록 탭", () => {
  const html = render(loaded, "records");

  it("완료·취소 항목을 처리한 날짜별로 묶어 보여 준다", () => {
    expect(html).toContain("이사 준비 목록 쓰기");
    expect(html).toContain("헬스장 1일권 구매");
    expect(html).toContain("tt-record-day");
    expect(html).toContain("10월 13일 (화)");
  });

  it("끝난 항목에는 완료 체크와 행 버튼이 없다", () => {
    expect(html).not.toContain("완료로 기록:");
    expect(html).not.toContain("tt-pills");
  });

  it("진행 중 묶음은 보이지 않는다", () => {
    expect(html).not.toContain("겨울옷 꺼내기");
    expect(html).not.toContain("확인이 필요한 항목");
  });

  it("상태와 월은 칩이 아니라 옵시디언 드롭다운으로 고른다", () => {
    expect(html).toContain('aria-label="상태"');
    expect(html).toContain(">전체 5</option>");
    expect(html).toContain(">완료 4</option>");
    expect(html).toContain(">취소 1</option>");
    expect(html).toContain(">모든 달</option>");
    expect(html).toContain(">2026-09</option>");
    expect(html).not.toContain("tt-filter-chip");
  });

  it("선택한 카드를 알리고 전체 보기로 돌아가는 버튼이 있다", () => {
    expect(html).toContain("기록만 보는 중");
    expect(html).toContain("전체 보기");
    expect(html).toContain('aria-pressed="true"');
  });
});

describe("App 상태 화면", () => {
  it("읽는 중에는 안내만 보여 준다", () => {
    const html = render({ loaded: false, folder: "할일", monthNotes: [] });
    expect(html).toContain("장부를 불러오는 중이에요");
    expect(html).not.toContain("지난 계획");
  });

  it("월 노트가 하나도 없으면 폴더를 알려 주고 첫 할 일을 만들 수 있다", () => {
    const html = render({ loaded: true, folder: "할일", monthNotes: [] });
    expect(html).toContain("아직 할 일이 없어요");
    expect(html).toContain("할일/ 폴더의 YYYY-MM.md 파일에서 할 일을 읽어요.");
    expect(html).toContain('aria-label="새 할 일"');
  });

  it("폴더 설정이 비어 있으면 vault 루트라고 알려 준다", () => {
    const html = render({ loaded: true, folder: "", monthNotes: [] });
    expect(html).toContain("vault 루트 폴더의 YYYY-MM.md 파일");
  });
});
