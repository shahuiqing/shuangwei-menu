import { InventoryManager } from "./InventoryManager";

interface InventoryTabProps {
  categories: any[];
  setCategories: (categories: any[]) => void;
}

export function InventoryTab({ categories, setCategories }: InventoryTabProps) {
  return (
    <InventoryManager
      menuCategories={categories}
      onUpdateCategories={setCategories}
    />
  );
}
