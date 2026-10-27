# Todo Tracker

> Track monthly Markdown todo notes in Obsidian: overdue, today and upcoming at a glance. The UI and the note format currently support Korean only.

월별 Markdown 노트에 적은 할 일을 지난 계획, 오늘, 예정으로 나눠 보여 줍니다. 화면에서 완료하거나 날짜를 바꾸면 노트에 바로 반영되고, 노트를 직접 고쳐도 화면에 바로 반영됩니다.

![할 일 화면](docs/images/overview.png)

## In English

Todo Tracker shows the tasks in your monthly Markdown notes, grouped into overdue, today and upcoming. Changes you make in the view are written back to the note right away, and edits to the note show up in the view.

**The plugin UI and the note format currently support Korean only.** Field names such as `하기로 한 날` (planned date) are in Korean for now, so the plugin is mainly useful if you read Korean.

- Reads `YYYY-MM.md` notes in a folder you choose (default `할일`). Each task is a checklist item with indented `- field: value` lines.
- Flags tasks postponed for 7 days or more, and tasks with a passed or upcoming deadline.
- Complete, reschedule, edit or cancel tasks from the view, and undo them.
- Filter by deadline, category or text.
- Works on desktop and mobile.

Open it from the ribbon icon or the command `Todo Tracker: 할 일 열기` (Open todos). The sections below describe the note format in Korean.

## Features

- **지난 계획, 오늘, 예정**으로 나눠 보기: 진행 중인 항목을 `하기로 한 날` 기준으로 나눕니다.
- **오래 밀린 항목 강조**: 처음 하기로 한 날부터 7일 이상 지나면 `N일째` 칩을 붙여 지난 계획 맨 위로 올립니다.
- **마감 칩**: 마감이 지났거나 다가온 항목에 칩을 붙입니다.
- **필터**: 마감, 분류, 검색으로 항목을 거릅니다.
- **바로 완료**: 체크 원을 누르면 오늘 날짜로 완료되고, 알림에서 바로 되돌릴 수 있습니다.
- **날짜 바꾸기, 편집, 취소**: 항목 메뉴에서 다른 날 완료로 기록하거나 날짜를 바꾸고, 편집하거나 취소합니다. 완료하거나 취소한 항목도 고치거나 되돌릴 수 있습니다.
- **노트와 양방향 반영**: 화면에서 바꾸면 노트에, 노트를 고치면 화면에 바로 반영됩니다.
- **AI 에이전트와 함께 쓰기**: [형식 안내 파일](#using-with-ai-agents)을 할 일 폴더에 넣으면 AI가 형식에 맞게 할 일을 고칩니다.

![상세 정보](docs/images/detail.png)

## Getting started

### Installation

#### 커뮤니티 플러그인

설정 → 커뮤니티 플러그인 → 탐색에서 `Todo Tracker`를 찾아 설치하고 켭니다.

#### 직접 설치

1. [릴리스](https://github.com/yoouyeon/todo-tracker/releases)에서 `main.js`, `manifest.json`, `styles.css`를 받습니다.
2. vault의 `.obsidian/plugins/todo-tracker/` 폴더에 세 파일을 넣습니다.
3. 옵시디언을 다시 열고 설정 → 커뮤니티 플러그인에서 `Todo Tracker`를 켭니다.

옵시디언 1.13.0 이상에서 동작하며 데스크톱과 모바일을 모두 지원합니다.

### 첫 할 일 적기

`할일` 폴더에 이번 달 이름으로 노트(예: `2026-10.md`)를 만들고 할 일을 적습니다.

```markdown
- [ ] 보고서 초안 제출
  - 하기로 한 날: 2026-10-18
```

왼쪽 리본의 `할 일 열기` 아이콘을 누르거나 명령어 팔레트에서 `Todo Tracker: 할 일 열기`를 실행하면 할 일 화면이 열립니다.

## Using with AI agents

Claude Code나 Codex 같은 AI 에이전트가 월 노트 형식에 맞게 할 일을 읽고 고치게 하려면, [AI용 안내 파일](docs/ai/AGENTS.md)을 할 일 폴더에 넣습니다.

1. [`docs/ai/AGENTS.md`](docs/ai/AGENTS.md)를 받습니다.
2. 할 일 폴더(기본값 `할일`)에 아래 이름으로 저장합니다.
   - Claude Code: `CLAUDE.md`
   - 그 밖의 에이전트: `AGENTS.md`

에이전트는 할 일 폴더의 파일을 다룰 때 이 안내를 읽습니다. 도구에 따라 하위 폴더의 안내 파일을 자동으로 읽지 않을 수 있으니, 그럴 때는 할 일 폴더에서 에이전트를 실행하거나 이 파일을 먼저 읽으라고 알려 주세요.

플러그인은 이 파일을 할 일로 읽지 않습니다. Obsidian 파일 목록에는 할 일 폴더 안의 노트로 보입니다.

## Note format

설정한 폴더(기본값 `할일`) 바로 아래의 `YYYY-MM.md` 파일만 읽습니다.

```text
할일/
├── 2026-09.md
└── 2026-10.md
```

월 노트 하나는 아래와 같습니다.

```markdown
---
# 월은 파일 이름과 같게, 미완료는 플러그인이 맞춥니다
월: 2026-10
미완료: true
---

<!-- 할 일은 처음 하기로 한 날이 속한 달의 파일에 둡니다 -->

<!-- 진행 중 -->
- [ ] 보고서 초안 제출
  - 처음 하기로 한 날: 2026-10-14
  - 하기로 한 날: 2026-10-18
  - 마감일: 2026-10-17 18:00
  - 분류: 공부
  - 메모: 초안만 먼저

<!-- 완료 -->
- [x] 아침 스트레칭
  - 하기로 한 날: 2026-10-18
  - 완료한 날: 2026-10-18

<!-- 취소 -->
- [-] 헬스장 1일권 구매
  - 하기로 한 날: 2026-10-11
  - 취소한 날: 2026-10-12
  - 이유: 집 근처에 새 헬스장이 생김
```

날짜는 `YYYY-MM-DD`로 씁니다.

| 필드 | 설명 |
|---|---|
| `처음 하기로 한 날` | 처음 계획한 날짜입니다. 없으면 `하기로 한 날`로 봅니다. |
| `하기로 한 날` (필수) | 지금 하기로 한 날짜입니다. |
| `마감일` | 날짜 또는 `YYYY-MM-DD HH:mm` |
| `완료한 날`, `취소한 날` | 완료하거나 취소한 항목에 씁니다. |
| `이유` | 취소한 이유 |
| `분류` | 필터에 쓰는 분류 |
| `다른 이름` | 검색에 함께 쓰는 이름입니다. 화면에서는 고칠 수 없습니다. |
| `메모` | 자유 메모 |

플러그인은 모르는 필드는 읽지 않습니다. 모르는 필드가 있는 항목은 화면 맨 아래 `확인이 필요한 항목`에 모아 보여줍니다.

## Settings

설정 → Todo Tracker의 `할 일 폴더`에서 월 노트가 있는 폴더를 바꿀 수 있습니다. 기본값은 `할일`이고, 비워 두면 vault 루트를 읽습니다.

## License

[MIT](LICENSE)
