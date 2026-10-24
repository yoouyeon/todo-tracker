/** 월 노트의 줄 단위 문법. 파서(읽기)와 편집(쓰기)이 같은 규칙을 쓰도록 모아 둔다. */

export interface Line {
  /** 줄 끝의 \r을 뺀 내용 */
  text: string;
  start: number;
  /** 줄바꿈과 \r을 뺀 끝 위치 */
  end: number;
}

export const TASK_HEADER_RE = /^- \[([^\]]*)\][ \t]*(.*)$/;
export const PROPERTY_RE = /^[ \t]+- ([^:]+?):[ \t]*(.*)$/;
export const INDENTED_RE = /^[ \t]+\S/;

export const FIELD = {
  planned: "하기로 한 날",
  deadline: "마감일",
  completed: "완료한 날",
  cancelled: "취소한 날",
  reason: "이유",
  category: "분류",
  alias: "다른 이름",
  memo: "메모",
} as const;

export type FieldKey = (typeof FIELD)[keyof typeof FIELD];

/** 새 속성 줄을 넣을 때 따르는 순서. 기존 노트의 순서와 같다. */
export const FIELD_ORDER: readonly FieldKey[] = [
  FIELD.planned,
  FIELD.deadline,
  FIELD.completed,
  FIELD.cancelled,
  FIELD.reason,
  FIELD.category,
  FIELD.alias,
  FIELD.memo,
];

export const KNOWN_FIELDS: ReadonlySet<string> = new Set(FIELD_ORDER);

export function splitLines(content: string): Line[] {
  const lines: Line[] = [];
  let pos = 0;
  for (;;) {
    const nl = content.indexOf("\n", pos);
    const lineEnd = nl === -1 ? content.length : nl;
    const raw = content.slice(pos, lineEnd);
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    lines.push({ text, start: pos, end: pos + text.length });
    if (nl === -1) break;
    pos = nl + 1;
  }
  return lines;
}

export const indentOf = (text: string): string => /^[ \t]*/.exec(text)?.[0] ?? "";

/** 파일이 CRLF를 쓰면 새로 넣는 줄도 CRLF로 맞춘다. */
export const detectEol = (content: string): "\r\n" | "\n" => (content.includes("\r\n") ? "\r\n" : "\n");
