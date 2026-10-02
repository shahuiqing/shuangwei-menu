import { describe, it, expect, beforeEach } from "vitest";
import { safeParse, readLocalJSON } from "../utils/safeParse";

describe("safeParse", () => {
  it("parses valid JSON", () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeParse("[1,2,3]", [])).toEqual([1, 2, 3]);
  });

  it("returns fallback for null/undefined/empty", () => {
    expect(safeParse(null, "fb")).toBe("fb");
    expect(safeParse(undefined, "fb")).toBe("fb");
    expect(safeParse("", "fb")).toBe("fb");
  });

  it("returns fallback for malformed JSON", () => {
    expect(safeParse("{oops", [])).toEqual([]);
  });
});

describe("readLocalJSON", () => {
  beforeEach(() => localStorage.clear());

  it("reads stored JSON", () => {
    localStorage.setItem("k", JSON.stringify([1, 2]));
    expect(readLocalJSON("k", [])).toEqual([1, 2]);
  });

  it("falls back when key missing", () => {
    expect(readLocalJSON("nope", { x: 1 })).toEqual({ x: 1 });
  });

  it("falls back on malformed stored value", () => {
    localStorage.setItem("bad", "not json");
    expect(readLocalJSON("bad", 7)).toBe(7);
  });
});
