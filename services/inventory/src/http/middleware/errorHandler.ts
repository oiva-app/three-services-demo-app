import { Request, Response, NextFunction } from "express";
import { trace, SpanStatusCode } from "@opentelemetry/api";

// Express error-handling middleware (registered last, after the routes).
// Without it, an unhandled throw in a handler becomes a bare 500 — the
// request span records the status code but not the exception, so a trace
// can't tell you *what* failed. This records the exception (type, message,
// stack) on the active span so the failure is debuggable from the trace.
export function errorHandler() {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.setAttribute("error.type", error.name);
    }
    console.error("unhandled error:", error);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  };
}
