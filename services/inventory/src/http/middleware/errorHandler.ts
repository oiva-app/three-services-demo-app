import { Request, Response, NextFunction } from "express";
import { trace, SpanStatusCode } from "@opentelemetry/api";

// Express error-handling middleware — registered last, after the routes.
// Our OTel setup disables Express layer spans, so an unhandled throw in a
// handler otherwise becomes a bare 500 with no exception on the span. This
// records the exception (type, message, stack) on the active span so the
// failure is debuggable straight from the trace.
export function errorHandler() {
  return (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err instanceof Error ? err : new Error(String(err));

    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.setAttribute("error.type", error.name);
    }

    console.error("unhandled error:", error);

    // Headers already flushed — hand off to Express's default handler,
    // which closes the connection. We can't write a fresh status.
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "internal_error" });
  };
}
