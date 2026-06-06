import { devLogStore } from "@/lib/dev-log-store";

export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const encode = (entry: unknown) =>
        encoder.encode(`data: ${JSON.stringify(entry)}\n\n`);

      // replay buffered entries so the panel shows requests from the current page load
      for (const entry of devLogStore.getBuffer()) {
        controller.enqueue(encode(entry));
      }

      unsubscribe = devLogStore.subscribe((entry) => {
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
