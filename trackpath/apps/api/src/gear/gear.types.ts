export interface CreateCategoryBody {
  name: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateCategoryBody {
  name?: string;
  color?: string;
  sortOrder?: number;
}

export interface CreateItemBody {
  categoryId: number;
  name: string;
  weightG?: number;
  qty?: number;
  worn?: boolean;
  consumable?: boolean;
  notes?: string;
}

export interface UpdateItemBody {
  name?: string;
  weightG?: number;
  qty?: number;
  worn?: boolean;
  consumable?: boolean;
  included?: boolean;
  categoryId?: number;
  notes?: string;
}

export interface ImportRow {
  name: string;
  category: string;
  weightG: number;
  qty: number;
  worn: boolean;
  consumable: boolean;
  notes?: string;
}
