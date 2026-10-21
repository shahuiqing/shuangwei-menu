import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getLlmConfig,
  setLlmConfig,
  clearLlmConfig,
  hasLlm,
  chatLLM,
  chatLLMVision,
  testLlm,
  testLlmEndpoints,
  resetLlmHealth,
  LLM_CFG_KEY,
  type LlmEndpoint,
} from "../llm";
import { llmSystemPrompt, ask, type AssistantData } from "../assistant";
import { exportLocalData } from "../localdb";

const endpoint = (patch: Partial<LlmEndpoint> = {}): LlmEndpoint => ({
  id: "ep-1",
  name: "主接口",
  baseUrl: "https://x/v1",
  apiKey: "k",
  model: "m",
  enabled: true,
  ...patch,
});

const useEndpoints = (...endpoints: LlmEndpoint[]) =>
  setLlmConfig({ endpoints });

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  resetLlmHealth();
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
    expect(getLlmConfig()).toEqual({ endpoints: [] });
    store.set(LLM_CFG_KEY, "{oops");
    expect(getLlmConfig()).toEqual({ endpoints: [] });
  });

  it("保存多个接口后可读回，baseUrl 去掉尾部斜杠", () => {
    useEndpoints(
      endpoint({ baseUrl: "https://api.deepseek.com/v1/", model: "m1" }),
      endpoint({ id: "ep-2", name: "备用", baseUrl: "https://b/v1" }),
    );
    const cfg = getLlmConfig();
    expect(cfg.endpoints).toHaveLength(2);
    expect(cfg.endpoints[0].baseUrl).toBe("https://api.deepseek.com/v1");
    expect(cfg.endpoints[0].model).toBe("m1");
    expect(cfg.endpoints[1].name).toBe("备用");
    clearLlmConfig();
    expect(hasLlm()).toBe(false);
  });

  it("兼容旧的单接口配置", () => {
    store.set(
      LLM_CFG_KEY,
      JSON.stringify({
        baseUrl: "https://legacy/v1/",
        apiKey: "old-key",
        model: "old-model",
      }),
    );
    const cfg = getLlmConfig();
    expect(cfg.endpoints).toHaveLength(1);
    expect(cfg.endpoints[0].name).toBe("默认接口");
    expect(cfg.endpoints[0].baseUrl).toBe("https://legacy/v1");
    expect(cfg.endpoints[0].apiKey).toBe("old-key");
    expect(hasLlm()).toBe(true);
  });

  it("hasLlm 需有启用且三项齐全的接口", () => {
    expect(hasLlm()).toBe(false);
    useEndpoints(endpoint({ apiKey: "" }));
    expect(hasLlm()).toBe(false);
    useEndpoints(endpoint({ enabled: false }));
    expect(hasLlm()).toBe(false);
    useEndpoints(endpoint());
    expect(hasLlm()).toBe(true);
  });

  it("Key 不进入备份导出（不在 LOCAL_KEYS 白名单）", () => {
    useEndpoints(endpoint({ apiKey: "sk-secret" }));
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
    useEndpoints(endpoint());
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
    useEndpoints(endpoint());
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
    useEndpoints(endpoint());
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
    useEndpoints(endpoint({ apiKey: "sk-1" }));
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

  it("首选失败后自动切换，异常接口进入冷却", async () => {
    useEndpoints(
      endpoint({ id: "a", name: "主", baseUrl: "https://a/v1" }),
      endpoint({ id: "b", name: "备", baseUrl: "https://b/v1" }),
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://a/")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "备" } }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatLLM("s", "u")).toBe("备");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://a/v1/chat/completions",
      "https://b/v1/chat/completions",
    ]);
    expect(await chatLLM("s", "u")).toBe("备");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://a/v1/chat/completions",
      "https://b/v1/chat/completions",
      "https://b/v1/chat/completions",
    ]);
  });

  it("全部接口失败返回 null", async () => {
    useEndpoints(
      endpoint({ id: "a", baseUrl: "https://a/v1" }),
      endpoint({ id: "b", baseUrl: "https://b/v1" }),
    );
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatLLM("s", "u")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("testLlm 未配置返回提示；配置后透传结果", async () => {
    const r0 = await testLlm();
    expect(r0.ok).toBe(false);
    useEndpoints(endpoint());
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

  it("testLlmEndpoints 逐个探测并汇总可用数量", async () => {
    useEndpoints(
      endpoint({ id: "a", name: "主", baseUrl: "https://a/v1" }),
      endpoint({ id: "b", name: "备", baseUrl: "https://b/v1" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("https://a/")) {
          return { ok: false, status: 401, json: async () => ({}) };
        }
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        };
      }),
    );
    const report = await testLlmEndpoints();
    expect(report.ok).toBe(true);
    expect(report.msg).toBe("1/2 个接口可用");
    expect(report.results.find((item) => item.id === "a")?.ok).toBe(false);
    expect(report.results.find((item) => item.id === "b")?.ok).toBe(true);
  });
});

describe("chatLLMVision", () => {
  it("未配置或无图片时返回 null 且不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await chatLLMVision("s", "u", ["data:image/jpeg;base64,AAA"]),
    ).toBeNull();
    useEndpoints(endpoint());
    expect(await chatLLMVision("s", "u", [])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("发送 text + image_url 多模态内容，并解析数组形式的返回", async () => {
    useEndpoints(endpoint({ model: "vision" }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [{ type: "text", text: '{"ok":true}' }],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await chatLLMVision("sys", "看图", [
      "data:image/jpeg;base64,AAA",
      "data:image/png;base64,BBB",
    ]);
    expect(out).toBe('{"ok":true}');
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      max_tokens: number;
      messages: { content: unknown }[];
    };
    expect(body.model).toBe("vision");
    expect(body.max_tokens).toBe(3000);
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "看图" },
      {
        type: "image_url",
        image_url: { url: "data:image/jpeg;base64,AAA" },
      },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,BBB" },
      },
    ]);
  });

  it("非 2xx 返回 null", async () => {
    useEndpoints(endpoint({ model: "vision" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(
      await chatLLMVision("s", "u", ["data:image/jpeg;base64,AAA"]),
    ).toBeNull();
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
