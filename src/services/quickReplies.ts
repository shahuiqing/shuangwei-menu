/**
 * 常用快捷回复（短语库）
 *
 * 存于本机 localStorage，不依赖数据库；用于收银/客服场景一键复制常用话术。
 */

export interface QuickReply {
  id: string;
  text: string;
}

const STORAGE_KEY = "menu_quick_replies";

const DEFAULT_TEXTS: string[] = [
  "不要辣 / No spicy",
  "少放盐 / Less salt",
  "谢谢光临，欢迎下次再来！",
  "请稍等，马上为您安排。",
  "已收到，马上到！",
];

type Listener = () => void;
const listeners: Listener[] = [];

function genId() {
  return (
    "qr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  );
}

function read(): QuickReply[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // 首次使用：写入示例短语
      const seeded = DEFAULT_TEXTS.map((text, i) => ({
        id: `qr-default-${i}`,
        text,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x.text === "string")
      : [];
  } catch {
    return [];
  }
}

function write(list: QuickReply[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[quickReplies] 保存失败（可能超出存储配额）", e);
  }
  listeners.forEach((cb) => cb());
}

export const quickReplyService = {
  list(): QuickReply[] {
    return read();
  },

  add(text: string): QuickReply | null {
    const t = (text || "").trim();
    if (!t) return null;
    const item: QuickReply = { id: genId(), text: t };
    write([...read(), item]);
    return item;
  },

  update(id: string, text: string): void {
    const t = (text || "").trim();
    if (!t) return;
    write(read().map((r) => (r.id === id ? { ...r, text: t } : r)));
  },

  remove(id: string): void {
    write(read().filter((r) => r.id !== id));
  },

  move(id: string, direction: "up" | "down"): void {
    const list = read();
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) return;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const [item] = list.splice(i, 1);
    if (item) list.splice(j, 0, item);
    write(list);
  },

  subscribe(cb: Listener): () => void {
    listeners.push(cb);
    return () => {
      const i = listeners.indexOf(cb);
      if (i > -1) listeners.splice(i, 1);
    };
  },

  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  },
};
