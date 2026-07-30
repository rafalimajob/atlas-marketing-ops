export interface KitItemDTO {
  id: string;
  stockItemId: string;
  quantity: number;
  stockItem: { name: string; code: string; lastCost?: string | null };
}

export interface KitOutputDTO {
  id: string;
  quantity: number;
  project: string | null;
  notes: string | null;
  date: string;
  performedBy: { name: string };
  area: { id: string; name: string } | null;
}

export interface KitDTO {
  id: string;
  name: string;
  items: KitItemDTO[];
  outputs: KitOutputDTO[];
}
