export interface StockEntry {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  warehouse: string;
  aisle: string;
  availableForShipping: boolean;
}

export interface FulfillmentStage {
  stage: "received" | "picked" | "packed" | "labeled" | "handed_to_carrier";
  timestamp: string;
}

export interface FulfillmentRecord {
  orderId: string;
  warehouse: string;
  assignedWorker: string;
  currentStage: string;
  pipeline: FulfillmentStage[];
  estimatedShipDate: string;
  notes: string;
}

export interface Alternative {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  warehouse: string;
  availableForShipping: boolean;
}

export interface RestockInfo {
  sku: string;
  name: string;
  currentQuantity: number;
  nextShipmentDate: string;
  expectedQuantity: number;
  supplier: string;
  notes: string;
}
