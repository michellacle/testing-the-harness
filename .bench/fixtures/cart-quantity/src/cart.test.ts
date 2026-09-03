import { describe, expect, it } from "vitest";
import { addItem } from "./cart.js";

describe("addItem", () => {
  it("adds one item", () => {
    expect(addItem([], "book")).toEqual([{ sku: "book", quantity: 1 }]);
  });
});
