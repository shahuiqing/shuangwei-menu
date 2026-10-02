import {
  ShoppingBag,
  LayoutList,
  Flame,
  Palette,
  Wrench,
  Scan,
  Printer,
  Shield,
  Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminTab =
  | "menu"
  | "promotions"
  | "appearance"
  | "tools"
  | "security"
  | "database"
  | "orders"
  | "printer"
  | "qr";

const TABS: {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "orders", label: "订单记录", icon: ShoppingBag },
  { id: "menu", label: "菜单管理", icon: LayoutList },
  { id: "promotions", label: "活动管理", icon: Flame },
  { id: "appearance", label: "外观设置", icon: Palette },
  { id: "tools", label: "实用工具", icon: Wrench },
  { id: "qr", label: "扫码点餐", icon: Scan },
  { id: "printer", label: "打印机设置", icon: Printer },
  { id: "security", label: "账户安全", icon: Shield },
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
      className="flex overflow-x-auto space-x-2 border-b border-zinc-800 pb-2 custom-scrollbar pr-8 hide-scrollbar cursor-grab active:cursor-grabbing"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === id ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
