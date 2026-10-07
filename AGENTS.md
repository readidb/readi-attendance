<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mobile UI checks

When changing mobile forms, check card boundaries, input widths, and control spacing together without waiting for a separate request. Date and time inputs must fit their container on mobile Safari as well as Chromium; preserve the native picker while constraining the rendered input. Verify narrow mobile layouts in an available browser before release, and state explicitly when browser verification is unavailable.
