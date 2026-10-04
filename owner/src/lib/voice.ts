/* ============ 语音录入（Web Speech，纯前端零后端） ============
 * 浏览器支持才启用（Chrome / Edge / 移动端 Chrome）；
 * 不支持时组件不渲染，输入框完全不受影响。
 */

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    ((w.SpeechRecognition || w.webkitSpeechRecognition) as
      RecognitionCtor | undefined | null) ?? null
  );
}

export function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

/** 识别结果回调里可读到的字段（只用到 transcript / isFinal / resultIndex） */
export interface RecEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

/** 汇总一次识别事件里的最终文本 */
export function finalTranscripts(ev: RecEvent): string {
  let out = "";
  for (let i = Math.max(0, ev.resultIndex); i < ev.results.length; i++) {
    const r = ev.results[i];
    if (r.isFinal) out += r[0].transcript;
  }
  return out;
}

/** 把识别文本接到已有输入后面：中文紧接，西文补一个空格 */
export function appendTranscript(base: string, chunk: string): string {
  const b = base.trimEnd();
  const c = chunk.trim();
  if (!b) return c;
  if (!c) return b;
  const cjk = "\u3400-\u9fff\u3000-\u303f";
  const needSpace =
    !new RegExp(`[${cjk}]$`).test(b) && !new RegExp(`^[${cjk}]`).test(c);
  return b + (needSpace ? " " : "") + c;
}
