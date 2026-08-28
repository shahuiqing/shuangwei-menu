// Placeholder for relational sync - actual impl will be moved from api.ts gradually
export async function syncCategoriesAndMenuItemsToSupabase(_categories: any[]): Promise<void> {
  // delegated to legacy api.ts for now to avoid duplication during migration
  const { api } = await import('../api');
  return (api as any).syncCategoriesAndMenuItemsToSupabase(_categories);
}
