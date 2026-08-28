const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const migrationCode = `
  useEffect(() => {
    if (localStorage.getItem("price_migrated_2024_07_28_v3")) return;
    
    const migratePrices = async () => {
      try {
        const settings = await api.getSettings();
        let hasChanges = false;
        const cats = settings.categories ? [...settings.categories] : [];
        
        cats.forEach((cat: any) => {
          if (cat.items) {
            cat.items.forEach((item: any) => {
              let priceStr = item.price || "0";
              let prefix = priceStr.replace(/[0-9.].*/, '');
              let numStr = priceStr.replace(/[^0-9.]/g, '');
              let num = parseFloat(numStr) || 0;
              
              if (item.title === '小料' || item.title === '酱' || item.title.includes('酱') || item.title.includes('小料')) {
                  if (num !== 0) {
                      item.price = \`\${prefix}0\`;
                      hasChanges = true;
                  }
              } else {
                  item.price = \`\${prefix}\${num + 6}\`;
                  hasChanges = true;
              }
            });
          }
        });
        
        if (hasChanges) {
          await api.updateSettings({ categories: cats });
        }
        localStorage.setItem("price_migrated_2024_07_28_v3", "true");
      } catch (err) {
        console.error(err);
      }
    };
    migratePrices();
  }, []);
`;

content = content.replace("export default function App() {", "export default function App() {" + migrationCode);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log("Migration inserted into App.tsx");
