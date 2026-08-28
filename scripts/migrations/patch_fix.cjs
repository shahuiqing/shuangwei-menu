const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

code = code.replace(/queryBuilder\.eq\("_id", orderId\); else/g, 'queryBuilder.eq("_id", orderId);\n        } else');

fs.writeFileSync('src/api.ts', code);
