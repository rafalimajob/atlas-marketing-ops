import type { MovementTypeValue } from "@/lib/movement-types";

export interface MovementDTO {
  id: string;
  date: string;
  direction: "ENTRADA" | "SAIDA";
  type: MovementTypeValue;
  quantity: number;
  project: string | null;
  notes: string | null;
  stockItemId: string;
  stockItem: { name: string; code: string };
  performedBy: { name: string };
  orderId: string | null;
  kitOutputId: string | null;
  areaId: string | null;
  area?: { id: string; name: string } | null;
  unitCost?: string | null;
  totalCost?: string | null;
}

export interface StockOptionDTO {
  id: string;
  code: string;
  name: string;
  quantity: number;
  lastCost?: string | null;
}
