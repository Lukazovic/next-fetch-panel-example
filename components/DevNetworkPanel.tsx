"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type LogEntry = {
  id: string;
  url: string;
  method: string;
  status: number | null;
  statusText: string | null;
  duration: number;
  ts: number;
  error?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
};

const MAX_ENTRIES = 100;

const METHOD_COLORS: Record<string, string> = {
  GET: "text-blue-400",
  POST: "text-violet-400",
  PUT: "text-orange-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
};

function methodClass(method: string) {
  return METHOD_COLORS[method] ?? "text-slate-400";
}

function statusClass(status: number | null, error?: string) {
  if (error || status === null) return "text-red-400";
  if (status < 300) return "text-green-400";
  if (status < 400) return "text-amber-400";
  return "text-red-400";
}

function durationBarColor(ms: number) {
  if (ms < 200) return "bg-green-500";
  if (ms < 1000) return "bg-amber-500";
  return "bg-red-500";
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function tryPrettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeaderList({ headers }: { headers: Record<string, string> | undefined | null }) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0)
    return <p className="text-muted-foreground text-[11px]">No headers</p>;
  return (
    <div className="flex flex-col divide-y divide-border">
      {entries.map(([k, v]) => (
        <div key={k} className="py-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{k}</p>
          <p className="text-[11px] text-foreground break-all leading-relaxed">{v}</p>
        </div>
      ))}
    </div>
  );
}

function BodyViewer({
  body,
  contentType,
  emptyLabel,
}: {
  body: string | null | undefined;
  contentType: string | null;
  emptyLabel: string;
}) {
  if (!body)
    return <p className="text-muted-foreground text-[11px]">{emptyLabel}</p>;
  const isJson =
    contentType?.includes("json") ||
    body.trimStart().startsWith("{") ||
    body.trimStart().startsWith("[");
  return (
    <pre className="text-[11px] text-foreground whitespace-pre-wrap break-all leading-relaxed">
      {isJson ? tryPrettyJson(body) : body}
    </pre>
  );
}

function DetailPanel({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  let pathname = entry.url;
  try { pathname = new URL(entry.url).pathname; } catch { /* keep full url */ }

  return (
    <div className="w-75 shrink-0 border-l border-border flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-2.5 py-1.5 gap-2">
        <span className="truncate text-[11px] font-semibold text-foreground" title={entry.url}>
          {pathname}
        </span>
        <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* tabs */}
      <Tabs defaultValue="general" className="flex flex-col flex-1 overflow-hidden gap-0">
        <TabsList
          variant="line"
          className="shrink-0 w-full justify-start rounded-none border-b border-border bg-transparent h-auto px-1 overflow-x-auto scrollbar-none"
        >
          {(["general", "headers", "payload", "response"] as const).map((v) => (
            <TabsTrigger key={v} value={v} className="text-[11px] capitalize px-2.5 py-1.5">
              {v}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-hidden min-h-0">
          <TabsContent value="general" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-3 p-3 text-[11px]">
                {[
                  ["Request URL",   entry.url],
                  ["Request Method", entry.method],
                  ["Status Code",   entry.status != null ? `${entry.status}${entry.statusText ? " " + entry.statusText : ""}` : "—"],
                  ["Started at",    formatTs(entry.ts)],
                  ["Duration",      `${entry.duration}ms`],
                  ...(entry.error ? [["Error", entry.error]] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-muted-foreground mb-0.5">{label}</p>
                    <p className={cn(
                      "break-all leading-relaxed",
                      label === "Status Code" ? statusClass(entry.status, entry.error) :
                      label === "Error"       ? "text-red-400" : "text-foreground"
                    )}>
                      {value}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="text-muted-foreground mb-1.5">Duration bar</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", durationBarColor(entry.duration))}
                      style={{ width: `${Math.min((entry.duration / 2000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">scale: 0–2000ms</p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="headers" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-3">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Response Headers</p>
                  <HeaderList headers={entry.responseHeaders} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Request Headers</p>
                  <HeaderList headers={entry.requestHeaders} />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="payload" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                <BodyViewer
                  body={entry.requestBody}
                  contentType={entry.requestHeaders?.["content-type"] ?? null}
                  emptyLabel="No request body"
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="response" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                <BodyViewer
                  body={entry.responseBody}
                  contentType={entry.responseHeaders?.["content-type"] ?? null}
                  emptyLabel="No response body"
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

function Panel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/dev-network");
    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setEntries((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
        });
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (open && !selected) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, open, selected]);

  return (
    <div className="dark text-foreground">
      {open && (
        <div
          className="fixed bottom-14 right-4 z-9998 flex flex-col rounded-lg border border-border bg-card font-mono text-xs shadow-2xl transition-[width] duration-150"
          style={{ width: selected ? 820 : 540, height: 420 }}
        >
          {/* toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
            <span className="font-semibold text-foreground">
              Server Network
              {entries.length > 0 && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {entries.length} requests
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => { setEntries([]); setSelected(null); }}
            >
              Clear
            </Button>
          </div>

          {/* body */}
          <div className="flex flex-1 overflow-hidden">
            {/* table */}
            <ScrollArea className="flex-1 min-w-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-card border-b border-border">
                    {[
                      { label: "Method",   cls: "w-[58px] text-left"  },
                      { label: "Status",   cls: "w-[52px] text-left"  },
                      { label: "URL",      cls: "text-left"           },
                      { label: "Duration", cls: "w-[68px] text-right" },
                    ].map(({ label, cls }) => (
                      <th key={label} className={cn("px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap", cls)}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No requests yet
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const isSelected = selected?.id === entry.id;
                      return (
                        <tr
                          key={entry.id}
                          title={entry.error}
                          onClick={() => setSelected(isSelected ? null : entry)}
                          className={cn(
                            "cursor-pointer border-b border-border transition-colors",
                            isSelected
                              ? "bg-primary/15"
                              : entry.error
                              ? "bg-destructive/5 hover:bg-destructive/10"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <td className="px-2.5 py-1.25 whitespace-nowrap">
                            <span className={cn("font-semibold text-[11px]", methodClass(entry.method))}>
                              {entry.method}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.25 whitespace-nowrap">
                            <span className={cn("font-semibold", statusClass(entry.status, entry.error))}>
                              {entry.status ?? "ERR"}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.25 max-w-50 overflow-hidden text-ellipsis whitespace-nowrap text-foreground/80">
                            {entry.url}
                          </td>
                          <td className="px-2.5 py-1.25 text-right whitespace-nowrap text-muted-foreground">
                            {entry.duration}ms
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div ref={bottomRef} />
            </ScrollArea>

            {selected && (
              <DetailPanel entry={selected} onClose={() => setSelected(null)} />
            )}
          </div>
        </div>
      )}

      {/* toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-9999 font-mono gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={entries.length > 0 ? "text-green-500" : "text-muted-foreground"}>●</span>
        Server Network
        {entries.length > 0 && (
          <Badge variant="secondary" className="ml-0.5 tabular-nums">
            {entries.length}
          </Badge>
        )}
      </Button>
    </div>
  );
}

export default function DevNetworkPanel() {
  return <Panel />;
}
