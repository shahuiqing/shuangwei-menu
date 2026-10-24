import { describe, it, expect } from "vitest";
import {
  mergeAndOrderCategories,
  INITIAL_MENU_CATEGORIES,
  stripMainDrinksDeletedIds,
} from "../initialData";

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

  it("preserves custom items whose title matches a globally-removed title", () => {
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
    expect(items.find((i: any) => i.id === "x")).toBeTruthy();
    expect(items.find((i: any) => i.id === "i1")).toBeTruthy();
  });

  it("still filters default items whose title is globally removed", () => {
    const init = [
      {
        id: "c1",
        name: "Cat1",
        items: [
          { id: "def", title: "香菇" },
          { id: "i1", title: "One" },
        ],
      },
    ];
    const r = mergeAndOrderCategories([], init, []);
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

  it("merges legacy staples + drinks categories and drops removed rice/dumpling items", () => {
    const legacy = [
      {
        id: "all-drinks-menu",
        name: "饮品分类",
        items: [{ id: "dk1", title: "冰镇可乐", price: "10" }],
      },
      {
        id: "cat-staples",
        name: "主食 & 沙拉",
        items: [
          { id: "main-poulet-teriyaki", title: "照烧鸡肉拌饭", price: "65" },
          { id: "main-salade-fraiche", title: "鲜绿田园沙拉", price: "45" },
        ],
      },
    ];
    const r = mergeAndOrderCategories(legacy, INITIAL_MENU_CATEGORIES, []);
    expect(r.find((c) => c.id === "cat-staples")).toBeUndefined();
    expect(r.find((c) => c.id === "all-drinks-menu")).toBeUndefined();
    const merged = r.find((c) => c.id === "cat-main-drinks");
    expect(merged).toBeDefined();
    const ids = merged!.items.map((i: any) => i.id);
    expect(ids).toContain("dk1");
    expect(ids).toContain("main-salade-fraiche");
    expect(ids).toContain("main-rice-bowl");
    expect(ids).not.toContain("main-poulet-teriyaki");
  });

  it("gives 紫菜包饭 / 寿司 a 大份 add-on at +25 and keeps its id", () => {
    const existing = [
      {
        id: "kimbap-cat",
        name: "其他",
        items: [
          {
            id: "legacy-kimbap-id",
            title: "紫菜包饭 / 寿司",
            price: "MAD50",
            image: "x.jpg",
          },
        ],
      },
    ];
    const r = mergeAndOrderCategories(existing, [], []);
    const item = r[0].items.find((i: any) => i.id === "legacy-kimbap-id");
    expect(item).toBeDefined();
    expect(item.image).toBe("x.jpg");
    expect(item.addons).toEqual([
      { id: "kimbap-large", name: "大份", enName: "Large Portion", price: 25 },
    ]);
  });

  it("does not duplicate 主食 & 饮品 when legacy categories coexist with it", () => {
    const existing = [
      {
        id: "cat-main-drinks",
        name: "主食 & 饮品",
        items: [{ id: "dk1", title: "冰镇可乐" }],
      },
      {
        id: "cat-staples",
        name: "主食 & 沙拉",
        items: [{ id: "main-salade-fraiche", title: "鲜绿田园沙拉" }],
      },
      {
        id: "all-drinks-menu",
        name: "饮品分类",
        items: [{ id: "dk1", title: "冰镇可乐" }],
      },
    ];
    const r = mergeAndOrderCategories(existing, INITIAL_MENU_CATEGORIES, []);
    const mains = r.filter((c) => c.id === "cat-main-drinks");
    expect(mains).toHaveLength(1);
    expect(r.find((c) => c.id === "cat-staples")).toBeUndefined();
    expect(r.find((c) => c.id === "all-drinks-menu")).toBeUndefined();
  });
});

describe("stripMainDrinksDeletedIds", () => {
  it("removes 主食 & 饮品 category marker but keeps item markers (so dishes stay deletable)", () => {
    const ids = [
      "cat-main-drinks",
      "主食 & 饮品",
      "main-rice-bowl",
      "拌饭",
      "main-dumpling-dry",
      "干饺",
      "some-other-id",
    ];
    const cleaned = stripMainDrinksDeletedIds(ids);
    expect(cleaned).not.toContain("cat-main-drinks");
    expect(cleaned).not.toContain("主食 & 饮品");
    expect(cleaned).toContain("main-rice-bowl");
    expect(cleaned).toContain("拌饭");
    expect(cleaned).toContain("main-dumpling-dry");
    expect(cleaned).toContain("干饺");
    expect(cleaned).toContain("some-other-id");
  });

  it("is a no-op when nothing to strip", () => {
    const ids = ["some-other-id", "another"];
    expect(stripMainDrinksDeletedIds(ids)).toEqual(ids);
  });
});
