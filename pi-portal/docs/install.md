# Install

## Requirements

- **Node.js 20+**
- A checkout of **dot-pi** (or any tree that contains `agents/`, `shared/`, and `dotpi`).
- For **Create agent** in the UI: **`bash`** and an executable **`dotpi`** at the dot-pi root (the API runs `bash /path/to/dot-pi/dotpi create-agent …`).

## Get the code

Clone the repository:

```bash
git clone https://github.com/PlebeiusGaragicus/pi-portal.git
cd pi-portal
```

Or, inside dot-pi, use the submodule:

```bash
git submodule update --init tools/pi-portal
cd tools/pi-portal
```

## Dependencies

```bash
npm install
```

## Local documentation (MkDocs)

To build the same site as GitHub Pages locally:

```bash
pip install mkdocs-material
mkdocs serve
```

Open the URL MkDocs prints (usually `http://127.0.0.1:8000`).

## GitHub Pages

The workflow [`.github/workflows/docs.yml`](https://github.com/PlebeiusGaragicus/pi-portal/blob/main/.github/workflows/docs.yml) builds and deploys this site on pushes to **`main`** when `docs/`, `mkdocs.yml`, or the workflow file changes. In the GitHub repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** (not “Deploy from a branch”).
