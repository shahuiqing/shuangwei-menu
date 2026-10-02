import {
  ShoppingBag,
  LayoutList,
  Flame,
  Palette,
  Wrench,
  Scan,
  Printer,
  Shield,
  ShieldCheck,
  Database,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminTab =
  | "menu"
  | "promotions"
  | "appearance"
  | "tools"
  | "security"
  | "database"
  | "datasecurity"
  | "quickreplies"
  | "orders"
  | "printer"
  | "qr";

const TABS: {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "orders", label: "订单记录", icon: ShoppingBag },
  { id: "quickreplies", label: "快速回复", icon: MessageSquare },
  { id: "menu", label: "菜单管理", icon: LayoutList },
  { id: "promotions", label: "活动管理", icon: Flame },
  { id: "appearance", label: "外观设置", icon: Palette },
  { id: "tools", label: "实用工具", icon: Wrench },
  { id: "qr", label: "扫码点餐", icon: Scan },
  { id: "printer", label: "打印机设置", icon: Printer },
  { id: "security", label: "账户安全", icon: Shield },
  { id: "datasecurity", label: "数据安全", icon: ShieldCheck },
  { id: "database", label: "数据与备份 (Database)", icon: Database },
];

export function AdminTabNav({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <div
      onWheel={(e) => {
        if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
      }}
      className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-x-visible border-b border-zinc-800 pb-3 pr-2 touch-pan-x"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${activeTab === id ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
