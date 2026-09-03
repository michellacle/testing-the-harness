export interface CartItem {
  sku: string;
  quantity: number;
}

export function addItem(items: CartItem[], sku: string): CartItem[] {
  return [...items, { sku, quantity: 1 }];
}
