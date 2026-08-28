import { create } from 'zustand';
import type { MenuCategory, AppSettings } from '../types/menu';
import { INITIAL_MENU_CATEGORIES, mergeAndOrderCategories } from '../initialData';
import { safeGetItem, safeSetItem } from '../utils/storage';

interface MenuState {
  categories: MenuCategory[];
  deletedItemIds: string[];
  promotions: any[];
  bgUrl: string;
  restaurantName: string;
  welcomeMessage: string;
  logoUrl: string;
  layoutStyle: 'grid'|'list'|'bento';
  theme: 'midnight'|'light';
  isSynced: boolean;
  setCategories: (c: MenuCategory[]) => void;
  setFromSettings: (s: AppSettings) => void;
}

export const useMenuStore = create<MenuState>((set, get)=>({
  categories: (()=> {
    const saved=safeGetItem('menuCategories'); const ver=safeGetItem('menuVersion');
    if(saved && ver==='2.0'){ try{ const parsed=JSON.parse(saved); const del=JSON.parse(safeGetItem('menuDeletedItemIds')||'[]'); return mergeAndOrderCategories(parsed, INITIAL_MENU_CATEGORIES, del) as any; } catch{} }
    return INITIAL_MENU_CATEGORIES as any;
  })(),
  deletedItemIds: (()=>{ try{ return JSON.parse(safeGetItem('menuDeletedItemIds')||'[]'); } catch{ return []; } })(),
  promotions: (()=>{ try{ return JSON.parse(safeGetItem('menuPromotions')||'[]'); } catch{ return []; } })(),
  bgUrl: safeGetItem('menuBgUrl')||'',
  restaurantName: safeGetItem('menuRestaurantName')||'炙·双味居',
  welcomeMessage: safeGetItem('menuWelcomeMessage')||'Premium Charcoal BBQ',
  logoUrl: safeGetItem('menuLogoUrl')||'',
  layoutStyle: (safeGetItem('menuLayoutStyle') as any)||'grid',
  theme: (safeGetItem('menuThemeMode') as any)||'midnight',
  isSynced:false,
  setCategories: (categories)=>{
    const { deletedItemIds } = get();
    // auto track deleted default ids
    const nextDel=[...deletedItemIds]; let changed=false;
    INITIAL_MENU_CATEGORIES.forEach(cat=>{(cat.items||[]).forEach((it:any)=>{
      const found=categories.some(c=>(c.items||[]).some((i:any)=>i.id===it.id));
      const idx=nextDel.indexOf(it.id);
      if(!found && idx===-1){ nextDel.push(it.id); changed=true; }
      if(found && idx!==-1){ nextDel.splice(idx,1); changed=true; }
    });});
    if(changed) safeSetItem('menuDeletedItemIds', JSON.stringify(nextDel));
    safeSetItem('menuCategories', JSON.stringify(categories));
    set({ categories, deletedItemIds: nextDel });
  },
  setFromSettings: (s)=>{
    if(s.categories) set({ categories: mergeAndOrderCategories(s.categories as any, INITIAL_MENU_CATEGORIES, s.deletedItemIds||[]) as any });
    if(s.deletedItemIds) set({ deletedItemIds: s.deletedItemIds });
    if(s.bgUrl!==undefined) set({ bgUrl: s.bgUrl });
    if(s.restaurantName!==undefined) set({ restaurantName: s.restaurantName });
    if(s.welcomeMessage!==undefined) set({ welcomeMessage: s.welcomeMessage });
    if(s.logoUrl!==undefined) set({ logoUrl: s.logoUrl });
    if(s.layoutStyle) set({ layoutStyle: s.layoutStyle });
    if(s.theme) set({ theme: s.theme });
    set({ isSynced:true });
  }
}));
