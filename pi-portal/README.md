# pi-portal

**Documentation:** [pi-portal on GitHub Pages](https://PlebeiusGaragicus.github.io/pi-portal/) (built from `docs/` via MkDocs).

Local web UI for managing **[dot-pi](https://github.com/PlebeiusGaragicus/dot-pi)** **standalone agents** (`agents/<name>/`): browse agents, edit `SYSTEM.md`, `pi-args`, and optional files, add or remove symlinks to shared extensions and skills, and create or delete agents (same behavior as `dotpi create-agent`).

**Scope (v1):** standalone agents only. Teams under `teams/` are not managed here.

## Requirements

- Node.js 20+
- For **Create agent** from the UI: `bash` and the dot-pi `dotpi` script must be executable (the API runs `bash /path/to/dot-pi/dotpi create-agent …`).

## Configuration

| Variable | Description |
|----------|-------------|
| `DOT_PI_DIR` or `DOT_PI_ROOT` | Absolute path to the **dot-pi** repository root (contains `agents/`, `shared/`, `dotpi`). If unset, defaults to two levels above this package (when `pi-portal` is the submodule at `dot-pi/tools/pi-portal`). |
| `PI_PORTAL_API_PORT` | API port (default **8790**). The Vite dev server proxies `/api` to this port. |
| `PI_PORTAL_SERVE_STATIC` | Set to `1` for production mode so the Node server serves the built `dist/` SPA in addition to `/api`. |

## Development

```bash
cd tools/pi-portal
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`). The API listens on `127.0.0.1:$PI_PORTAL_API_PORT` (default 8790).

## Production

```bash
npm run build
PI_PORTAL_SERVE_STATIC=1 DOT_PI_DIR=/path/to/dot-pi npm start
```

Then open `http://127.0.0.1:8790` (or your chosen `PI_PORTAL_API_PORT`).

## Security

- The server binds to **127.0.0.1** only (not exposed on the LAN by default).
- Paths are constrained to the configured dot-pi root; symlink creation only uses the relative targets documented for dot-pi (`../../../shared/extensions/…`, `../../../shared/skills/…`).
- **Delete agent** requires a JSON body `{ "confirm": "<agentId>" }` matching the agent being removed.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Concurrently: `tsx watch server.ts` + Vite |
| `npm run build` | Typecheck + Vite production build |
| `npm start` | Serve API + static `dist/` (`PI_PORTAL_SERVE_STATIC=1`) |
| `npm run check` | `tsc --noEmit` |
