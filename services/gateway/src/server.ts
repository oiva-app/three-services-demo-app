import "./infra/telemetry";
import { shutdownTelemetry } from "./infra/telemetry";

import express from "express";
import { HttpOrdersClient } from "./infra/httpOrdersClient";
import { buildRoutes } from "./http/routes";
import { headerToBaggage } from "./http/middleware/headerToBaggage";
import { faultInjection } from "./http/middleware/faultInjection";
import { errorHandler } from "./http/middleware/errorHandler";

function readEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(
      `Invalid ${name}: ${JSON.stringify(raw)} (must be a positive integer)`,
    );
    process.exit(1);
  }
  return n;
}

const port = readEnvInt("PORT", 3000);
const ordersUrl = process.env.ORDERS_URL;
if (!ordersUrl) {
  console.error("ORDERS_URL is required");
  process.exit(1);
}

const ordersTimeoutMs = readEnvInt("ORDERS_TIMEOUT_MS", 5000);
const orders = new HttpOrdersClient(ordersUrl, ordersTimeoutMs);

const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use(express.json());
app.use(headerToBaggage());
app.use(faultInjection());
app.use(buildRoutes(orders));
app.use(errorHandler());

const server = app.listen(port, () => {
  console.log(`gateway listening on: ${port}`);
});

const SHUTDOWN_TIMEOUT_MS = 10000;
const shutdown = (signal: string) => {
  console.log(`received ${signal}, shutting down`);
  const timer = setTimeout(() => {
    console.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  server.close(async () => {
    clearTimeout(timer);
    await shutdownTelemetry();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
