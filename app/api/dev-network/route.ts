import { headers } from "next/headers";
import { devLogStore } from "@/lib/dev-log-store";

export const dynamic = "force-dynamic";

export async function GET() {
  // Middleware sets x-dev-sid on every request from the same browser session,
  // so each client only receives its own server-side fetches.
  const sessionId = (await headers()).get("x-dev-sid");

  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const encode = (entry: unknown) =>
        encoder.encode(`data: ${JSON.stringify(entry)}\n\n`);

      for (const entry of devLogStore.getBuffer()) {
        if (entry.sessionId === sessionId) controller.enqueue(encode(entry));
      }

      unsubscribe = devLogStore.subscribe((entry) => {
        if (entry.sessionId !== sessionId) return;
        try {
          controller.enqueue(encode(entry));
        } catch {
          // client disconnected mid-write; cancel handles cleanup
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
