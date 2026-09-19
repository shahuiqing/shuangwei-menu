import { describe, it, expect } from "vitest";
import { menuItemSchema } from "../types/schemas";
import { mergeAndOrderCategories } from "../initialData";
import { INITIAL_MENU_CATEGORIES } from "../initialData";

describe("menu schemas", () => {
  it("validates correct item", () => {
    const res = menuItemSchema.safeParse({
      id: "1",
      title: "Test",
      price: "MAD10",
      image: "",
    });
    expect(res.success).toBe(true);
  });
  it("rejects empty title", () => {
    const res = menuItemSchema.safeParse({ id: "1", title: "", price: "10" });
    expect(res.success).toBe(false);
  });
});

describe("mergeAndOrderCategories", () => {
  it("preserves deleted ids", () => {
    const cats = [
      {
        id: "all-bbq-menu-halal",
        name: "烤肉",
        items: [{ id: "item-cumin-lamb", title: "孜然" }],
      },
    ];
    const merged = mergeAndOrderCategories(
      cats as any,
      INITIAL_MENU_CATEGORIES,
      ["item-cumin-lamb"],
    );
    const bbq = merged.find((c) => c.id === "all-bbq-menu-halal");
    expect(
      bbq?.items.find((i: any) => i.id === "item-cumin-lamb"),
    ).toBeUndefined();
  });
});
