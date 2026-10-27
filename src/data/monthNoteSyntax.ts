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

/** 노트에 적는 필드 이름의 언어. 읽을 때는 두 언어를 모두 받고, 새로 쓰는 줄은 설정한 언어로 쓴다. */
export type NoteLanguage = "ko" | "en";

export type FieldId = "firstPlanned" | "planned" | "deadline" | "completed" | "cancelled" | "reason" | "category" | "alias" | "memo";

export const FIELD_NAMES: Record<NoteLanguage, Record<FieldId, string>> = {
  ko: {
    firstPlanned: "처음 하기로 한 날",
    planned: "하기로 한 날",
    deadline: "마감일",
    completed: "완료한 날",
    cancelled: "취소한 날",
    reason: "이유",
    category: "분류",
    alias: "다른 이름",
    memo: "메모",
  },
  en: {
    firstPlanned: "first planned",
    planned: "planned",
    deadline: "deadline",
    completed: "completed",
    cancelled: "cancelled",
    reason: "reason",
    category: "category",
    alias: "alias",
    memo: "memo",
  },
};

/** 새 속성 줄을 넣을 때 따르는 순서. 기존 노트의 순서와 같다. */
export const FIELD_ORDER: readonly FieldId[] = [
  "firstPlanned",
  "planned",
  "deadline",
  "completed",
  "cancelled",
  "reason",
  "category",
  "alias",
  "memo",
];

export interface FieldName {
  id: FieldId;
  lang: NoteLanguage;
}

const FIELDS_BY_NAME = new Map<string, FieldName>(
  (Object.keys(FIELD_NAMES) as NoteLanguage[]).flatMap((lang) => FIELD_ORDER.map((id) => [FIELD_NAMES[lang][id], { id, lang }] as const)),
);

/** 속성 줄의 이름이 어느 필드인지. 모르는 이름이면 null */
export const fieldOf = (name: string): FieldName | null => FIELDS_BY_NAME.get(name) ?? null;

export type FrontmatterId = "month" | "hasOpen";

export const FRONTMATTER_KEYS: Record<NoteLanguage, Record<FrontmatterId, string>> = {
  ko: { month: "월", hasOpen: "미완료" },
  en: { month: "month", hasOpen: "open" },
};

/** 같은 뜻의 frontmatter 키를 두 언어로 돌려준다. */
export const frontmatterKeys = (id: FrontmatterId): string[] => [FRONTMATTER_KEYS.ko[id], FRONTMATTER_KEYS.en[id]];

/** 새 월 노트 맨 위의 제목 */
export const monthHeading = (month: string, lang: NoteLanguage): string => (lang === "ko" ? `# ${month} 할 일` : `# ${month} todos`);

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
