// P1-8 修复：打印前转义，防止顾客名/备注 XSS 注入 innerHTML
function escHtml(s: any){ return String(s??'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string)); }
export const printReceipt = (
  order: any,
  currency: string = "MAD",
  receiptSettings?: any,
  isKitchenTicket?: boolean,
  ticketType?: "kitchen" | "addition" | "receipt"
) => {
  const isAddition = ticketType === "addition";
  const actualIsKitchen = isKitchenTicket || ticketType === "kitchen" || isAddition;
  const dateStr = order.timestamp
    ? new Date(order.timestamp).toLocaleString()
    : new Date().toLocaleString();

  const orderId =
    order.orderNumber || "ORD-" + Math.floor(Math.random() * 1000000);

  let itemsHtml = "";
  if (order.items && order.items.length > 0) {
    const isCheckout = !actualIsKitchen;
    const isWholeKitchenTicket = actualIsKitchen && !isAddition;

    const renderGroupedItems = (items: any[]) => {
      let html = "";
      const groupedItems: Record<string, any> = {};

      items.forEach((item: any) => {
        const identifier = item.id || item.name;
        if (groupedItems[identifier]) {
          groupedItems[identifier].quantity += (item.quantity || 1);
        } else {
          groupedItems[identifier] = { ...item, quantity: (item.quantity || 1) };
        }
      });

      Object.values(groupedItems).forEach((item: any) => {
        const price = item.price || 0;
        const qty = item.quantity || 1;
        const total = price * qty;

        const titles = [];
        const langs = receiptSettings?.printLanguages || [
          "zh",
          "en",
          "fr",
          "ar",
          "ma",
        ];
        if (langs.includes("zh") && item.name) titles.push(item.name);
        if (langs.includes("en") && item.enTitle) titles.push(item.enTitle);
        if (langs.includes("fr") && item.frTitle) titles.push(item.frTitle);
        if (langs.includes("ar") && item.arTitle) titles.push(item.arTitle);
        if (langs.includes("ma") && item.maTitle) titles.push(item.maTitle);

        const uniqueTitles = [...new Set(titles)].filter(Boolean);
        if (uniqueTitles.length === 0 && item.name) {
          uniqueTitles.push(item.name);
        }

        html += `
          <div class="item">
            <div class="item-name">
              ${uniqueTitles.map((t) => `<div dir="auto">${escHtml(t)}</div>`).join("")}
            </div>
            <div class="item-details">
              <span class="qty">x${escHtml(qty)}</span>
              ${!actualIsKitchen ? `<span class="price">${escHtml(currency)}${escHtml(total)}</span>` : ""}
            </div>
          </div>
        `;
      });
      return html;
    };

    if (isCheckout || isAddition) {
      // Checkout consolidates everything. Addition ticket consolidates all addition items.
      itemsHtml = renderGroupedItems(order.items);
    } else if (isWholeKitchenTicket) {
      // Whole kitchen ticket - separate original and added items
      const originalItems = order.items.filter((i: any) => !i.isAdded);
      const addedItems = order.items.filter((i: any) => i.isAdded);

      itemsHtml += renderGroupedItems(originalItems);

      if (addedItems.length > 0) {
        itemsHtml += `
          <div style="border-top: 1px dashed #000; margin: 3mm 0; text-align: center; padding: 2mm 0; font-weight: bold;">
            --- 加菜 / Additions ---
          </div>
        `;
        itemsHtml += renderGroupedItems(addedItems);
      }
    }
  }

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>打印小票 (Receipt)</title>
      <style>
        :root {
          --receipt-font-size: ${receiptSettings?.fontSize || "14px"};
          --receipt-col-width: ${receiptSettings?.columnWidth && receiptSettings?.columnWidth !== "100%" ? receiptSettings.columnWidth : "100%"};
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Courier New', Courier, monospace, 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #000;
          font-size: var(--receipt-font-size);
          width: var(--receipt-col-width);
        }
        .receipt {
          padding: 5mm;
          width: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 5mm;
        }
        .header h1 {
          margin: 0 0 2mm 0;
          font-size: 1.5em;
          font-weight: bold;
        }
        .header p {
          margin: 0;
          font-size: 0.9em;
        }
        .top-logo {
          max-width: 80%;
          height: auto;
          margin-bottom: 3mm;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .bottom-logo {
          max-width: 80%;
          height: auto;
          margin-top: 3mm;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 3mm 0;
        }
        .info {
          font-size: 1em;
          margin-bottom: 3mm;
        }
        .info div {
          margin-bottom: 1mm;
        }
        .items {
          margin-bottom: 3mm;
          font-size: 1em;
          width: 100%;
        }
        .item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2mm;
          width: 100%;
        }
        .item-name {
          flex: 1;
          text-align: left;
          word-break: break-all;
          padding-right: 2mm;
        }
        .item-details {
          flex-shrink: 0;
          display: flex;
          justify-content: flex-end;
          gap: 4mm;
          min-width: 30%;
          white-space: nowrap;
        }
        .item-details .qty {
          display: inline-block;
          text-align: right;
          min-width: 20px;
        }
        .item-details .price {
          display: inline-block;
          text-align: right;
          min-width: 40px;
        }
        .total-section {
          font-size: 1.2em;
          font-weight: bold;
          text-align: right;
          margin-top: 3mm;
        }
        .footer {
          text-align: center;
          margin-top: 5mm;
          font-size: 0.9em;
        }
        
        @media print {
          @page {
            margin: 0;
            ${receiptSettings?.columnWidth && receiptSettings?.columnWidth !== "100%" ? `size: ${receiptSettings.columnWidth} auto;` : ""}
          }
          body {
            width: var(--receipt-col-width);
            margin: 0 auto;
            padding: 2mm;
          }
          .receipt {
            padding: 0;
          }
          .item {
            page-break-inside: avoid;
            margin-bottom: 3mm;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }
          .total-section {
            border-top: 2px solid #000;
            padding-top: 2mm;
            margin-top: 2mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        ${
          receiptSettings?.topLogoUrl && /^https:\/\/|^data:image\//.test(receiptSettings.topLogoUrl)
            ? `<img src="${escHtml(receiptSettings.topLogoUrl)}" class="top-logo" alt="Top Logo" />`
            : ""
        }
        ${
          receiptSettings?.showStoreName !== false
            ? `
        <div class="header">
          <h1>${escHtml(isAddition ? "加菜单 / Additions" : actualIsKitchen ? "厨房单 / Kitchen Ticket" : receiptSettings?.storeName || "结账单 / Receipt")}</h1>
        </div>
        `
            : ""
        }
        
        <div class="info">
          <div><strong>桌号/顾客 (Table):</strong> ${escHtml(order.customerName || "未填写")}</div>
          <div><strong>订单号 (Order #):</strong> ${escHtml(orderId)}</div>
          ${receiptSettings?.showDate !== false ? `<div><strong>时间 (Time):</strong> ${escHtml(dateStr)}</div>` : ""}
        </div>
        
        <div class="divider"></div>
        
        <div class="items">
          ${itemsHtml}
        </div>
        
        <div class="divider"></div>
        
        ${
          !actualIsKitchen
            ? `
        <div class="total-section">
          <div><strong>原价 (Original):</strong> ${currency}${order.total || 0}</div>
          ${order.discountAmount ? `<div><strong>折扣 (Discount):</strong> -${currency}${order.discountAmount}</div>` : ""}
          ${order.finalTotal !== undefined ? `<div style="font-size: 1.1em; font-weight: bold; margin-top: 1mm;"><strong>应收 (Total):</strong> ${currency}${order.finalTotal}</div>` : ""}
          ${order.paymentMethod ? `<div style="margin-top: 1mm;"><strong>支付方式 (Payment):</strong> ${order.paymentMethod}</div>` : ""}
          ${order.receivedAmount !== undefined ? `<div><strong>实收 (Received):</strong> ${currency}${order.receivedAmount}</div>` : ""}
          ${order.changeAmount !== undefined && order.changeAmount > 0 ? `<div><strong>找零 (Change):</strong> ${currency}${order.changeAmount}</div>` : ""}
        </div>
        `
            : ""
        }
        
        <div class="footer">
          ${!actualIsKitchen && receiptSettings?.footerText1 ? `<p>${escHtml(receiptSettings.footerText1)}</p>` : ""}
          ${!actualIsKitchen && receiptSettings?.footerText2 ? `<p>${escHtml(receiptSettings.footerText2)}</p>` : ""}
          ${
            !actualIsKitchen && receiptSettings?.showQrCode !== false
              ? `
          <div style="margin-top: 5mm; display: flex; justify-content: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}" alt="Menu QR Code" style="width: 120px; height: 120px; display: block; margin: 0 auto;" />
          </div>
          <p style="font-size: 0.8em; margin-top: 2mm;">扫码查看在线菜单 (Scan to view our menu)</p>
          `
              : ""
          }
          ${
            receiptSettings?.bottomLogoUrl && /^https:\/\/|^data:image\//.test(receiptSettings.bottomLogoUrl)
              ? `<img src="${escHtml(receiptSettings.bottomLogoUrl)}" class="bottom-logo" alt="Bottom Logo" />`
              : ""
          }
        </div>
      </div>
    </body>
    </html>
  `;

  // Use hidden offscreen iframe to print directly in current page without opening new tab
  const existingIframe = document.getElementById("print-receipt-iframe");
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement("iframe");
  iframe.id = "print-receipt-iframe";
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  setTimeout(() => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    } catch (e) {
      console.error("Print failed:", e);
      alert("打印失败，请重试");
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 300);
};
