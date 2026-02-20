# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`: CLI wiring in `src/cli`, user commands in `src/commands`, channel plumbing under `src/channels` plus per-network folders (`src/telegram`, `src/slack`, etc.), and shared services in `src/infra` and `src/media`. Provider logic sits in `src/provider-web.ts`. Tests sit beside the files they cover as `*.test.ts`. Docs and diagrams live in `docs/` (Mintlify sources) and compile into `dist/`. Extensions and experimental channels live under `extensions/*`; keep their runtime dependencies scoped to those packages. Shared assets are in `assets/` and operational tooling in `scripts/`.

## Build, Test, and Development Commands
Run `pnpm install` (or `bun install`) once per checkout. `pnpm build` compiles the CLI, while `pnpm dev` or `pnpm openclaw ...` runs it locally. `pnpm check` executes lint + format validation (Oxlint + Oxfmt). `pnpm tsgo` performs strict TypeScript checks. Use `pnpm test`, `pnpm test:coverage`, or targeted configs like `pnpm vitest run -c vitest.gateway.config.ts` for focused suites.

## Coding Style & Naming Conventions
All code is TypeScript/ESM with strict typing; avoid `any`. Follow existing dependency-injection helpers such as `createDefaultDeps`. Prefer descriptive kebab-case file names and camelCase symbols, reserving PascalCase for classes/types. Formatting is enforced by Oxfmt; lint rules come from Oxlint plus project ESLint plugins. Keep files under ~700 LOC and extract helpers when logic sprawls. Document tricky blocks with short comments only when essential.

## Testing Guidelines
Vitest provides unit, integration, and gateway suites. Name tests after the feature file (e.g., `src/routing/router.test.ts`). Coverage targets are 70% across statements/branches/functions/lines; run `pnpm test:coverage` before opening a PR touching logic. Live channel suites require env flags like `LIVE=1` or `CLAWDBOT_LIVE_TEST=1`; leave them off unless you have credentials.

## Commit & Pull Request Guidelines
Use `scripts/committer "scope: action" <paths...>` to keep commits focused and linted. Messages should be imperative and scoped (e.g., `CLI: add verbose flag`). When pushing, rebase via `sync` if you need the latest main. PRs must describe motivation, testing evidence, and link any issues; add screenshots or CLI transcripts for user-visible changes. Avoid bundling formatting-only churn with behavior changes unless requested.

## Security & Configuration Tips
Never commit secrets; keep Discord or gateway tokens as raw values in `.env` or the macOS keychain. Run `openclaw config set gateway.mode=local` on dev machines and restart the gateway via the mac app or `scripts/restart-mac.sh` rather than ad-hoc tmux sessions. For docs, stick to Mintlify root-relative links (e.g., `[Config](/configuration)`) and avoid device-specific names. Credentials reside under `~/.openclaw/credentials/`; clean them before sharing environments.
