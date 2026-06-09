# Server Network Panel — Integration Guide

A real-time DevTools panel that intercepts all server-side `fetch()` calls in a Next.js App Router application and streams them to a floating panel in the browser. Each browser session only sees its own requests, so it is safe to run in shared environments like staging.

---

## Requirements

- Next.js 15 or 16 (App Router)
- React 19
- Node.js runtime (not Edge)

### Peer dependencies

```bash
npm install @base-ui/react react-resizable-panels lucide-react \
            class-variance-authority clsx tailwind-merge
```

You also need the shadcn UI components the panel uses. If your project already runs shadcn, add:

```bash
npx shadcn@latest add button badge dialog sheet tabs scroll-area separator label
```

Then add the `resizable` component manually or via shadcn if available in your version.

---

## Installation

Copy the `server-network-panel/` folder into your project root:

```
your-project/
├── server-network-panel/   ← drop it here
├── app/
├── components/
└── ...
```

Add the `@/server-network-panel` path alias to your `tsconfig.json` if it is not already covered by `@/*`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Wiring it up

There are four integration points. Each one has a **simple form** (one line, nothing else needed) and a **composable form** (for projects that already have logic in those files).

---

### 1. `instrumentation.ts` — fetch interception

The panel patches `globalThis.fetch` at server startup to capture every outgoing request.

**Simple** — nothing else in your `instrumentation.ts`:

```ts
// instrumentation.ts
export { register } from "./server-network-panel/patch";
```

**Composable** — you already have setup code (OpenTelemetry, custom logging, etc.):

```ts
// instrumentation.ts
import { registerDevPanel } from "./server-network-panel/patch";
import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel("my-app");   // your existing setup
  await registerDevPanel(); // add the panel
}
```

`registerDevPanel` is async and safe to call in any order. It skips itself when `NEXT_RUNTIME !== "nodejs"` so it never runs in Edge contexts.

---

### 2. `middleware.ts` — session isolation

The panel assigns each browser a session ID so users only see their own requests. This is done by reading or creating a `__dev_sid` cookie and forwarding it as the `x-dev-sid` request header.

**Simple** — no other middleware:

```ts
// middleware.ts
export { middleware, config } from "./server-network-panel/middleware";
```

**Composable** — you already have middleware (auth, i18n, redirects, etc.):

```ts
// middleware.ts
import { withDevPanel } from "./server-network-panel/middleware";

export const { middleware, config } = withDevPanel(async (request) => {
  // Return a Response to short-circuit the request.
  // Return nothing (undefined/void) to let it continue normally.
  if (!request.cookies.has("auth-token"))
    return NextResponse.redirect(new URL("/login", request.url));
});
```

`withDevPanel` always handles the `NextResponse.next()` call internally — you only need to return a response when you want to block or redirect.

**Custom matcher** — if your project already defines a matcher:

```ts
export const { middleware, config } = withDevPanel(handler, {
  matcher: ["/app/:path*", "/((?!_next|favicon).*)"],
});
```

**How session forwarding works under the hood**

`withDevPanel` creates `NextResponse.next({ request: { headers: modifiedHeaders } })` with the session ID attached. This makes `headers()` from `next/headers` expose `x-dev-sid` throughout the entire request's async context — including inside the `globalThis.fetch` patch — so every server-side fetch call is automatically tagged with the current user's session without any changes to your page code.

---

### 3. `app/api/dev-network/route.ts` — SSE stream

The browser connects to this endpoint to receive the captured requests in real time.

**Simple** — no access control needed:

```ts
// app/api/dev-network/route.ts
export { dynamic, GET } from "@/server-network-panel/route";
```

**Composable** — restrict access (recommended for staging):

```ts
// app/api/dev-network/route.ts
import { createDevPanelRoute } from "@/server-network-panel/route";

export const dynamic = "force-dynamic";
export const GET = createDevPanelRoute({
  guard: (request) => {
    // Return a Response to block. Return nothing to allow.
    const token = request.headers.get("authorization");
    if (!isValidAdminToken(token))
      return new Response("Forbidden", { status: 403 });
  },
});
```

The `guard` runs before the SSE stream opens. Blocking it with a non-2xx response prevents the panel from connecting at all.

---

### 4. `app/layout.tsx` — panel component

Add `<DevNetworkPanel />` anywhere inside your root layout's `<body>`. It renders nothing until the user clicks the toggle button.

```tsx
// app/layout.tsx
import { DevNetworkPanel } from "@/server-network-panel";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <DevNetworkPanel />
      </body>
    </html>
  );
}
```

---

## Redacting secrets

By default the panel redacts common secret patterns before they are stored or sent to the browser. Edit `server-network-panel/redact.ts` to customize the lists:

```ts
export const redactConfig = {
  // Query param names whose values are replaced with [REDACTED]
  urlParams: ["api_key", "apikey", "secret", "token", "access_token", "password", "key"],

  // Header names (case-insensitive) whose values are replaced
  headers: ["authorization", "x-api-key", "x-secret", "x-auth-token"],

  // Top-level JSON body keys whose values are replaced
  bodyKeys: ["password", "secret", "token", "api_key", "apiKey", "accessToken", "access_token"],
};
```

The actual HTTP request is never modified — only the copy kept for display.

---

## Using axios

By default axios in Node.js uses the `http`/`https` modules and bypasses the `globalThis.fetch` patch. To make axios requests appear in the panel, create your axios instance with `adapter: "fetch"` (requires axios ≥ 1.7):

```ts
import axios from "axios";

const http = axios.create({ adapter: "fetch" });

// Requests made with `http` will appear in the panel.
const { data } = await http.get("https://api.example.com/users");
```

Instances created without the adapter will not be captured.

---

## Security notes

| Concern | How it is handled |
|---|---|
| User A seeing User B's requests | Each browser session gets a unique `__dev_sid` cookie. The SSE stream filters strictly by session ID. |
| Panel accessible to anyone | Use the `guard` option on `createDevPanelRoute` to require a valid token or admin role before the SSE stream opens. |
| Secrets leaking to the browser | Configured patterns in `redact.ts` are replaced with `[REDACTED]` before entries ever reach the store. |
| Running in production | There is no `NODE_ENV` gate — add one in `registerDevPanel` or behind a feature flag if you want to disable it in production. |

---

## Quick-reference: all public exports

```ts
import {
  DevNetworkPanel,    // React component — place in your layout
  withDevPanel,       // Middleware composer
  registerDevPanel,   // Call inside your register() function
  createDevPanelRoute,// Route handler factory with optional guard
} from "@/server-network-panel";

import type { LogEntry } from "@/server-network-panel";
```
