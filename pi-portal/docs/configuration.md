# Configuration

Environment variables read by the server and tooling:

| Variable | Description |
|----------|-------------|
| `DOT_PI_DIR` or `DOT_PI_ROOT` | Absolute path to the **dot-pi** repository root (must contain `agents/`, `shared/`, `dotpi`). If unset, defaults to **two levels above** the pi-portal package directory (so `dot-pi` is resolved when this repo lives at `dot-pi/tools/pi-portal`). |
| `PI_PORTAL_API_PORT` | API listen port (default **8790**). The Vite dev server proxies `/api` to this port. |
| `PI_PORTAL_SERVE_STATIC` | Set to `1` so the Node server serves the built `dist/` SPA as well as `/api` (production-style run). |

Typical development:

```bash
# optional: point at a non-default dot-pi checkout
export DOT_PI_DIR=/path/to/dot-pi
npm run dev
```
