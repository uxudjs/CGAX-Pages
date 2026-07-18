# Repository Guidelines

## Project Structure & Module Organization

CGAX-Pages is the static management frontend consumed by the sibling `../CfGfwAX` project. `../CfGfwAX/_worker.js` points `Pages静态页面` at this repository's GitHub Pages deployment and proxies routes such as `/admin` and `/login`. Treat route names and response shapes as a cross-repository contract.

- `admin/index.html` contains the main single-file HTML/CSS/JavaScript interface. The other files under `admin/` are static preview fixtures for Worker endpoints.
- `login/`, `noADMIN/`, and `noKV/` contain standalone state pages. Preserve their existing case-sensitive paths.
- `data/` and `vendor/` contain pinned upstream assets. Record reviewed replacements and source revisions in `VENDORED.md`.
- `.github/workflows/static.yml` publishes the repository root to GitHub Pages on pushes to `main`.

## Build, Test, and Development Commands

There is no package manager or build step; files are deployed as committed.

```powershell
npx --yes serve@14 . --listen 8000
Get-Content -Raw admin/config.json | ConvertFrom-Json | Out-Null
node ../CfGfwAX/chain_proxy.test.mjs
git diff --check
```

The first command downloads a one-off static server and opens a local preview at `http://localhost:8000/admin/`; it does not add a project dependency. The PowerShell command checks edited JSON fixtures. Run the sibling Node regression after shared frontend/Worker behavior changes, then use `git diff --check` to catch whitespace errors.

## Coding Style & Naming Conventions

Use plain HTML, CSS, and browser JavaScript; do not add a toolchain for isolated changes. Match the indentation of the file being edited and avoid whole-file formatting of the large inline pages. Use `camelCase` for JavaScript names and `kebab-case` for CSS classes. Keep comments concise and in Simplified Chinese. Never edit pinned `vendor/` or `data/` content without reviewing the upstream diff.

## Testing Guidelines

No automated frontend suite or coverage threshold exists. Smoke-test every affected route in a browser, inspect the console and network panel, and exercise both success and error states. For API or route changes, compare fetch calls in `admin/index.html` and `login/index.html` with handlers in `../CfGfwAX/_worker.js`. Name any standalone Node regression `*.test.mjs` and keep it focused on the changed behavior.

## Commit & Pull Request Guidelines

Follow the history's Conventional Commit style: `feat:`, `fix:`, `chore:`, or `style:` plus a concise description. Keep commits single-purpose. Pull requests should list affected routes, manual checks, and any linked `CfGfwAX` change; include before/after screenshots for visible UI work and link the relevant issue when available.

## Security & Configuration

Fixtures must contain only non-sensitive sample data. Never commit real `ADMIN`, `UUID`, API tokens, cookies, or deployment credentials.
