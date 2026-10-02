import { useEffect, useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import {
  quickReplyService,
  type QuickReply,
} from "../../services/quickReplies";

export function QuickRepliesTab() {
  const [list, setList] = useState<QuickReply[]>(() =>
    quickReplyService.list(),
  );
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(
    () => quickReplyService.subscribe(() => setList(quickReplyService.list())),
    [],
  );

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    quickReplyService.add(t);
    setDraft("");
  };

  const startEdit = (r: QuickReply) => {
    setEditingId(r.id);
    setEditingText(r.text);
  };

  const saveEdit = () => {
    if (editingId) quickReplyService.update(editingId, editingText);
    setEditingId(null);
    setEditingText("");
  };

  const copy = async (r: QuickReply) => {
    const ok = await quickReplyService.copy(r.text);
    if (ok) {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId((id) => (id === r.id ? null : id)), 1500);
    }
  };

  return (
    <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={20} className="text-orange-500" />
        <h3 className="text-lg font-semibold text-white">
          常用快捷回复 / Quick Replies
        </h3>
      </div>
      <p className="text-xs text-zinc-400 mb-4">
        维护常用话术（如「不要辣」「马上到」）。在订单/客服场景点一下即可复制粘贴，省去打字的麻烦。数据存于本机。
      </p>

      {/* Add row */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="输入新的快捷回复，回车添加…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors active:scale-95"
        >
          <Plus size={16} /> 添加
        </button>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center text-sm text-zinc-500 py-8 border border-dashed border-zinc-800 rounded-xl">
          还没有快捷回复，在上面添加一条吧
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((r, idx) => (
            <div
              key={r.id}
              className="flex items-center gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl"
            >
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => quickReplyService.move(r.id, "up")}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 rounded transition-colors"
                  title="上移"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={idx === list.length - 1}
                  onClick={() => quickReplyService.move(r.id, "down")}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 rounded transition-colors"
                  title="下移"
                >
                  <ArrowDown size={13} />
                </button>
              </div>

              {editingId === r.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingText}
                    autoFocus
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit();
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-zinc-950 border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Save size={13} /> 保存
                  </button>
                </div>
              ) : (
                <span className="flex-1 min-w-0 text-sm text-zinc-200 break-words">
                  {r.text}
                </span>
              )}

              {editingId !== r.id && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => copy(r)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      copiedId === r.id
                        ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-400"
                        : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-orange-500 hover:text-orange-400"
                    }`}
                    title="复制"
                  >
                    {copiedId === r.id ? (
                      <>
                        <Check size={13} /> 已复制
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> 复制
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="p-1.5 text-zinc-400 hover:text-orange-400 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => quickReplyService.remove(r.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
