import { describe, it, expect } from "vitest";
import { taskToRow, taskFromRow, type Task } from "../tasks";

const task: Task = {
  id: "p1-1700000000000",
  kind: "low_stock",
  title: "3 种原料低于安全库存",
  desc: "牛肉、洋葱、纸巾",
  impact: 128.5,
  evidence: [{ label: "牛肉", value: "现存 1kg" }],
  suggestion: "尽快补货",
  assignee: "张三",
  stage: "executing",
  createdAt: 1700000000000,
  resolvedAt: undefined,
  reopenedCount: 2,
  tab: "inventory",
  routine: "weekly",
  nextDueAt: 1700604800000,
};

describe("任务中心云端同步 · 行映射", () => {
  it("本机任务 → 云端行 → 本机任务 往返一致", () => {
    const row = taskToRow(task);
    expect(row.desc_text).toBe(task.desc);
    expect(row.created_at_ms).toBe(task.createdAt);
    expect(row.routine).toBe("weekly");
    expect(row.evidence).toEqual(task.evidence);

    const back = taskFromRow(row);
    expect(back).toEqual(task);
  });

  it("云端空值/旧数据回填默认值", () => {
    const back = taskFromRow({
      id: "x1",
      title: "旧任务",
      stage: "found",
      created_at_ms: 1700000000000,
    });
    expect(back.desc).toBe("");
    expect(back.evidence).toEqual([]);
    expect(back.impact).toBe(0);
    expect(back.routine).toBe("none");
    expect(back.reopenedCount).toBe(0);
    expect(back.assignee).toBe("");
    expect(back.resolvedAt).toBeUndefined();
    expect(back.nextDueAt).toBeUndefined();
  });

  it("已解决任务保留解决时间", () => {
    const t: Task = { ...task, stage: "resolved", resolvedAt: 1700100000000 };
    const back = taskFromRow(taskToRow(t));
    expect(back.resolvedAt).toBe(1700100000000);
    expect(back.stage).toBe("resolved");
  });
});
