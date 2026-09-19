import { InventoryManager } from "./InventoryManager";
import type { MenuCategory } from "../../types/menu";

interface InventoryTabProps {
  categories: MenuCategory[];
  setCategories: (categories: MenuCategory[]) => void;
}

export function InventoryTab({ categories, setCategories }: InventoryTabProps) {
  return (
    <InventoryManager
      menuCategories={categories}
      onUpdateCategories={setCategories}
    />
  );
}
