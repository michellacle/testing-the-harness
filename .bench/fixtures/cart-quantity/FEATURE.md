# Feature: increment an existing cart item

Update `addItem` in `src/cart.ts`.

- If `sku` is already present, return a new array where that item's quantity increases by one.
- Do not mutate the input array or any existing item.
- A new SKU must retain the existing behavior.
- Add focused tests in `src/cart.test.ts`.
