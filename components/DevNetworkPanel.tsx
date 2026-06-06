"use client";

import { useEffect, useRef, useState } from "react";

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

type DetailTab = "general" | "headers" | "payload" | "response";

const MAX_ENTRIES = 100;

function statusColor(status: number | null, error?: string) {
  if (error || status === null) return "#ef4444";
  if (status < 300) return "#22c55e";
  if (status < 400) return "#f59e0b";
  return "#ef4444";
}

function methodColor(method: string) {
  switch (method) {
    case "GET":    return "#60a5fa";
    case "POST":   return "#a78bfa";
    case "PUT":
    case "PATCH":  return "#fb923c";
    case "DELETE": return "#f87171";
    default:       return "#94a3b8";
  }
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
}

export default function DevNetworkPanel() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Panel />;
}

// ─── Detail panel ───────────────────────────────────────────────────────────

function HeaderTable({ headers }: { headers: Record<string, string> | undefined | null }) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0)
    return <p style={{ color: "#475569", fontSize: "11px", padding: "4px 0" }}>No headers</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: "1px solid #1e293b" }}>
            <td
              style={{
                padding: "4px 8px 4px 0",
                color: "#94a3b8",
                fontWeight: 600,
                whiteSpace: "nowrap",
                verticalAlign: "top",
                width: "40%",
                wordBreak: "break-all",
              }}
            >
              {k}
            </td>
            <td style={{ padding: "4px 0", color: "#cbd5e1", wordBreak: "break-all" }}>
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tryPrettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
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
  if (!body) {
    return <p style={{ color: "#475569", fontSize: "11px", padding: "4px 0" }}>{emptyLabel}</p>;
  }

  const isJson = contentType?.includes("json") || (body.trimStart().startsWith("{") || body.trimStart().startsWith("["));
  const displayed = isJson ? tryPrettyJson(body) : body;

  return (
    <pre
      style={{
        margin: 0,
        padding: 0,
        color: "#cbd5e1",
        fontSize: "11px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        lineHeight: 1.6,
        maxHeight: "300px",
        overflowY: "auto",
      }}
    >
      {displayed}
    </pre>
  );
}

function DetailPanel({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>("general");

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "general",  label: "General"  },
    { id: "headers",  label: "Headers"  },
    { id: "payload",  label: "Payload"  },
    { id: "response", label: "Response" },
  ];

  return (
    <div
      style={{
        width: "300px",
        flexShrink: 0,
        borderLeft: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* detail header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "#e2e8f0",
            fontSize: "11px",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={entry.url}
        >
          {new URL(entry.url).pathname}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              color: tab === t.id ? "#e2e8f0" : "#64748b",
              cursor: "pointer",
              fontSize: "11px",
              padding: "6px 10px",
              fontFamily: "monospace",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div style={{ overflowY: "auto", flex: 1, padding: "10px 12px", fontSize: "11px", fontFamily: "monospace" }}>
        {tab === "payload" && (
          <BodyViewer
            body={entry.requestBody}
            contentType={entry.requestHeaders?.["content-type"] ?? null}
            emptyLabel="No request body"
          />
        )}

        {tab === "response" && (
          <BodyViewer
            body={entry.responseBody}
            contentType={entry.responseHeaders?.["content-type"] ?? null}
            emptyLabel="No response body"
          />
        )}

        {tab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              ["Request URL",    entry.url],
              ["Request Method", entry.method],
              ["Status Code",    entry.status != null ? `${entry.status}${entry.statusText ? " " + entry.statusText : ""}` : "—"],
              ["Started at",     formatTs(entry.ts)],
              ["Duration",       `${entry.duration}ms`],
              ...(entry.error ? [["Error", entry.error]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ color: "#475569", marginBottom: "2px" }}>{label}</div>
                <div
                  style={{
                    color: label === "Status Code"
                      ? statusColor(entry.status, entry.error)
                      : label === "Error" ? "#ef4444" : "#cbd5e1",
                    wordBreak: "break-all",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
            <div style={{ marginTop: "4px" }}>
              <div style={{ color: "#475569", marginBottom: "6px" }}>Duration bar</div>
              <div style={{ height: "6px", background: "#1e293b", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min((entry.duration / 2000) * 100, 100)}%`,
                    background: entry.duration < 200 ? "#22c55e" : entry.duration < 1000 ? "#f59e0b" : "#ef4444",
                    borderRadius: "3px",
                  }}
                />
              </div>
              <p style={{ color: "#334155", fontSize: "10px", marginTop: "4px" }}>scale: 0–2000ms</p>
            </div>
          </div>
        )}

        {tab === "headers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <p style={{ color: "#475569", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px" }}>
                Response Headers
              </p>
              <HeaderTable headers={entry.responseHeaders} />
            </div>
            <div>
              <p style={{ color: "#475569", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px" }}>
                Request Headers
              </p>
              <HeaderTable headers={entry.requestHeaders} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────

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
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
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

  const panelWidth = selected ? 820 : 540;

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "52px",
            right: "16px",
            width: `${panelWidth}px`,
            maxHeight: "420px",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9998,
            fontFamily: "monospace",
            fontSize: "12px",
            transition: "width 0.15s ease",
          }}
        >
          {/* toolbar */}
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "12px" }}>
              SSR Network
              {entries.length > 0 && (
                <span style={{ color: "#475569", fontWeight: 400, marginLeft: "6px" }}>
                  {entries.length} requests
                </span>
              )}
            </span>
            <button
              onClick={() => { setEntries([]); setSelected(null); }}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "11px", padding: "2px 6px" }}
            >
              clear
            </button>
          </div>

          {/* body */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* table */}
            <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "#0f172a", borderBottom: "1px solid #334155", zIndex: 1 }}>
                    {[
                      { label: "Method",   width: "58px",  align: "left"  },
                      { label: "Status",   width: "50px",  align: "left"  },
                      { label: "URL",      width: undefined, align: "left" },
                      { label: "Duration", width: "68px",  align: "right" },
                    ].map(({ label, width, align }) => (
                      <th
                        key={label}
                        style={{
                          padding: "5px 10px",
                          textAlign: align as "left" | "right",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                          width,
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#475569" }}>
                        No requests yet
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const isSelected = selected?.id === entry.id;
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setSelected(isSelected ? null : entry)}
                          title={entry.error}
                          style={{
                            borderBottom: "1px solid #1e293b",
                            background: isSelected
                              ? "#1e3a5f"
                              : entry.error
                              ? "rgba(239,68,68,0.05)"
                              : "transparent",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "#1e293b";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background =
                              entry.error ? "rgba(239,68,68,0.05)" : "transparent";
                          }}
                        >
                          <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                            <span style={{ color: methodColor(entry.method), fontWeight: 600, fontSize: "11px" }}>
                              {entry.method}
                            </span>
                          </td>
                          <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                            <span style={{ color: statusColor(entry.status, entry.error), fontWeight: 600 }}>
                              {entry.status ?? "ERR"}
                            </span>
                          </td>
                          <td style={{ padding: "5px 10px", color: "#cbd5e1", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.url}
                          </td>
                          <td style={{ padding: "5px 10px", color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>
                            {entry.duration}ms
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div ref={bottomRef} />
            </div>

            {selected && (
              <DetailPanel entry={selected} onClose={() => setSelected(null)} />
            )}
          </div>
        </div>
      )}

      {/* toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 9999,
          background: open ? "#1e293b" : "#0f172a",
          border: "1px solid #334155",
          borderRadius: "6px",
          color: "#e2e8f0",
          cursor: "pointer",
          padding: "6px 12px",
          fontFamily: "monospace",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ color: entries.length > 0 ? "#22c55e" : "#475569" }}>●</span>
        SSR Network
        {entries.length > 0 && (
          <span style={{ background: "#1d4ed8", borderRadius: "10px", padding: "1px 6px", fontSize: "10px" }}>
            {entries.length}
          </span>
        )}
      </button>
    </>
  );
}
