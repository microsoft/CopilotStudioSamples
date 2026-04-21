export interface Customer {
  id: string;
  name: string;
  email: string;
}

export interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customer: Customer;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  items: LineItem[];
  shippingAddress: string;
  paymentMethod: string;
  total: number;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  status: string;
}

export interface Shipment {
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
  events: TrackingEvent[];
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  itemSkus: string[];
  reason: string;
  status: "requested" | "label_sent" | "in_transit" | "received" | "refund_processed";
  createdAt: string;
  refundAmount: number;
  returnLabelUrl: string;
  timeline: { date: string; event: string }[];
}
