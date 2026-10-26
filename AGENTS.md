# tabeLog development

- Work in this existing checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user asks.
- Node >=22.13, preferably 24 LTS. Install with `npm ci` and retain `package-lock.json`.
- `npm run dev` starts the personal diary. Unconfigured development uses SQLite and files in ignored `.data/`. All writes require an individual account, including local mode. Only explicitly public records can be read anonymously.
- Never read or print secrets or commit real `.env` files, `.data/`, or `.vercel/`. The credential-free `.env.example` template is allowed.
- Store coordinates in WGS-84; only AMap's boundary uses GCJ-02. Preserve transforms and validation.
- Production must use D1/R2 and SESSION_SECRET configuration; never introduce an ephemeral-disk fallback on Vercel.
- Run `npm run typecheck`, `npm test`, `npm run build` for meaningful code changes; `npm run test:e2e` for affected user flows. The e2e data is isolated in `/tmp/tabelog-e2e`.
- Keep maps lazy-loaded, credentials server-only, and enforce owner/visibility checks in every data and image route. Never expose account emails or password hashes in public feeds. Old records without an owner stay inaccessible until an administrator explicitly assigns them with data:claim. Google/AMap live checks require appropriately restricted browser keys; do not claim they were verified without those keys.
- See README.md for deployment and backup limitations.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
