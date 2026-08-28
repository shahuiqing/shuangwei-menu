const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

code = code.replace(
`    const localOrdersStr = localStorage.getItem("local_orders");
    const localOrders = localOrdersStr ? JSON.parse(localOrdersStr) : [];

    const mergedMap = new Map<string, any>();`,
`    const localOrdersStr = localStorage.getItem("local_orders");
    let localOrders = localOrdersStr ? JSON.parse(localOrdersStr) : [];
    let needsSave = false;
    localOrders = localOrders.map((lo: any) => {
      if (!lo._id && !lo.id) needsSave = true;
      return normalizeOrder(lo);
    });
    if (needsSave) {
      localStorage.setItem("local_orders", JSON.stringify(localOrders));
    }

    const mergedMap = new Map<string, any>();`);

fs.writeFileSync('src/api.ts', code);
