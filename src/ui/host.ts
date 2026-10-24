import type { TaskRecord } from "../data/types";

/**
 * 화면이 옵시디언에 부탁하는 일. 화면은 파일을 직접 고치지 않고 이 경계로만 요청한다.
 * 실제 구현은 옵시디언의 `Menu`, `Modal`, `Notice`와 액션 계층을 쓰고, 테스트에서는 가짜로 바꾼다.
 */
export interface AppHost {
  openNote(task: TaskRecord): void;
  /** 새 할 일 입력창. `defaultDate`는 처음 하기로 한 날의 기본값 */
  newTask(defaultDate: string): void;
  /** 오늘 날짜로 바로 완료한다. 알림에서 되돌릴 수 있다. */
  complete(task: TaskRecord, today: string): void;
  /** 완료한 날을 고르는 입력창 */
  completeOn(task: TaskRecord, today: string): void;
  /** 완료한 항목의 완료한 날을 바꾸는 입력창 */
  changeCompletedOn(task: TaskRecord): void;
  /** 취소한 항목의 취소한 날과 이유를 바꾸는 입력창 */
  changeCancellation(task: TaskRecord): void;
  /** 완료했거나 취소한 항목을 진행 중으로 되돌린다. */
  reopen(task: TaskRecord): void;
  cancel(task: TaskRecord, today: string): void;
  /** 날짜 추가 입력창 */
  pickDate(task: TaskRecord, today: string): void;
  edit(task: TaskRecord): void;
  /** 옵시디언 메뉴. `kind`가 `date`면 날짜 추가 항목만 보여 준다. */
  showMenu(event: MouseEvent, task: TaskRecord, today: string, kind: "task" | "date"): void;
}
