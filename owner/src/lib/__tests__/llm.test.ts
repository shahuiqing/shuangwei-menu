import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getLlmConfig,
  setLlmConfig,
  clearLlmConfig,
  hasLlm,
  chatLLM,
  testLlm,
  LLM_CFG_KEY,
} from "../llm";
import { llmSystemPrompt, ask, type AssistantData } from "../assistant";
import { exportLocalData } from "../localdb";

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
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LLM 配置（仅本机）", () => {
  it("默认为空配置；坏 JSON 回落默认", () => {
    expect(getLlmConfig()).toEqual({ baseUrl: "", apiKey: "", model: "" });
    store.set(LLM_CFG_KEY, "{oops");
    expect(getLlmConfig()).toEqual({ baseUrl: "", apiKey: "", model: "" });
  });

  it("保存后可读回，baseUrl 去掉尾部斜杠", () => {
    setLlmConfig({ baseUrl: "https://api.deepseek.com/v1/", model: "m1" });
    expect(getLlmConfig().baseUrl).toBe("https://api.deepseek.com/v1");
    expect(getLlmConfig().model).toBe("m1");
    clearLlmConfig();
    expect(hasLlm()).toBe(false);
  });

  it("hasLlm 需三项齐全", () => {
    expect(hasLlm()).toBe(false);
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "k" });
    expect(hasLlm()).toBe(false);
    setLlmConfig({ model: "m" });
    expect(hasLlm()).toBe(true);
  });

  it("Key 不进入备份导出（不在 LOCAL_KEYS 白名单）", () => {
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "sk-secret", model: "m" });
    expect(JSON.parse(exportLocalData()).data[LLM_CFG_KEY]).toBeUndefined();
    expect(store.get(LLM_CFG_KEY)).toContain("sk-secret");
  });
});

describe("chatLLM", () => {
  it("未配置时返回 null 且不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatLLM("s", "u")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("成功返回首个 choice 文本", async () => {
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "k", model: "m" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: " 你好 " } }],
        }),
      })),
    );
    expect(await chatLLM("s", "u")).toBe("你好");
  });

  it("非 2xx / 坏响应 / 网络异常一律 null", async () => {
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "k", model: "m" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await chatLLM("s", "u")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [] }),
      })),
    );
    expect(await chatLLM("s", "u")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect(await chatLLM("s", "u")).toBeNull();
  });

  it("超时 abort 返回 null", async () => {
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "k", model: "m" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_res, rej) => {
            init.signal.addEventListener("abort", () =>
              rej(new Error("aborted")),
            );
          }),
      ),
    );
    expect(await chatLLM("s", "u", { timeoutMs: 20 })).toBeNull();
  });

  it("请求头带 Authorization，路径为 baseUrl/chat/completions", async () => {
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "sk-1", model: "m" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await chatLLM("sys", "hi");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://x/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-1",
    );
  });

  it("testLlm 未配置返回提示；配置后透传结果", async () => {
    const r0 = await testLlm();
    expect(r0.ok).toBe(false);
    setLlmConfig({ baseUrl: "https://x/v1", apiKey: "k", model: "m" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      })),
    );
    const r1 = await testLlm();
    expect(r1.ok).toBe(true);
  });
});

describe("llmSystemPrompt", () => {
  const d: AssistantData = {
    revenue: 1234,
    orders: 20,
    aov: 61.7,
    foodCost: 400,
    foodCostRate: 32.4,
    waste: 12,
    profit: 834,
    topProblem: "出餐慢",
  };

  it("包含真实数据与店铺上下文", () => {
    const p = llmSystemPrompt(d, ["营业额 ¥1,234"]);
    expect(p).toContain("1,234");
    expect(p).toContain("32.4%");
    expect(p).toContain("出餐慢");
    expect(p).toContain("营业额 ¥1,234");
    expect(p).toContain("不要编造");
  });

  it("无问题时写明暂无", () => {
    expect(llmSystemPrompt({ ...d, topProblem: null })).toContain(
      "当前最大问题：暂无",
    );
  });

  it("规则版 ask 与 AI 提示共存（降级路径可用）", () => {
    expect(ask("今天营业额多少", d)).toContain("1,234");
  });
});
