import { describe, it, expect, beforeEach } from "vitest";
import {
  loadTasks,
  createTask,
  advanceTask,
  reopenTask,
  setAssignee,
  removeTask,
  STAGE_LABEL,
  STAGE_NEXT,
} from "../tasks";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
});

const mk = () =>
  createTask({
    id: "late",
    kind: "late",
    title: "订单超时",
    desc: "d",
    impact: 100,
    evidence: [],
    suggestion: "s",
    tab: "orders",
  });

describe("任务生命周期", () => {
  it("创建后处于「发现」，可按顺序推进到「已解决」", () => {
    const t = mk();
    expect(t.stage).toBe("found");
    let list = loadTasks();
    for (const _ of Object.keys(STAGE_LABEL)) {
      if (list[0].stage === "resolved") break;
      list = advanceTask(list[0].id);
    }
    expect(list[0].stage).toBe("resolved");
    expect(list[0].resolvedAt).toBeTruthy();
  });

  it("已解决后可复发重开，并累计次数", () => {
    const t = mk();
    let list = loadTasks();
    while (list[0].stage !== "resolved") list = advanceTask(t.id);
    list = reopenTask(t.id);
    expect(list[0].stage).toBe("found");
    expect(list[0].reopenedCount).toBe(1);
  });

  it("设置负责人与删除", () => {
    const t = mk();
    let list = setAssignee(t.id, "小王");
    expect(list[0].assignee).toBe("小王");
    list = removeTask(t.id);
    expect(loadTasks()).toEqual([]);
  });

  it("阶段标签齐全且下一阶段链完整", () => {
    expect(STAGE_LABEL.found).toBe("发现");
    expect(STAGE_LABEL.resolved).toBe("已解决");
    expect(STAGE_NEXT.observing).toBe("resolved");
    expect(STAGE_NEXT.resolved).toBeNull();
  });
});
