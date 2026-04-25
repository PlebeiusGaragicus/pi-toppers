# Security

## Bind address

The HTTP server listens on **`127.0.0.1` only** by default, so it is not exposed on the LAN unless you add a reverse proxy yourself.

## Path handling

- Operations are constrained to the configured **dot-pi root** (`DOT_PI_DIR` / `DOT_PI_ROOT`).
- New extension and skill symlinks use only the **relative** targets documented for dot-pi (`../../../shared/extensions/…`, `../../../shared/skills/…`), and targets must exist under `shared/`.

## Delete agent

`DELETE /api/agents/:id` requires a JSON body **`{ "confirm": "<agentId>" }`** where the value **exactly matches** the agent id in the URL, to reduce accidental deletion.
