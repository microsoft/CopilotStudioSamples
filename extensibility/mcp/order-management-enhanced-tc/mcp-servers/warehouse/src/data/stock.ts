import { StockEntry } from "../types.js";

export const stock: StockEntry[] = [
  // Electronics
  { sku: "SKU-WH1000", name: "Sony WH-1000XM5 Headphones", category: "electronics", quantity: 3, warehouse: "Seattle-WA1", aisle: "E-14", availableForShipping: true },
  { sku: "SKU-USBC3", name: "USB-C Charging Cable (3-pack)", category: "electronics", quantity: 142, warehouse: "Seattle-WA1", aisle: "A-02", availableForShipping: true },
  { sku: "SKU-KINDLE", name: "Kindle Paperwhite (16GB)", category: "electronics", quantity: 0, warehouse: "Chicago-IL1", aisle: "E-08", availableForShipping: false },
  { sku: "SKU-AIRPOD", name: "AirPods Pro (2nd Gen)", category: "electronics", quantity: 17, warehouse: "Seattle-WA1", aisle: "E-12", availableForShipping: true },
  { sku: "SKU-SWITCH", name: "Nintendo Switch OLED", category: "electronics", quantity: 0, warehouse: "Chicago-IL1", aisle: "E-22", availableForShipping: false },
  { sku: "SKU-ZELDA", name: "The Legend of Zelda: Tears of the Kingdom", category: "electronics", quantity: 24, warehouse: "Chicago-IL1", aisle: "G-05", availableForShipping: true },
  { sku: "SKU-IPAD", name: "iPad Air (M2, 256GB)", category: "electronics", quantity: 5, warehouse: "Seattle-WA1", aisle: "E-10", availableForShipping: true },

  // Audio alternatives
  { sku: "SKU-WH900", name: "Sony WH-1000XM4 Headphones (Previous Gen)", category: "electronics", quantity: 8, warehouse: "Seattle-WA1", aisle: "E-14", availableForShipping: true },
  { sku: "SKU-BOSE700", name: "Bose 700 Noise Cancelling Headphones", category: "electronics", quantity: 6, warehouse: "Seattle-WA1", aisle: "E-15", availableForShipping: true },
  { sku: "SKU-AIRMAX", name: "AirPods Max - Space Gray", category: "electronics", quantity: 2, warehouse: "Seattle-WA1", aisle: "E-13", availableForShipping: true },

  // Clothing
  { sku: "SKU-HOODIE", name: "Nike Tech Fleece Hoodie - Black (L)", category: "clothing", quantity: 4, warehouse: "Dallas-TX1", aisle: "C-07", availableForShipping: true },
  { sku: "SKU-HOODIE-XL", name: "Nike Tech Fleece Hoodie - Black (XL)", category: "clothing", quantity: 7, warehouse: "Dallas-TX1", aisle: "C-07", availableForShipping: true },
  { sku: "SKU-HOODIE-GRY", name: "Nike Tech Fleece Hoodie - Grey (L)", category: "clothing", quantity: 2, warehouse: "Dallas-TX1", aisle: "C-07", availableForShipping: true },
  { sku: "SKU-JOGGER", name: "Nike Sportswear Joggers - Grey (L)", category: "clothing", quantity: 11, warehouse: "Dallas-TX1", aisle: "C-09", availableForShipping: true },
  { sku: "SKU-JOGGER-XL", name: "Nike Sportswear Joggers - Grey (XL)", category: "clothing", quantity: 3, warehouse: "Dallas-TX1", aisle: "C-09", availableForShipping: true },

  // Books & Media
  { sku: "SKU-DUNE2", name: "Dune: Part Two (4K Blu-ray)", category: "media", quantity: 9, warehouse: "Chicago-IL1", aisle: "M-03", availableForShipping: true },
  { sku: "SKU-FOUNDATION", name: "Foundation (Isaac Asimov) - Paperback", category: "books", quantity: 22, warehouse: "Chicago-IL1", aisle: "B-11", availableForShipping: true },
  { sku: "SKU-3BODY", name: "The Three-Body Problem - Paperback", category: "books", quantity: 15, warehouse: "Chicago-IL1", aisle: "B-11", availableForShipping: true },

  // Furniture
  { sku: "SKU-ERGOCHAIR", name: "ErgoChair Pro - Matte Black", category: "furniture", quantity: 1, warehouse: "Seattle-WA1", aisle: "F-01", availableForShipping: true },
  { sku: "SKU-ERGOCHAIR-W", name: "ErgoChair Pro - White", category: "furniture", quantity: 3, warehouse: "Seattle-WA1", aisle: "F-01", availableForShipping: true },
  { sku: "SKU-DESKMAT", name: "Felt Desk Mat - Dark Grey (90x40cm)", category: "furniture", quantity: 30, warehouse: "Seattle-WA1", aisle: "F-04", availableForShipping: true },
];
