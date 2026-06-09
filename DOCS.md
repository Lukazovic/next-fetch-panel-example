# Server Network Panel — Documentation

A real-time browser debug panel that intercepts all server-side `fetch()` calls in a Next.js App Router application and streams them live to a floating DevTools-style panel in the browser.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [File Structure](#file-structure)
- [Panel UI](#panel-ui)
- [Configuration](#configuration)
- [Technical Notes & Gotchas](#technical-notes--gotchas)

---

## Overview

Next.js Server Components and Route Handlers run `fetch()` on the server — invisible to browser DevTools. This panel solves that by:

1. Patching `globalThis.fetch` at server startup to record every outgoing request
2. Streaming those records to the browser via Server-Sent Events (SSE)
3. Rendering them in a floating panel overlaid on the running app

The panel is always enabled (no `NODE_ENV` gate) so it can be used in any environment where you need visibility into server-side network activity.

---

## Architecture

```
Browser (request)
│
└── middleware.ts                ← runs on every request
         │
         ├── reads/creates __dev_sid session cookie
         └── forwards it as x-dev-sid request header

Server (Node.js runtime)
│
├── instrumentation.ts          ← patches globalThis.fetch on startup
│        │
│        ├── reads x-dev-sid via headers() from the current request ALS context
│        └──▶ lib/dev-log-store.ts   ← singleton pub/sub + 100-entry ring buffer
│                                        entries tagged with sessionId
│                                        (stored on globalThis to survive HMR)
│
└── app/api/dev-network/route.ts ← SSE endpoint (session-scoped)
         │
         ├── reads x-dev-sid from its own request headers
         ├── replays only buffer entries matching sessionId
         └── streams only new entries matching sessionId

Browser (Client)
│
└── components/DevNetworkPanel.tsx  ← "use client" floating panel
         │
         ├── EventSource → /api/dev-network  (browser sends __dev_sid cookie automatically)
         ├── Renders entries in a resizable table
         ├── Click-to-inspect detail pane (General / Headers / Payload / Response)
         └── localStorage-persisted settings
```

---

## How It Works

### 1. Fetch Interception (`instrumentation.ts`)

Next.js calls `register()` from `instrumentation.ts` once at server startup. The function:

- Runs only in the `nodejs` runtime (skips Edge)
- Replaces `globalThis.fetch` with a wrapper that:
  - Captures method, URL, request headers, and request body (up to 50 KB)
  - Awaits the original fetch, then **clones** the response to read the body asynchronously without consuming the original stream
  - Records status, status text, response headers, response body (up to 50 KB), and duration
  - On network error: records the error message and pushes a partial entry
  - Pushes the completed `LogEntry` to `devLogStore`

Request body capture supports strings, `URLSearchParams`, and falls back to `"[binary]"` for other types.

### 2. Singleton Store (`lib/dev-log-store.ts`)

The store lives on `globalThis.__devLogStore` so it survives Next.js hot-reload (which re-imports modules but reuses the same Node.js process).

```ts
type LogEntry = {
  id: string;            // `${timestamp}-${random}`
  url: string;
  method: string;
  status: number | null;
  statusText: string | null;
  duration: number;      // milliseconds
  ts: number;            // Date.now() at request start
  error?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
};
```

The store keeps a ring buffer of the last 100 entries and notifies all subscribers on `push()`.

### 3. SSE Endpoint (`app/api/dev-network/route.ts`)

`GET /api/dev-network` is a `force-dynamic` route that:

1. Opens a `ReadableStream`
2. **Replays** all buffered entries immediately on connect — this ensures requests that happened before the browser's `EventSource` opened are not lost
3. Subscribes to the store and streams new entries as `data: <json>\n\n` SSE frames
4. Unsubscribes when the client disconnects (`cancel()`)

### 4. Session Isolation (`middleware.ts` + `x-dev-sid` header)

Every browser session gets a unique ID (`__dev_sid` cookie, generated on first visit and valid for one year). Middleware runs on every request, reads or creates this cookie, and **forwards it as the `x-dev-sid` request header**. Forwarding it as a header (rather than relying only on the cookie) is necessary because:

- `headers()` from `next/headers` reads the **incoming request headers**, which include the forwarded `x-dev-sid` — this is available immediately, even on the very first page load before the `Set-Cookie` response is sent back.
- Our patched `globalThis.fetch` runs in the same async context as the Server Component that called it. Because Next.js propagates its request context via `AsyncLocalStorage`, `headers()` works inside the patch, letting us read `x-dev-sid` and tag every `LogEntry` with `sessionId`.
- The SSE endpoint at `/api/dev-network` also goes through middleware, so its own request has `x-dev-sid` set. The endpoint reads this header and only replays/streams entries whose `sessionId` matches the connecting client.

The result: each browser sees only the server-side fetches it triggered, even in a multi-user environment.

### 5. Client Panel (`components/DevNetworkPanel.tsx`)

A `"use client"` component rendered unconditionally inside `RootLayout`. On mount it:

- Opens an `EventSource` to `/api/dev-network`
- Parses incoming entries and stores them in local state (capped at 100)
- Renders the panel UI when the user clicks the toggle button

---

## File Structure

The panel logic lives entirely in `server-network-panel/`. The four app-level files that integrate it are one-line re-exports.

```
server-network-panel/        ← self-contained library folder
  index.ts                   Public API: exports DevNetworkPanel + LogEntry type
  store.ts                   Singleton pub/sub store + 100-entry ring buffer
  redact.ts                  Configurable secret redaction
  patch.ts                   globalThis.fetch patch + register() export
  middleware.ts              Browser-session cookie + x-dev-sid header logic
  route.ts                   SSE streaming route handler (session-scoped)
  Panel.tsx                  "use client" floating panel component

── Integration (thin wrappers) ──────────────────────────────────────────────

instrumentation.ts           export { register } from "./server-network-panel/patch"
middleware.ts                export { middleware, config } from "./server-network-panel/middleware"
app/api/dev-network/route.ts export { dynamic, GET } from "@/server-network-panel/route"
app/layout.tsx               import { DevNetworkPanel } from "@/server-network-panel"

── App pages ────────────────────────────────────────────────────────────────

app/
  page.tsx                   Hub page with links to /posts and /users
  posts/page.tsx             SSR-paginated posts (native fetch, api_key redaction example)
  users/page.tsx             SSR-sorted users (axios with fetch adapter)

── shadcn UI primitives (peer dependency of Panel.tsx) ──────────────────────

components/ui/
  button.tsx                 shadcn Button (cursor-pointer added)
  badge.tsx                  shadcn Badge
  dialog.tsx                 shadcn Dialog (z-index raised to z-10000)
  sheet.tsx                  shadcn Sheet (showOverlay prop added)
  tabs.tsx                   shadcn Tabs (cursor-pointer added)
  scroll-area.tsx            shadcn ScrollArea
  separator.tsx              shadcn Separator
  label.tsx                  shadcn Label
  resizable.tsx              shadcn Resizable (react-resizable-panels v4)
```

### Adding the panel to a new Next.js app

1. Copy the `server-network-panel/` folder into the project root.
2. Add these four wires — each has a simple one-liner for new projects and a composable form for projects that already have logic in those files:

#### `instrumentation.ts`

```ts
// Simple — nothing else in register():
export { register } from "./server-network-panel/patch";

// Composing with existing setup (e.g. OpenTelemetry):
import { registerDevPanel } from "./server-network-panel/patch";
import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel("my-app");
  await registerDevPanel();
}
```

#### `middleware.ts`

```ts
// Simple — no other middleware logic:
export { middleware, config } from "./server-network-panel/middleware";

// Composing with existing logic (auth, i18n, etc.):
import { withDevPanel } from "./server-network-panel/middleware";

export const { middleware, config } = withDevPanel(async (request) => {
  // Return a Response to short-circuit. Return nothing to continue normally.
  if (!isAuthenticated(request))
    return NextResponse.redirect(new URL("/login", request.url));
});

// Custom matcher:
export const { middleware, config } = withDevPanel(handler, {
  matcher: ["/api/:path*", "/((?!_next).*)"],
});
```

#### `app/api/dev-network/route.ts`

```ts
// Simple — no access control:
export { dynamic, GET } from "@/server-network-panel/route";

// With authentication (guard runs before the SSE stream opens):
import { createDevPanelRoute } from "@/server-network-panel/route";

export const dynamic = "force-dynamic";
export const GET = createDevPanelRoute({
  guard: (request) => {
    const token = request.headers.get("authorization");
    if (!isValidToken(token)) return new Response("Forbidden", { status: 403 });
  },
});
```

#### `app/layout.tsx`

```tsx
import { DevNetworkPanel } from "@/server-network-panel";
// Place <DevNetworkPanel /> wherever makes sense inside your layout's <body>.
```

3. Install peer dependencies: `react-resizable-panels`, `@base-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.
4. Add the shadcn UI components listed above (or run `npx shadcn@latest add` for each).

### How each composable function works

| Function | File | Composable form | Simple form |
|---|---|---|---|
| `registerDevPanel()` | `patch.ts` | Call inside your own `register()` | `export { register }` |
| `withDevPanel(handler?, opts?)` | `middleware.ts` | Pass your logic as `handler` | `export { middleware, config }` |
| `createDevPanelRoute(opts?)` | `route.ts` | Pass `guard` for access control | `export { GET, dynamic }` |
| `<DevNetworkPanel />` | `Panel.tsx` | Place anywhere in your layout | Same |

**`withDevPanel`** — `handler` receives `NextRequest`. Return a `Response` to short-circuit (redirect, block, etc.); return `undefined`/`void` to continue. `withDevPanel` always creates the `NextResponse.next()` with `x-dev-sid` forwarded — never call it yourself inside the handler.

**`createDevPanelRoute`** — `guard` receives the raw `Request`. Return a `Response` to block the SSE connection before it opens; return `undefined`/`void` to allow it.

**`registerDevPanel`** — async, safe to call alongside other setup. Skips itself if `NEXT_RUNTIME !== "nodejs"`.

---

## Panel UI

### Toggle Button

A fixed button in the bottom-right corner of the screen. Shows a green dot when entries exist and a count badge. Hides itself when the panel is open to avoid overlapping.

### Panel Modes

The panel can be rendered in two modes, configurable via Settings:

| Mode | Description |
|------|-------------|
| **Sheet** | Slides in from any edge (bottom / right / top / left) using a shadcn `Sheet` |
| **Fixed modal** | Positioned fixed at bottom-right with configurable width and height |

### Request Table

Displays all intercepted requests with columns:

| Column | Description |
|--------|-------------|
| Method | Color-coded (GET = blue, POST = violet, PUT/PATCH = orange, DELETE = red) |
| Status | Color-coded (2xx = green, 3xx = amber, 4xx/5xx/error = red) |
| URL | Truncated to available width |
| Duration | Milliseconds |

Click any row to open the detail pane. Click again to close it.

### Detail Pane

Opens to the right of the table inside a `ResizablePanelGroup`. The split is user-adjustable and persisted to `localStorage`. Four tabs:

| Tab | Contents |
|-----|----------|
| **General** | URL, method, status code, start time, duration, duration bar |
| **Headers** | Response headers stacked above request headers |
| **Payload** | Request body, auto-formatted if JSON |
| **Response** | Response body, auto-formatted if JSON |

### Toolbar

- **Server Network** label + request count
- **Settings** gear icon — opens the settings dialog
- **Clear** button — clears all entries and closes the detail pane
- **×** close button — closes the panel and shows the toggle button

---

## Configuration

All settings are persisted to `localStorage` under the key `ssr-panel-config`. Changes take effect immediately without requiring a page reload.

```ts
type PanelConfig = {
  mode: "sheet" | "fixed";
  sheetSide: "bottom" | "right" | "top" | "left";
  sheetModal: boolean;        // true = blocks page interaction
  width: number;              // px — used for fixed mode and left/right sheet
  height: number;             // px — used for fixed mode and top/bottom sheet
  colorScheme: "system" | "light" | "dark";
  detailSize: number;         // detail pane width as % of panel body (0–100)
};
```

Default values:

```ts
{
  mode: "sheet",
  sheetSide: "bottom",
  sheetModal: false,
  width: 820,
  height: 420,
  colorScheme: "system",
  detailSize: 40,
}
```

### Sheet Mode

- **Side** — which edge the sheet slides in from
- **Page interaction** — "Allow" (`modal={false}`, no backdrop, outside clicks do not close) vs "Block" (`modal={true}`, backdrop rendered, outside clicks close the sheet)
- **Height / Width** — dimension for the relevant axis (height for bottom/top, width for left/right)

### Fixed Modal Mode

- **Width** and **Height** in pixels

### Color Scheme

- `system` — follows `prefers-color-scheme` media query, updates live when the OS preference changes
- `light` / `dark` — explicit override

The `dark` class is applied directly to the panel container (Sheet, fixed div) and settings dialog because they render in portals outside the app's theme tree.

---

## Redacting Secrets

The panel redacts sensitive values before they are stored or streamed to any browser. Redaction happens in `instrumentation.ts` immediately after a response is received — the raw value is never written to the store.

### Configuration (`lib/redact.ts`)

```ts
export const redactConfig = {
  urlParams: ["api_key", "apikey", "secret", "token", "access_token", "password", "key"],
  headers:   ["authorization", "x-api-key", "x-secret", "x-auth-token"],
  bodyKeys:  ["password", "secret", "token", "api_key", "apiKey", "accessToken", "access_token"],
};
```

Edit these lists to add or remove patterns. Matching is:
- **URL params** — exact match against the query parameter name
- **Headers** — case-insensitive match against the header name
- **Body keys** — exact match against top-level JSON keys (non-JSON bodies are left untouched)

Matched values are replaced with `[REDACTED]` in the panel. The actual HTTP request is never modified — only the copy stored for display.

### Example

`app/posts/page.tsx` passes a fake API key as a URL query param:

```ts
const POSTS_API_KEY = process.env.POSTS_API_KEY ?? "super-secret-key-abc123";

await fetch(`https://…/posts?_page=1&_limit=10&api_key=${POSTS_API_KEY}`)
```

Because `api_key` is in `redactConfig.urlParams`, the panel displays:

```
GET  200  https://…/posts?_page=1&_limit=10&api_key=[REDACTED]
```

The raw URL (`…&api_key=super-secret-key-abc123`) is used for the real HTTP request but is never persisted or sent to the browser.

### Extending redaction

To redact a value that doesn't fit the three categories above (e.g., a bearer token inside a JSON response body at a nested path), add a custom transform in `redactEntry` in `lib/redact.ts`.

---

## Technical Notes & Gotchas

### Why `globalThis.__devLogStore`?

Next.js HMR re-evaluates modules on each change, creating a new store instance. Attaching the store to `globalThis` ensures there is always exactly one instance per Node.js process.

### Why buffer replay on SSE connect?

SSR fetches execute during the request lifecycle, often completing before the browser has opened the `EventSource` connection. The 100-entry buffer captures these pre-connect entries and replays them as the first frames on every new SSE connection.

### Why `app/api/dev-network` and not `app/api/__dev-network`?

Next.js treats folders prefixed with `_` as private (excluded from routing). The route must not start with an underscore.

### Why `response.clone().text().then(...)` instead of `await response.text()`?

`fetch()` response bodies are single-use streams. Reading the body would consume it, making the response unusable by the caller. `.clone()` creates an independent copy of the stream for reading, leaving the original intact.

### Portal dark mode

shadcn `Sheet` and `Dialog` render into a portal at the document root, outside any `div.dark` wrapper in the component tree. Dark mode is applied by adding the `dark` class directly to the `SheetContent` / `DialogContent` element and using semantic Tailwind tokens (`bg-background`, `text-foreground`, etc.) instead of hardcoded zinc colors.

### Hydration mismatch prevention

The `colorScheme` is read from `localStorage` during client initialization, which differs from the server-rendered value. The panel uses `useSyncExternalStore` to return `false` (not mounted) on the server and `true` on the client, so `isDark` is always `false` during SSR and only resolves to the correct value after hydration. The entire panel returns `null` until mounted, preventing any flash of incorrect theming.

### Non-modal sheet dismissal

`@base-ui/react/dialog` (which backs the shadcn `Sheet`) closes on outside click by default even when `modal={false}`. The `onOpenChange` handler is overridden to swallow close events when `sheetModal` is false, so clicks on the page do not close the panel.

### Resizable detail pane (react-resizable-panels v4)

v4 has a substantially different API from v1/v2:

- Sizes are percentages (0–100), specified as `number`
- `onLayoutChanged` fires only after a user-completed drag (not on programmatic `setLayout` calls) — this is used for saving `detailSize`
- Panel registration happens asynchronously after mount; `setLayout` is deferred with `setTimeout(0)` to ensure the detail panel is registered with the Group before the initial size is applied
- `useGroupRef` / `usePanelRef` hooks replace the old `ref` prop pattern

### Session isolation: why `x-dev-sid` header instead of just the cookie

Middleware can set cookies in the **response**, not the request. So on the very first visit, the `__dev_sid` cookie does not exist when the incoming request arrives — the middleware generates it and puts it in the response. If we relied solely on `cookies()` in the patched fetch, the first page load's server-side fetches would have no session ID.

Forwarding the session ID as an **`x-dev-sid` request header** (via `NextResponse.next({ request: { headers: ... } })`) solves this: the header exists on the incoming request from the very first visit, regardless of whether the cookie has been seen before. The SSE connection always happens after the first response is received, so by the time it opens, the cookie is already set and middleware includes `x-dev-sid` on that request too.

### Why `headers()` works inside `globalThis.fetch`

`headers()` from `next/headers` reads from Next.js's internal `RequestAsyncStorage` — a Node.js `AsyncLocalStorage` instance that is set for the duration of each request's async execution tree. Since our patched `globalThis.fetch` is just a regular async function called from within a Server Component (which runs inside that tree), the ALS context is present and `headers()` returns the current request's headers. For fetches made outside any request context (startup, background tasks), `headers()` throws and we catch it, leaving `sessionId: null`.

### Dialog z-index

The settings `Dialog` is set to `z-10000` (overlay and popup) so it always renders above the `Sheet` (`z-50`) and the fixed panel (`z-9998`) regardless of DOM order.
