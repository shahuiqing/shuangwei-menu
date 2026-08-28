const fs = require('fs');

let content = fs.readFileSync('src/initialData.ts', 'utf8');
let arrayStrMatch = content.match(/export const INITIAL_MENU_CATEGORIES[\s\S]*?=\s*(\[[\s\S]*\]);?/);

if (arrayStrMatch) {
    let arrayStr = arrayStrMatch[1];
    let cats = eval(arrayStr);

    cats.forEach(cat => {
        if (cat.name === '饮品分类' || cat.name === '主食 & 沙拉' || cat.id === 'all-drinks-menu' || cat.id === 'cat-staples') {
            if (cat.items) {
                cat.items.forEach(item => {
                    let priceStr = item.price || "0";
                    let prefix = priceStr.replace(/[0-9.].*/, '');
                    let numStr = priceStr.replace(/[^0-9.]/g, '');
                    let num = parseFloat(numStr) || 0;
                    
                    item.price = `${prefix}${Math.max(0, num - 6)}`;
                });
            }
        }
    });

    let newCatsStr = JSON.stringify(cats, null, 2);
    let newContent = content.replace(arrayStrMatch[1], newCatsStr);
    fs.writeFileSync('src/initialData.ts', newContent, 'utf8');
    console.log("Updated initialData.ts");
} else {
    console.log("Could not match array.");
}
