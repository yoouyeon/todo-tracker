# Todo Tracker month notes

The todos in this folder are managed by the Obsidian plugin Todo Tracker. Follow the rules below when you read or edit the month notes in this folder. The plugin reads and writes this format as is, so a todo in the wrong format is not shown, or ends up under `Needs attention`.

## Files

- Only `YYYY-MM.md` files directly in this folder are month notes. The plugin doesn't read subfolders or files with other names (including this one).
- Put a todo in the file of **the month it was first planned**. When you move its date to another month, don't move the todo to another file.
- A new month note starts with this frontmatter. `month` matches the file name.

```markdown
---
month: 2026-10
open: true
---
```

- `open` is `true` if the file has at least one open (`[ ]`) todo, and `false` otherwise. Update it when you change the status of a todo.

## Todos

```markdown
- [ ] Submit the report draft
  - first planned: 2026-10-14
  - planned: 2026-10-18
  - deadline: 2026-10-17 18:00
  - category: study
  - memo: draft only
```

- A todo starts with an unindented `- [ ] title` line. Other list markers such as `*` or `1.` are not read.
- Use only three checkboxes: `[ ]` open, `[x]` done, `[-]` cancelled.
- Fields are `- name: value` lines under the title, all indented to the same depth. Write each field only once.
- Dates are `YYYY-MM-DD`. A deadline with a time is `YYYY-MM-DD HH:mm`.
- Field names are lowercase, in this order: `first planned`, `planned`, `deadline`, `completed`, `cancelled`, `reason`, `category`, `alias`, `memo`.

| Field | Meaning |
|---|---|
| `first planned` | The date first planned. If missing, it is the same as `planned`. |
| `planned` (required) | The date currently planned. Write only one date. |
| `deadline` | A date, or a date and time |
| `completed` | For `[x]` todos. |
| `cancelled`, `reason` | For `[-]` todos. `reason` is optional. |
| `category` | Used for filtering |
| `alias` | Other names used in search |
| `memo` | Free-form memo |

The plugin also reads Korean field names (`하기로 한 날` and so on), but this folder uses the English names above. Don't mix the two languages within a todo.

Don't write fields that are not in the table. The plugin lists todos with unknown fields separately under `Needs attention`.

## Common tasks

- **Add a todo**: Put it in the file of the month of its `planned` date. If the file doesn't exist, create it with the frontmatter above.
- **Postpone**: Change only `planned`. If there is no `first planned`, add it first with the date before the change. The plugin uses it to count how long the todo has been postponed.
- **Complete**: Change `[ ]` to `[x]` and add `completed`.
- **Cancel**: Change `[ ]` to `[-]` and add `cancelled`. Add `reason` if there is one.
- **Undo**: Change the checkbox back to `[ ]` and remove `completed`, or `cancelled` and `reason`.

The plugin doesn't read comments such as `<!-- Open -->` or headings between todos, so leave them as they are.
