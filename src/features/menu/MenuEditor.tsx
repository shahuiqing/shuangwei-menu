// Extracted from AdminPanel.tsx ~800 lines - placeholder for incremental migration
// This file demonstrates the new feature-sliced structure. Full logic will be migrated step by step.
import { useState } from 'react';
import type { MenuCategory } from '../../types/menu';

export function MenuEditor({ categories, onChange }: { categories: MenuCategory[]; onChange:(c:MenuCategory[])=>void }){
  // TODO: migrate handleAddCategory/handleDeleteCategory/handleMoveCategory logic here (~600 lines)
  return <div className="p-4 border rounded">MenuEditor - migrated skeleton (categories: {categories.length})</div>;
}
