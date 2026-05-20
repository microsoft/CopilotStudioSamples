import { ReturnRequest } from "../types.js";

export const returns: ReturnRequest[] = [
  {
    id: "RA-50012",
    orderId: "ORD-10318",
    itemSkus: ["SKU-CASE01"],
    reason: "Wrong color received",
    status: "refund_processed",
    createdAt: "2026-03-30",
    refundAmount: 19.99,
    returnLabelUrl: "https://returns.example.com/labels/RA-50012.pdf",
    timeline: [
      { date: "2026-03-30", event: "Return requested" },
      { date: "2026-03-31", event: "Return label sent" },
      { date: "2026-04-03", event: "Item shipped by customer" },
      { date: "2026-04-07", event: "Item received at warehouse" },
      { date: "2026-04-09", event: "Refund of $19.99 processed to Visa ending in 4242" },
    ],
  },
  {
    id: "RA-50018",
    orderId: "ORD-10389",
    itemSkus: ["SKU-DUNE2"],
    reason: "Disc scratched on arrival",
    status: "received",
    createdAt: "2026-04-03",
    refundAmount: 29.99,
    returnLabelUrl: "https://returns.example.com/labels/RA-50018.pdf",
    timeline: [
      { date: "2026-04-03", event: "Return requested" },
      { date: "2026-04-04", event: "Return label sent" },
      { date: "2026-04-08", event: "Item shipped by customer" },
      { date: "2026-04-14", event: "Item received at warehouse — inspection pending" },
    ],
  },
];

let nextReturnId = 50019;

export function createReturn(
  orderId: string,
  itemSkus: string[],
  reason: string,
  refundAmount: number,
  paymentMethod: string,
): ReturnRequest {
  const id = `RA-${nextReturnId++}`;
  const today = new Date().toISOString().slice(0, 10);
  const ret: ReturnRequest = {
    id,
    orderId,
    itemSkus,
    reason,
    status: "requested",
    createdAt: today,
    refundAmount,
    returnLabelUrl: `https://returns.example.com/labels/${id}.pdf`,
    timeline: [
      { date: today, event: "Return requested" },
    ],
  };
  returns.push(ret);
  return ret;
}
