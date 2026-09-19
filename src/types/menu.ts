export type LayoutStyle = "grid" | "list" | "bento";
export type ThemeMode = "midnight" | "light";

export interface MenuItem extends Record<string, unknown> {
  id: string;
  title: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
  price: string; // e.g. "MAD75" or "75"
  description?: string;
  enDescription?: string;
  frDescription?: string;
  arDescription?: string;
  maDescription?: string;
  image: string; // http(s) url or data:image/* (will be normalized to url on save)
  allergens?: string[];
  stock?: number | string | null; // null = unlimited
  isSoldOut?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  enName?: string;
  frName?: string;
  arName?: string;
  maName?: string;
  items: MenuItem[];
}

export interface Promotion extends Record<string, unknown> {
  id: string;
  isActive: boolean;
  title: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
  description?: string;
  enDescription?: string;
  frDescription?: string;
  arDescription?: string;
  maDescription?: string;
  image: string;
}

export interface ReceiptSettings {
  storeName: string;
  showStoreName: boolean;
  showDate: boolean;
  showQrCode: boolean;
  fontSize: string;
  columnWidth: string;
  footerText1: string;
  footerText2: string;
  topLogoUrl: string;
  bottomLogoUrl: string;
  googleMapsReviewLink?: string;
  qrCodeFgColor?: string;
  qrCodeBgColor?: string;
  qrCodeLevel?: string;
  printLanguages?: string[];
}

export interface DevicePassword {
  name: string;
  password: string;
}

export interface AppSettings {
  id: string; // always 'global'
  categories: MenuCategory[];
  promotions: Promotion[];
  bgUrl: string;
  restaurantName: string;
  welcomeMessage: string;
  logoUrl: string;
  adminPassword: string;
  devicePasswords: DevicePassword[];
  securityQuestion: string;
  securityAnswer: string;
  soundEnabled: boolean;
  layoutStyle: LayoutStyle;
  receiptSettings: ReceiptSettings;
  deletedItemIds: string[];
  theme: ThemeMode;
}
