const fs = require('fs');
let content = fs.readFileSync('src/initialData.ts', 'utf8');
let arrayStrMatch = content.match(/export const INITIAL_MENU_CATEGORIES[\s\S]*?=\s*(\[[\s\S]*\]);?/);
if (arrayStrMatch) {
    let arrayStr = arrayStrMatch[1];
    let cats = eval(arrayStr);
    cats.forEach(cat => {
        if (cat.name === '饮品分类' || cat.name === '主食 & 沙拉') {
            cat.items.forEach(item => {
                console.log(item.title, item.price);
            });
        }
    });
}
