export type Language = 'zh' | 'en' | 'fr' | 'ar' | 'ma';

export interface MultilingualText {
  title: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
}

export interface MultilingualDesc extends MultilingualText {
  description?: string;
  enDescription?: string;
  frDescription?: string;
  arDescription?: string;
  maDescription?: string;
}
