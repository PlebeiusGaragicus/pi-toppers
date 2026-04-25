# dot-mi session explorer

Read-only browser UI for Pi **JSONL** sessions under this repo (`agents/*/sessions`, `teams/*/sessions`, `workspaces/*/*/sessions`). Uses `@mariozechner/pi-web-ui` **`MessageList`** to render `SessionManager.buildSessionContext().messages`.

**Security:** Session files may contain secrets. The API and production server bind to **127.0.0.1** only.

## Setup

```bash
cd tools/session-explorer
npm install
```

## Development

Runs the JSON API on port **8765** and Vite on **5173** (proxies `/api` to the API).

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

From a shell with `env.sh` sourced:

```bash
session-explorer
```

## Production (single port)

```bash
npm run build
npm run start
```

Serves static files from `dist/` and `/api/*` on **8765** (override with `SESSION_EXPLORER_API_PORT` or `--port=PORT`).

## Environment

| Variable | Purpose |
|----------|---------|
| `DOT_PI_ROOT` or `DOT_PI_DIR` | Repo root (default: parent of `tools/session-explorer`) |
| `SESSION_EXPLORER_API_PORT` | API port (default `8765`) |
| `SESSION_EXPLORER_SERVE_STATIC` | Set to `1` in `npm start` to serve `dist/` + API on one port |

## API

- `GET /api/sessions` — list `{ rel, mtime, label }[]`
- `GET /api/session?path=<rel>` — `{ rel, header, thinkingLevel, model, messages }`

Paths must match the allowlisted layout; `..` and other roots are rejected.

## Notes

Some message roles (e.g. `bashExecution`) may not render until custom renderers are registered; see Pi `MessageList` behavior.

Align `@mariozechner/*` versions with your installed Pi (here pinned to `0.66.1`).
