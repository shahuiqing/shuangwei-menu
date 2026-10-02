import { describe, it, expect } from "vitest";
import { mergeAndOrderCategories } from "../initialData";

const initial = [
  {
    id: "c1",
    name: "Cat1",
    items: [
      { id: "i1", title: "One" },
      { id: "i2", title: "Two" },
    ],
  },
  { id: "c2", name: "Cat2", items: [{ id: "i3", title: "Three" }] },
];

describe("mergeAndOrderCategories", () => {
  it("returns initial categories when existing is empty", () => {
    const r = mergeAndOrderCategories([], initial, []);
    expect(r.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("filters globally removed titles even from custom categories", () => {
    const existing = [
      {
        id: "c1",
        name: "Cat1",
        items: [
          { id: "x", title: "香菇" },
          { id: "i1", title: "One" },
        ],
      },
    ];
    const r = mergeAndOrderCategories(existing, initial, []);
    const items = r.find((c) => c.id === "c1")!.items;
    expect(items.find((i: any) => i.title === "香菇")).toBeUndefined();
    expect(items.find((i: any) => i.id === "i1")).toBeTruthy();
  });

  it("preserves user-created custom categories", () => {
    const existing = [
      { id: "custom", name: "Mine", items: [{ id: "z", title: "Z" }] },
    ];
    const r = mergeAndOrderCategories(existing, initial, []);
    expect(r.find((c) => c.id === "custom")).toBeTruthy();
  });

  it("appends new initial items not present in existing", () => {
    const existing = [
      { id: "c1", name: "Cat1", items: [{ id: "i1", title: "One" }] },
    ];
    const r = mergeAndOrderCategories(existing, initial, []);
    const items = r.find((c) => c.id === "c1")!.items;
    expect(items.find((i: any) => i.id === "i2")).toBeTruthy();
  });

  it("honors deletedItemIds by id and by title", () => {
    const existing = [
      {
        id: "c1",
        name: "Cat1",
        items: [
          { id: "i1", title: "One" },
          { id: "i2", title: "Two" },
        ],
      },
    ];
    const byId = mergeAndOrderCategories(existing, initial, ["i1"]);
    expect(
      byId.find((c) => c.id === "c1")!.items.find((i: any) => i.id === "i1"),
    ).toBeUndefined();
    const byTitle = mergeAndOrderCategories(existing, initial, ["two"]);
    expect(
      byTitle
        .find((c) => c.id === "c1")!
        .items.find((i: any) => i.title === "Two"),
    ).toBeUndefined();
  });

  it("removes a whole category when its id is deleted", () => {
    const existing = [
      { id: "c1", name: "Cat1", items: [{ id: "i1", title: "One" }] },
      { id: "c2", name: "Cat2", items: [] },
    ];
    const r = mergeAndOrderCategories(existing, initial, ["c2"]);
    expect(r.find((c) => c.id === "c2")).toBeUndefined();
  });
});
