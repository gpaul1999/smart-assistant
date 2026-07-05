---
name: playwright-e2e
description: Drive a real browser for end-to-end (E2E) testing and UI automation via the Playwright MCP server, and capture screenshots as evidence. Use when the user asks to run E2E tests, automate a browser flow (navigate/click/fill/login), verify a feature in a live browser, or take/save screenshots of a page or a UI state.
---

# Playwright E2E & Browser Automation (via Playwright MCP)

Use the **Playwright MCP** server (`@playwright/mcp`) to drive a real browser: navigate,
interact, assert UI state, and capture screenshots. Prefer this over ad-hoc scripts when the
user wants live browser testing or visual evidence.

## When to use
- "Run E2E tests", "test this flow end-to-end", "automate logging in and …".
- "Verify it works in the browser", "click through the app and check X".
- "Take a screenshot of …", "capture the page after …".

## Setup (once per project/machine)
Add the MCP server to Claude Code (pinned version for reproducibility):
```bash
claude mcp add playwright npx @playwright/mcp@0.0.77
```
Or add to the MCP config JSON:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@0.0.77"]
    }
  }
}
```
Useful args (append after `@playwright/mcp@0.0.77`): `--headless` (CI/no display),
`--isolated` (in-memory profile, don't persist), `--output-dir <dir>` (where screenshots/files go),
`--caps vision,pdf,network` (enable extra capabilities).

## Core workflow
1. **Navigate**: `browser_navigate` to the target URL.
2. **Drive the page using `browser_snapshot`** (accessibility snapshot) — this is what you act on.
   Do NOT plan clicks off a screenshot; use the snapshot's element refs. Then `browser_click`,
   `browser_type`, `browser_fill_form` as needed.
3. **Wait** for async UI with `browser_wait_for` before asserting.
4. **Assert** the expected state from the snapshot (text/elements present).
5. **Capture evidence**: `browser_take_screenshot` at key steps / final state. Save to
   `--output-dir` and report the paths back to the user.

## Key tools
| Tool | Use |
|------|-----|
| `browser_navigate` | Open a URL |
| `browser_snapshot` | Accessibility snapshot — **use this to decide/perform actions** |
| `browser_click` / `browser_type` / `browser_fill_form` | Interact |
| `browser_wait_for` | Wait for text/state (avoid flaky asserts) |
| `browser_take_screenshot` | **Capture screenshot as evidence** (not for driving actions) |
| `browser_evaluate` | Run JS in page for advanced checks |

## Rules
- `browser_snapshot` drives actions; `browser_take_screenshot` is only for visual evidence.
- Use `--headless` in CI; headed is fine locally for debugging.
- Always surface saved screenshot paths so the user can view them.
- Keep automation scoped to what the user asked — don't crawl unrelated pages.
