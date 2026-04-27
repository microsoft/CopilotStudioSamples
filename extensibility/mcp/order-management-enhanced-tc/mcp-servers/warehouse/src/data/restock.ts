import { RestockInfo } from "../types.js";

export const restockSchedule: RestockInfo[] = [
  {
    sku: "SKU-KINDLE",
    name: "Kindle Paperwhite (16GB)",
    currentQuantity: 0,
    nextShipmentDate: "2026-04-22",
    expectedQuantity: 50,
    supplier: "Amazon Devices Distribution",
    notes: "Delayed from original April 18 date. Supplier confirmed new ETA.",
  },
  {
    sku: "SKU-SWITCH",
    name: "Nintendo Switch OLED",
    currentQuantity: 0,
    nextShipmentDate: "2026-04-28",
    expectedQuantity: 30,
    supplier: "Nintendo of America",
    notes: "High demand — limited allocation. Next batch after this is mid-May.",
  },
  {
    sku: "SKU-WH1000",
    name: "Sony WH-1000XM5 Headphones",
    currentQuantity: 3,
    nextShipmentDate: "2026-05-05",
    expectedQuantity: 20,
    supplier: "Sony Electronics Inc.",
    notes: "Regular replenishment cycle. Current stock sufficient for 1-2 weeks.",
  },
  {
    sku: "SKU-ERGOCHAIR",
    name: "ErgoChair Pro - Matte Black",
    currentQuantity: 1,
    nextShipmentDate: "2026-04-30",
    expectedQuantity: 10,
    supplier: "Autonomous Inc.",
    notes: "Low stock alert triggered. Express shipment arranged.",
  },
];
