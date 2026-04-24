# CLAUDE.md

Project-specific guidance for Claude Code. Read this before making changes.

## Stack

- **Frontend:** HTML/CSS/vanilla JavaScript. No frameworks, no build step, no bundler.
- **Backend:** Google Apps Script (server-side logic, e.g. mentor matching).
- **Data store:** Google Sheets via Sheets API v4 (REST).
- **Auth:** Google Identity Services (`google.accounts.oauth2`).
- **Hosting:** Static files. No Node, no Python, no package.json at runtime.

## Core principle: don't over-engineer

This is the single most important rule. This project deliberately avoids frameworks and build tooling. Reach for the simplest thing that works.

- **No new dependencies, libraries, or CDN imports without explicit approval.** If a few lines of vanilla JS will do, write the few lines.
- **No build steps, bundlers, transpilers, or package managers.** Code runs as-is in the browser or in Apps Script.
- **No TypeScript, JSX, or syntax that requires compilation.** Plain ES2020+ that modern browsers run natively.
- **No speculative abstractions.** Don't add a class hierarchy, factory, strategy pattern, or options object for a problem that doesn't exist yet. If there's one caller, write one function.
- **No premature configuration.** Hardcoded values are fine until there's a second use case. Extract constants when there's actual duplication, not before.
- **No "utility" layers over trivial operations.** `document.getElementById` does not need a wrapper. `fetch` does not need a client class until it does.
- **Prefer functions over classes** unless state genuinely needs encapsulation.
- **If a change can be made in 10 lines or 50, make it in 10** — unless the 50-line version is meaningfully clearer or safer.

When in doubt, ask before adding structure. It's easier to add abstraction later than to remove it.

## Match existing patterns

Before writing new code, read nearby files and follow their conventions:

- Naming (camelCase vs snake_case, file naming, function naming).
- File organization (where similar code already lives — put new code there).
- How existing code handles errors, async work, DOM access, Sheets API calls, and auth.
- Existing helpers — use them. Don't create a parallel second version of something that already exists.

If the existing pattern is genuinely bad, flag it and ask before deviating. Don't silently introduce a competing style.

## JavaScript (frontend) standards

- Modern vanilla JS (ES2020+). `const`/`let`, no `var`. Arrow functions where they read naturally; named functions for anything non-trivial.
- `async`/`await` over `.then()` chains.
- No jQuery, no Lodash, no utility libraries. Native browser APIs only.
- DOM access: cache references when reused in the same scope; don't cache globally "just in case."
- Event listeners: remove them when the element is removed or the handler is no longer needed (prevents leaks in long-lived pages).
- Guard against missing DOM elements (`if (!el) return;`) rather than letting `null.addEventListener` crash.
- Keep files focused. If one file is growing past a few hundred lines and covers multiple concerns, split it along concern lines — not into arbitrary "utils" dumps.

## Apps Script (backend) standards

- Server functions should be small and do one thing. The mentor-matching logic is the exception; keep its scoring stages clearly separated and commented.
- Use `SpreadsheetApp` / `UrlFetchApp` idiomatically; don't invent wrappers around them.
- Log with `console.log` / `Logger.log` during development; remove noisy logs before merging.
- Quota-aware: batch Sheets reads/writes where possible. A single `getValues()` beats a loop of `getValue()` calls.
- Never commit API keys, OAuth client secrets, or service account credentials. Use Script Properties.

## Sheets API usage

- Batch operations: prefer `values.batchGet` / `values.batchUpdate` over repeated single-range calls.
- Treat the sheet as the source of truth; don't maintain a parallel cache on the client unless there's a measured need.
- When reading structured data, document the expected column layout in a comment near the read — sheet schemas drift, and future-me will need to know what column D was supposed to be.

## Auth (Google Identity Services)

- Use `google.accounts.oauth2` token flow as already established — don't introduce a second auth path.
- Handle token expiry explicitly. Don't assume a token is valid; check and refresh.
- Never log tokens.

## Error handling

- Fail loudly during development, gracefully in production.
- No empty `catch {}` blocks. If you're catching, either handle the error meaningfully or re-throw with context.
- User-facing errors should be actionable ("Couldn't load mentor list — check your connection and retry") not raw exception messages.

## Encapsulation (in the spirit of "don't over-engineer")

- Keep module internals private by not exporting them. Don't reach into another file's internals; if you need something, expose it deliberately.
- State that belongs together lives together. Don't scatter related data across globals.
- That said: **don't build encapsulation scaffolding for its own sake.** A module-level `const state = {}` with a few functions that operate on it is fine. You don't need a class, a getter/setter pair, or a "manager."

## Comments

- Comments explain *why*, not *what*. Code shows what.
- Document non-obvious Sheets column layouts, scoring weights, and any workaround for Apps Script quirks.
- Remove commented-out code before committing. Git has history.

## When making changes

1. Read the surrounding code first.
2. Prefer editing existing files over creating new ones.
3. Make the smallest change that solves the problem.
4. If a task seems to require a new file, new dependency, or new abstraction, pause and confirm before proceeding.
5. Don't reformat or "clean up" unrelated code in the same change — it makes diffs unreviewable.

## What to ask before doing

- Adding any external dependency or CDN script.
- Introducing a build step or tooling.
- Creating a new top-level module or file.
- Changing the Sheets schema.
- Refactoring something that isn't broken.
