export async function register() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const { devLogStore } = await import("./lib/dev-log-store");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    const ts = Date.now();
    const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;

    let status: number | null = null;
    let error: string | undefined;
    const start = performance.now();

    try {
      const response = await originalFetch(input, init);
      status = response.status;
      return response;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Math.round(performance.now() - start);
      devLogStore.push({ id, url, method, status, duration, ts, error });
    }
  };
}
