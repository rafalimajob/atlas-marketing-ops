export interface KitItemDTO {
  id: string;
  stockItemId: string;
  quantity: number;
  stockItem: { name: string; code: string; lastCost?: string | null };
}

export interface KitDTO {
  id: string;
  name: string;
  items: KitItemDTO[];
}
