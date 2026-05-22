import "dotenv/config";

import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ExpressLayerType } from "@opentelemetry/instrumentation-express";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from "@opentelemetry/core";

const serviceName = process.env.OTEL_SERVICE_NAME ?? "inventory";
const serviceVersion = process.env.SERVICE_VERSION ?? "unknown";

const apiKey = process.env.HONEYCOMB_API_KEY;
if (!apiKey) {
  throw new Error("HONEYCOMB_API_KEY is required for telemetry export");
}

const exporter = new OTLPTraceExporter({
  url:
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    "https://api.honeycomb.io/v1/traces",
  headers: {
    "x-honeycomb-team": apiKey,
  },
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  spanProcessors: [new BatchSpanProcessor(exporter)],
  textMapPropagator: new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-router": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-express": {
        ignoreLayersType: [
          ExpressLayerType.MIDDLEWARE,
          ExpressLayerType.ROUTER,
          ExpressLayerType.REQUEST_HANDLER,
        ],
      },
    }),
  ],
});

sdk.start();
console.log(`OTel SDK started for service: ${serviceName}`);

export async function shutdownTelemetry(): Promise<void> {
  await sdk.shutdown();
}
