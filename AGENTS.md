# AGENTS.md

## Git

- `master` is stable. Do not commit feature work directly on it.
- `dev` is the integration branch for normal development.
- Start new work from `dev`:
  - `feat/<short-name>` for features
  - `fix/<short-name>` for bug fixes
  - `ci/<short-name>` for CI-only changes
  - `docs/<short-name>` for docs-only changes
- Merge feature and fix branches into `dev`.
- Promote `dev` into `master` only when the site is ready to publish.
- For urgent production fixes, branch `hotfix/<short-name>` from `master`, then merge it into both `master` and `dev`.
- Use squash merge for pull requests.
- Commit with `git commit -S`.
- Use Conventional Commits: `<type>[optional scope]: <description>`.
- Write a commit body when the subject alone does not explain the why, tradeoff, or verification.

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm format`
- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm assets:fonts` after changing CJK font coverage
