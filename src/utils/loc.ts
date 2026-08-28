export type Language = 'zh' | 'en' | 'fr' | 'ar' | 'ma';

export function getLoc(item: any, lang: Language, type: 'title' | 'name' | 'desc') {
    if (!item) return '';
    let zh, en, fr, ar, ma;
    if (type === 'title') {
        zh = item.title; en = item.enTitle; fr = item.frTitle; ar = item.arTitle; ma = item.maTitle;
    } else if (type === 'name') {
        zh = item.name; en = item.enName; fr = item.frName; ar = item.arName; ma = item.maName;
    } else {
        zh = item.description; en = item.enDescription; fr = item.frDescription; ar = item.arDescription; ma = item.maDescription;
    }
    
    const f_zh = zh || '';
    const f_en = en || f_zh;
    const f_fr = fr || f_en;
    const f_ar = ar || f_en;
    const f_ma = ma || f_ar || f_en;
    
    if (lang === 'zh') return f_zh;
    if (lang === 'en') return f_en;
    if (lang === 'fr') return f_fr;
    if (lang === 'ar') return f_ar;
    if (lang === 'ma') return f_ma;
    return f_en;
}

export function getSubLoc(item: any, lang: Language, type: 'title' | 'name') {
    if (!item) return '';
    let zh, en;
    if (type === 'title') {
        zh = item.title; en = item.enTitle;
    } else if (type === 'name') {
        zh = item.name; en = item.enName;
    }
    const f_zh = zh || '';
    const f_en = en || f_zh;
    return lang === 'zh' ? f_en : f_zh;
}
