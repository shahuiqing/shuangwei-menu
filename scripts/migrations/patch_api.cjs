const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

code = code.replace(/if \(cols\.includes\("id"\) && cols\.includes\("_id"\)\) \{\s*queryBuilder = queryBuilder\.or\(`id\.eq\.\$\{orderId\},_id\.eq\.\$\{orderId\}`\);\s*\} else if \(cols\.includes\("_id"\)\) \{\s*queryBuilder = queryBuilder\.eq\("_id", orderId\);\s*\}/g,
`if (cols.includes("_id")) {
          queryBuilder = queryBuilder.eq("_id", orderId);`);

fs.writeFileSync('src/api.ts', code);
