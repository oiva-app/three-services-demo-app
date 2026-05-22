import { Request, Response, NextFunction } from "express";
import { propagation } from "@opentelemetry/api";

const SERVICE_NAME = "inventory";
const BAGGAGE_KEY = "fault.inject";
const ENABLED = process.env.FAULT_INJECTION_ENABLED === "true";

type FaultSpec =
  | { target: string; mode: "latency"; valueMs: number }
  | { target: string; mode: "error"; status: number };

function parseSpec(raw: string): FaultSpec | null {
  // expected format: "<target>:<mode>=<value>"
  const colon = raw.indexOf(":");
  if (colon === -1) return null;
  const target = raw.slice(0, colon);
  const rest = raw.slice(colon + 1);

  const eq = rest.indexOf("=");
  if (eq === -1) return null;
  const mode = rest.slice(0, eq);
  const value = rest.slice(eq + 1);

  if (mode === "latency") {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms < 0) return null;
    return { target, mode: "latency", valueMs: ms };
  }
  if (mode === "error") {
    const status = Number(value);
    if (!Number.isInteger(status) || status < 100 || status > 599) return null;
    return { target, mode: "error", status };
  }
  return null;
}

function readSpec(): { spec: FaultSpec; raw: string } | null {
  if (!ENABLED) return null;
  const baggage = propagation.getActiveBaggage();
  if (!baggage) return null;
  const entry = baggage.getEntry(BAGGAGE_KEY);
  if (!entry) return null;
  const spec = parseSpec(entry.value);
  if (!spec) {
    console.warn(`faultInjection: could not parse spec "${entry.value}"`);
    return null;
  }
  if (spec.target !== SERVICE_NAME) {
    return null; // valid spec, just not for us — silent skip
  }
  return { spec, raw: entry.value };
}

export function faultInjection() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const found = readSpec();
    if (!found) return next();
    const { spec, raw } = found;

    if (spec.mode === "latency") {
      await new Promise((resolve) => setTimeout(resolve, spec.valueMs));
      return next();
    }

    // mode === "error"
    res.status(spec.status).json({
      error: "fault_injected",
      spec: raw,
    });
  };
}
