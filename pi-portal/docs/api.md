# API

All routes are served under **`/api`**. The dev proxy forwards browser requests from Vite to the API process.

## Health

`GET /api/health` — returns `{ ok: true, dotMiRoot: "<path>" }`.

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents` | List standalone agents: `{ agents: [{ id, workspace }] }` |
| `GET` | `/api/agents/:id` | Agent summary (path, optional file flags) |
| `POST` | `/api/agents` | Body: `{ name, workspace?: boolean }` — runs `dotpi create-agent` |
| `DELETE` | `/api/agents/:id` | Body: `{ confirm: "<id>" }` — must match `:id`; removes `agents/<id>/` |

## Files

Editable names: `pi-args`, `SYSTEM.md`, `APPEND_SYSTEM.md`, `AGENT.md`, `workspace.conf`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents/:id/file?path=<name>` | Read text. Optional files may return `missing: true` with empty `content`. |
| `PUT` | `/api/agents/:id/file` | Body: `{ path, content }` — writes file (creates optional files if missing). |

## Catalogs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/catalog/extensions` | Entries under `shared/extensions/` |
| `GET` | `/api/catalog/skills` | Skill dirs with parsed `SKILL.md` frontmatter |

## Symlinks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents/:id/links/extensions` | List `agents/<id>/extensions/` with symlink metadata |
| `GET` | `/api/agents/:id/links/skills` | List `agents/<id>/skills/` |
| `POST` | `/api/agents/:id/links/extensions` | Body: `{ name }` — create `../../../shared/extensions/<name>` link |
| `POST` | `/api/agents/:id/links/skills` | Body: `{ name }` — create `../../../shared/skills/<name>` link |
| `DELETE` | `/api/agents/:id/links/extensions/:name` | Remove symlink only (not local trees) |
| `DELETE` | `/api/agents/:id/links/skills/:name` | Same for skills |
