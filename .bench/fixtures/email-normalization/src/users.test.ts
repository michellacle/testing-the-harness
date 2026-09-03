import { describe, expect, it } from "vitest";
import { createUser } from "./users.js";

describe("createUser", () => {
  it("creates a user", () => {
    expect(createUser("1", "person@example.com")).toEqual({
      id: "1",
      email: "person@example.com"
    });
  });
});
