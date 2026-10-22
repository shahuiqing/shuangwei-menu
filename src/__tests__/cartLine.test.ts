import { describe, it, expect } from "vitest";
import { makeLineKey, parseLineKey } from "../utils/cartLine";

describe("cart line keys", () => {
  it("uses the dish id when there are no add-ons", () => {
    expect(makeLineKey("main-rice-bowl", [])).toBe("main-rice-bowl");
    expect(parseLineKey("main-rice-bowl")).toEqual({
      dishId: "main-rice-bowl",
      addonIds: [],
    });
  });

  it("gives different add-on selections different keys", () => {
    const a = makeLineKey("main-rice-bowl", ["rice-filet"]);
    const b = makeLineKey("main-rice-bowl", ["rice-korean"]);
    expect(a).not.toBe(b);
    expect(parseLineKey(a)).toEqual({
      dishId: "main-rice-bowl",
      addonIds: ["rice-filet"],
    });
  });

  it("is order-independent for add-ons", () => {
    expect(makeLineKey("d", ["b", "a"])).toBe(makeLineKey("d", ["a", "b"]));
  });
});
