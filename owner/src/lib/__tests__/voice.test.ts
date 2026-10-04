import { describe, it, expect } from "vitest";
import {
  appendTranscript,
  speechSupported,
  finalTranscripts,
  type RecEvent,
} from "../voice";

describe("语音录入", () => {
  it("node 环境无 window → 不支持", () => {
    expect(speechSupported()).toBe(false);
  });

  it("中文紧接、西文补空格、空值安全", () => {
    expect(appendTranscript("牛肉面", "大碗")).toBe("牛肉面大碗");
    expect(appendTranscript("", "牛肉面")).toBe("牛肉面");
    expect(appendTranscript("牛肉面", "")).toBe("牛肉面");
    expect(appendTranscript("hello ", "world")).toBe("hello world");
    expect(appendTranscript("hello", " world")).toBe("hello world");
    expect(appendTranscript("  ", "牛肉面")).toBe("牛肉面");
  });

  it("finalTranscripts 只取最终结果", () => {
    const ev: RecEvent = {
      resultIndex: 1,
      results: [
        { isFinal: true, 0: { transcript: "红烧" } },
        { isFinal: false, 0: { transcript: "肉" } },
        { isFinal: true, 0: { transcript: "肉" } },
      ],
    };
    expect(finalTranscripts(ev)).toBe("肉");
  });
});
