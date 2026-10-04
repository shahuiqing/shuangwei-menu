import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import {
  appendTranscript,
  finalTranscripts,
  recognitionCtor,
  type RecEvent,
  type RecognitionLike,
} from "../lib/voice";

/**
 * 语音输入按钮：点一下开始说，说完自动停。
 * 挂在任意受控输入框旁，识别结果追加到 value 尾部。
 * 浏览器不支持 Web Speech 时返回 null（不占位）。
 */
export function Dictation({
  value,
  onChange,
  lang = "zh-CN",
  className = "",
  title = "语音输入",
}: {
  value: string;
  onChange: (v: string) => void;
  lang?: string;
  className?: string;
  title?: string;
}) {
  const [listening, setListening] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const recRef = useRef<RecognitionLike | null>(null);
  const baseRef = useRef("");
  const heardRef = useRef("");

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const toggle = () => {
    if (listening) {
      stop();
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = false;
      baseRef.current = valueRef.current;
      heardRef.current = "";
      rec.onresult = (ev) => {
        heardRef.current += finalTranscripts(ev as RecEvent);
        onChange(appendTranscript(baseRef.current, heardRef.current));
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "停止语音输入" : title}
      aria-label={listening ? "停止语音输入" : title}
      className={`shrink-0 flex items-center justify-center rounded-lg transition-colors ${
        listening
          ? "text-red-400 bg-red-500/15 animate-pulse"
          : "text-zinc-500 hover:text-white hover:bg-white/5"
      } ${className}`}
    >
      <Mic size={16} />
    </button>
  );
}
