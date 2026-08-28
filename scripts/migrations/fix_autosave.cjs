const fs = require('fs');

let adminContent = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Replace all instances of `if (onSaveToCloud) onSaveToCloud({..., silent: true})`
// But we want to preserve the async ones like Image Optimization that use await.
// Let's just remove the simple sync ones.
adminContent = adminContent.replace(/if\s*\(onSaveToCloud\)\s*onSaveToCloud\(\{\s*categories:\s*updatedCategories,\s*silent:\s*true\s*\}\);/g, '// autosave disabled');
adminContent = adminContent.replace(/if\s*\(onSaveToCloud\)\s*\{\s*onSaveToCloud\(\{\s*adminPassword:\s*newAdminPassword,\s*silent:\s*true\s*\}\);\s*\}/g, '// autosave disabled');
adminContent = adminContent.replace(/if\s*\(onSaveToCloud\)\s*\{\s*onSaveToCloud\(\{\s*devicePasswords:\s*updatedPasswords,\s*silent:\s*true\s*\}\);\s*\}/g, '// autosave disabled');

fs.writeFileSync('src/components/AdminPanel.tsx', adminContent, 'utf8');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(/handleSaveToCloud\(\{\s*categories:\s*newCategories,\s*silent:\s*true\s*\}\);/g, '// autosave disabled');
appContent = appContent.replace(/handleSaveToCloud\(\{\s*promotions:\s*newPromotions,\s*silent:\s*true\s*\}\);/g, '// autosave disabled');
fs.writeFileSync('src/App.tsx', appContent, 'utf8');

console.log("Disabled autosave");
