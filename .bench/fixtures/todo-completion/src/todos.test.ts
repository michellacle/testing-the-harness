import { describe, expect, it } from "vitest";
import { addTodo } from "./todos.js";

describe("addTodo", () => {
  it("adds an incomplete todo", () => {
    expect(addTodo([], "1", "Write tests")).toEqual([
      { id: "1", title: "Write tests", completed: false }
    ]);
  });
});
