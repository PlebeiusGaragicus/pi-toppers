# pi-portal

**pi-portal** is a local web UI for managing **[dot-pi](https://github.com/PlebeiusGaragicus/dot-pi)** **standalone agents** (`agents/<name>/`): browse agents, edit `SYSTEM.md`, `pi-args`, and optional prompt files, add or remove symlinks to shared extensions and skills, and create or delete agents (aligned with `dotpi create-agent`).

## Scope

**v1** covers **standalone agents only**. Teams under `teams/` are not managed in this UI.

## Quick links

| Topic | Page |
|-------|------|
| Setup & requirements | [Install](install.md) |
| Dev & production runs | [Usage](usage.md) |
| Environment variables | [Configuration](configuration.md) |
| REST endpoints | [API](api.md) |
| Binding & path safety | [Security](security.md) |

## Source

Repository: [github.com/PlebeiusGaragicus/pi-portal](https://github.com/PlebeiusGaragicus/pi-portal)

When used inside dot-pi, pi-portal is typically added as a submodule at `tools/pi-portal`.
