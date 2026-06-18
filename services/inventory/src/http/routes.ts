import { Router } from "express";
import { reserve, InventoryStore } from "../domain/inventory";
import { trace } from "@opentelemetry/api";

export function buildRoutes(store: InventoryStore): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  router.post("/inventory/reserve", (req, res) => {
    const span = trace.getActiveSpan();
    const { sku, quantity } = req.body ?? {};
    if (typeof sku !== "string" || typeof quantity !== "number") {
      span?.setAttributes({
        "validation.ok": false,
        "validation.error": "missing_or_wrong_type",
      });
      res
        .status(400)
        .json({ error: "sku (string) and quantity (number) required" });

      return;
    }

    span?.setAttributes({
      sku,
      quantity_requested: quantity,
    });

    const stock = store.get(sku);
    const result = reserve(stock, quantity);

    if (!result.ok) {
      span?.setAttributes({
        "reservation.ok": false,
        "reservation.reason": result.reason,
        "inventory.warehouse": stock!.warehouse,
        "inventory.stock.available": stock!.quantity,
      });

      const status =
        result.reason === "unknown_sku"
          ? 404
          : result.reason === "invalid_quantity"
            ? 400
            : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    store.put(result.updated);
    span?.setAttributes({
      "reservation.ok": true,
      "inventory.warehouse": result.updated.warehouse,
      "inventory.stock.before": result.updated.quantity + quantity,
      "inventory.stock.after": result.updated.quantity,
    });
    res.json({
      sku: result.updated.sku,
      warehouse: result.updated.warehouse,
      remaining: result.updated.quantity,
      status: "reserved",
    });
  });

  router.get("/inventory/check/:sku", (req, res) => {
    const span = trace.getActiveSpan();
    const sku = req.params.sku;
    span?.setAttributes({ sku });

    const stock = store.get(sku);
    if (!stock) {
      span?.setAttributes({ "inventory.found": false });
      res.status(404).json({ error: "unknown_sku" });
      return;
    }
    span?.setAttributes({
      "inventory.found": true,
      "inventory.warehouse": stock.warehouse,
      "inventory.stock.available": stock.quantity,
    });
    res.json(stock);
  });

  return router;
}
