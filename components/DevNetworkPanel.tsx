"use client";

import { useEffect, useRef, useState } from "react";

type LogEntry = {
  id: string;
  url: string;
  method: string;
  status: number | null;
  duration: number;
  ts: number;
  error?: string;
};

const MAX_ENTRIES = 100;

function statusColor(status: number | null, error?: string): string {
  if (error || status === null) return "#ef4444";
  if (status < 300) return "#22c55e";
  if (status < 400) return "#f59e0b";
  return "#ef4444";
}

function methodColor(method: string): string {
  switch (method) {
    case "GET":
      return "#60a5fa";
    case "POST":
      return "#a78bfa";
    case "PUT":
    case "PATCH":
      return "#fb923c";
    case "DELETE":
      return "#f87171";
    default:
      return "#94a3b8";
  }
}

export default function DevNetworkPanel() {
  if (process.env.NODE_ENV !== "development") return null;

  return <Panel />;
}

function Panel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/dev-network");

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setEntries((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_ENTRIES
            ? next.slice(next.length - MAX_ENTRIES)
            : next;
        });
      } catch {
        // ignore malformed messages
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, open]);

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "60px",
            right: "16px",
            width: "520px",
            maxHeight: "400px",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9998,
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#94a3b8",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
              SSR Network
            </span>
            <button
              onClick={() => setEntries([])}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "11px",
                padding: "2px 6px",
              }}
            >
              clear
            </button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#0f172a",
                    borderBottom: "1px solid #334155",
                    zIndex: 1,
                  }}
                >
                  {(["Method", "Status", "URL", "Duration"] as const).map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "6px 12px",
                        textAlign: col === "Duration" ? "right" : "left",
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                        width: col === "Method" ? "60px" : col === "Status" ? "52px" : col === "Duration" ? "72px" : undefined,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ padding: "24px", textAlign: "center", color: "#475569" }}
                    >
                      No requests yet
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      title={entry.error}
                      style={{
                        borderBottom: "1px solid #1e293b",
                        background: entry.error ? "rgba(239,68,68,0.05)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "5px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ color: methodColor(entry.method), fontWeight: 600, fontSize: "11px" }}>
                          {entry.method}
                        </span>
                      </td>
                      <td style={{ padding: "5px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ color: statusColor(entry.status, entry.error), fontWeight: 600 }}>
                          {entry.status ?? "ERR"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "5px 12px",
                          color: "#cbd5e1",
                          maxWidth: "260px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.url}
                      </td>
                      <td style={{ padding: "5px 12px", color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>
                        {entry.duration}ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div ref={bottomRef} />
          </div>
        </div>
      )}
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
          padding: "8px 12px",
          fontFamily: "monospace",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ color: entries.length > 0 ? "#22c55e" : "#475569" }}>
          ●
        </span>
        SSR Network
        {entries.length > 0 && (
          <span
            style={{
              background: "#1d4ed8",
              borderRadius: "10px",
              padding: "1px 6px",
              fontSize: "10px",
            }}
          >
            {entries.length}
          </span>
        )}
      </button>
    </>
  );
}
