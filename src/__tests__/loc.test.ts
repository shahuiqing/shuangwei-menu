import { describe, it, expect } from "vitest";
import { getLoc, getSubLoc } from "../utils/loc";

describe("getLoc fallback chain", () => {
  const item = { title: "中文", enTitle: "English", description: "d" };

  it("returns the exact language when present", () => {
    expect(getLoc(item, "zh", "title")).toBe("中文");
    expect(getLoc(item, "en", "title")).toBe("English");
  });

  it("falls back through en for missing translations", () => {
    expect(getLoc(item, "fr", "title")).toBe("English");
    expect(getLoc(item, "ar", "title")).toBe("English");
  });

  it("ma falls back to ar before en", () => {
    expect(
      getLoc({ title: "中", enTitle: "EN", arTitle: "AR" }, "ma", "title"),
    ).toBe("AR");
    expect(getLoc({ title: "中", enTitle: "EN" }, "ma", "title")).toBe("EN");
  });

  it("handles empty and null items", () => {
    expect(getLoc({}, "zh", "title")).toBe("");
    expect(getLoc(null, "en", "title")).toBe("");
    expect(getLoc(item, "zh", "desc")).toBe("d");
  });
});

describe("getSubLoc", () => {
  it("returns the secondary language text", () => {
    expect(getSubLoc({ title: "中", enTitle: "EN" }, "zh", "title")).toBe("EN");
    expect(getSubLoc({ title: "中", enTitle: "EN" }, "en", "title")).toBe("中");
    expect(getSubLoc({ title: "中" }, "zh", "title")).toBe("中");
    expect(getSubLoc(null, "en", "title")).toBe("");
  });
});
