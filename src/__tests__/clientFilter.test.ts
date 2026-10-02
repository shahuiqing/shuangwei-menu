import { describe, it, expect, vi } from "vitest";

vi.mock("../supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  isSupabaseHealthy: true,
}));

import { filterPayloadByTable, KNOWN_COLUMNS } from "../api_modules/client";

describe("filterPayloadByTable", () => {
  it("drops unknown columns for a known table", async () => {
    const out = await filterPayloadByTable("orders", {
      _id: "1",
      id: "1",
      status: "pending",
      bogus: "x",
      another: 1,
    });
    expect(out).toEqual({ _id: "1", id: "1", status: "pending" });
  });

  it("keeps known settings columns and drops unknown ones", async () => {
    const out = await filterPayloadByTable("settings", {
      id: "global",
      categories: [],
      nope: 1,
    });
    expect(out).toEqual({ id: "global", categories: [] });
  });

  it("returns the payload unchanged for an unknown table", async () => {
    const p = { a: 1, b: 2 };
    expect(await filterPayloadByTable("no_such_table", p)).toEqual(p);
  });

  it("exposes the expected critical columns", () => {
    expect(KNOWN_COLUMNS.orders).toContain("_id");
    expect(KNOWN_COLUMNS.orders).toContain("id");
    expect(KNOWN_COLUMNS.settings).toContain("deletedItemIds");
    expect(KNOWN_COLUMNS.settings).toContain("adminPasswordHash");
  });
});
