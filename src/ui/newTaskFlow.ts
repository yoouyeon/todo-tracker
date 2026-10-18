export type NewTaskStep =
  /** 새 항목을 만든다. */
  | { kind: "create" }
  /** 같은 제목의 진행 중 항목이 있으니 기존 항목에 날짜를 더할지 새로 만들지 고르게 한다. */
  | { kind: "ask" }
  /** 이미 물었는데 아직 고르지 않았다. */
  | { kind: "choose" }
  /** 고른 기존 항목에 날짜를 더한다. `index`는 같은 제목 항목 목록에서의 위치 */
  | { kind: "add-date"; index: number };

/**
 * 새 할 일을 저장할 때 다음에 할 일. 제목이 완전히 같은 진행 중 항목이 있으면
 * 사용자가 고르기 전까지 자동으로 합치지도, 새로 만들지도 않는다.
 */
export function nextNewTaskStep(duplicateCount: number, asked: boolean, choice: number | "new" | null): NewTaskStep {
  if (duplicateCount === 0 || choice === "new") return { kind: "create" };
  if (typeof choice === "number" && choice < duplicateCount) return { kind: "add-date", index: choice };
  return asked ? { kind: "choose" } : { kind: "ask" };
}
