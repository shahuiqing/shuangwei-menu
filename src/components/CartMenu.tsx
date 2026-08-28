import { useState, useEffect } from "react";
import { X, Plus, Minus, ShoppingBag, Trash2, Loader2, Clock, ChefHat, CheckCircle2, Star, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getLoc, Language } from "../utils/loc";
import { api, isOrderOlderThan2Hours } from "../api";

interface CartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Record<string, number>;
  updateCart: (id: string, delta: number) => void;
  clearCart: () => void;
  categories: any[];
  language: Language;
  isAdminAuthed?: boolean;
  devicePasswords?: { name: string; password: string }[];
  scanSession?: any;
  receiptSettings?: any;
  onUpdateCategories?: (newCategories: any[]) => void;
}

export default function CartMenu({
  isOpen,
  onClose,
  cart,
  updateCart,
  clearCart,
  categories,
  language,
  isAdminAuthed,
  devicePasswords = [],
  scanSession,
  receiptSettings,
  onUpdateCategories,
}: CartMenuProps) {
  const [tableNumber, setTableNumber] = useState("");
  const [showTableInput, setShowTableInput] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  useEffect(() => {
    let unsubscribe: () => void;
    if (isOpen) {
      const params = new URLSearchParams(window.location.search);
      const tableParam = scanSession?.tableNo || params.get("table");
      if (tableParam) {
        unsubscribe = api.subscribeToCustomerOrder(tableParam, (order) => {
          setActiveOrder(order);
        });
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, scanSession]);

  const allItems = categories.flatMap((c) => c.items || []);
  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  // Calculate total
  const totalPrice = cartEntries.reduce((sum, [id, qty]) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return sum;
    // Extract first number from price string (e.g. "¥28 / 份" -> 28)
    const priceString = String(item.price || "0");
    const priceMatch = priceString.match(/\d+(\.\d+)?/);
    const priceNum = priceMatch ? parseFloat(priceMatch[0]) : 0;
    return sum + priceNum * qty;
  }, 0);

  const isRtl = language === "ar" || language === "ma";

  const [pendingAppendOrder, setPendingAppendOrder] = useState<{
    activeOrder: any;
    customerName: string;
    deviceName: string;
  } | null>(null);

  const executeFinalSubmit = async (customerName: string, deviceName: string, targetOrderIdToAppend?: string | null) => {
    await submitOrder(customerName, deviceName, targetOrderIdToAppend);
    setOrderSuccess(true);
    setTimeout(() => {
      setOrderSuccess(false);
      setShowTableInput(false);
      setTableNumber("");
      clearCart();
      onClose();
      setIsSubmitting(false);
    }, 1500);
  };

  const startSubmitFlow = async (customerName: string, deviceName: string) => {
    try {
      const verification = await api.verifyOrderValidity(customerName);
      if (verification.hasActiveOrder && verification.activeOrder) {
        setPendingAppendOrder({
          activeOrder: verification.activeOrder,
          customerName,
          deviceName,
        });
        setIsSubmitting(false);
        return;
      }

      await executeFinalSubmit(customerName, deviceName, null);
    } catch (e: any) {
      console.error("Order submission error:", e);
      alert(`提交订单失败: ${e?.message || "请重试。(Failed to place order)"}`);
      setIsSubmitting(false);
    }
  };

  const handleConfirmAppendChoice = async (isAppend: boolean) => {
    if (!pendingAppendOrder) return;
    const { activeOrder, customerName, deviceName } = pendingAppendOrder;
    setPendingAppendOrder(null);
    setIsSubmitting(true);
    try {
      const targetOrderId = isAppend ? (activeOrder._id || activeOrder.id) : null;
      await executeFinalSubmit(customerName, deviceName, targetOrderId);
    } catch (e: any) {
      console.error("Order submission error:", e);
      alert(`提交订单失败: ${e?.message || "请重试。(Failed to place order)"}`);
      setIsSubmitting(false);
    }
  };

  const submitOrder = async (customerName: string, deviceName: string, targetOrderIdToAppend?: string | null) => {
    try {
      const orderData = {
        customerName: customerName,
        orderNumber: "ORD-" + Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
        deviceInfo: deviceName,
        items: cartEntries.map(([id, qty]) => {
          const item = allItems.find((i) => i.id === id);
          const priceString = String(item?.price || "0");
          const priceMatch = priceString.match(/\d+(\.\d+)?/);
          return {
            id: item?.id || id,
            name: item?.title || id,
            enTitle: item?.enTitle || "",
            frTitle: item?.frTitle || "",
            arTitle: item?.arTitle || "",
            maTitle: item?.maTitle || "",
            quantity: qty,
            price: priceMatch && priceMatch[0] ? parseFloat(priceMatch[0]) : 0,
          };
        }),
        total: totalPrice,
        status: "pending",
      };

      if (targetOrderIdToAppend) {
        await api.appendDishesToOrder(targetOrderIdToAppend, orderData);
      } else {
        await api.addOrder(orderData);
      }

      // Deduct stock for ordered items
      let stockDeducted = false;
      const updatedCategories = categories.map((cat: any) => {
        const updatedItems = (cat.items || []).map((item: any) => {
          const orderItem = orderData.items.find((oi: any) => oi.id === item.id);
          if (orderItem && item.stock !== undefined && item.stock !== null) {
            const currentStock = Number(item.stock);
            if (!isNaN(currentStock)) {
              const newStock = Math.max(0, currentStock - orderItem.quantity);
              stockDeducted = true;
              return {
                ...item,
                stock: newStock,
                isSoldOut: newStock === 0 ? true : item.isSoldOut,
              };
            }
          }
          return item;
        });
        return { ...cat, items: updatedItems };
      });

      if (stockDeducted && onUpdateCategories) {
        onUpdateCategories(updatedCategories);
      }
      
      // Clear server-side cart for the table（EdgeOne：经 Supabase Realtime broadcast）
      const params = new URLSearchParams(window.location.search);
      const tableParam = scanSession?.tableNo || params.get("table");
      if (tableParam) {
        api.broadcastCartCleared(tableParam);
        
        // Notify admin（Supabase Realtime broadcast，替代原 /api/notify-admin）
        api.notifyAdmin({
          table: tableParam,
          notifyType: 'order_placed',
          type: 'order_placed',
          message: targetOrderIdToAppend
            ? `桌号 ${tableParam} 追加了加菜 (${orderData.items.length}项商品)`
            : `桌号 ${tableParam} 刚刚提交了新订单 (${orderData.items.length}项商品)`,
          action: targetOrderIdToAppend ? 'Add Dish' : 'New Order'
        });
      }
      
      console.log("✅ 订单已成功同步到后台管理系统！");
    } catch (err) {
      console.error("❌ 网络错误或数据解析失败，无法连接到后台系统:", err);
      throw err;
    }
  };

  const getAuthenticatedDevice = () => {
    if (!devicePasswords || devicePasswords.length === 0) return null;

    const savedToken = localStorage.getItem("deviceAuthToken");
    const expiry = localStorage.getItem("deviceAuthTokenExpiry");

    if (savedToken && expiry && Date.now() < parseInt(expiry, 10)) {
      const matchedDevice = devicePasswords.find(
        (d) => d.password === savedToken,
      );
      if (matchedDevice) return matchedDevice;
    }

    localStorage.removeItem("deviceAuthToken");
    localStorage.removeItem("deviceAuthTokenExpiry");
    return null;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckoutClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (scanSession) {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get("table");
      const tableNo = scanSession.tableNo || tableParam || "未知桌台";
      await startSubmitFlow(tableNo, "扫码点餐 (QR Scan)");
      return;
    }

    // If device passwords are required and not authenticated
    if (devicePasswords && devicePasswords.length > 0) {
      const matchedDevice = getAuthenticatedDevice();
      if (!matchedDevice && !isAdminAuthed) {
        alert(
          language === "zh"
            ? "未授权设备，请先点击页面右上角设置(齿轮图标)输入服务员密码进行认证。(Unauthorized device. Please authenticate in settings first.)"
            : "Unauthorized device. Please authenticate in settings first.",
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Proceed to table input if admin or authenticated device, else submit directly
    const matchedDevice = getAuthenticatedDevice();
    if (isAdminAuthed || matchedDevice) {
      setShowTableInput(true);
      setIsSubmitting(false);
    } else {
      await startSubmitFlow("店内扫码顾客", "未知设备 (Unknown)");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed top-0 bottom-0 ${isRtl ? "left-0" : "right-0"} w-full md:w-[400px] bg-zinc-950 border-${isRtl ? "r" : "l"} border-zinc-800 z-[120] flex flex-col shadow-2xl font-sans`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div
              className={`p-6 border-b border-zinc-800 flex items-center justify-between`}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="text-orange-500" size={24} />
                <h2 className="text-xl font-serif text-zinc-50 font-bold">
                  {language === "zh"
                    ? "已选菜品"
                    : language === "fr"
                      ? "Panier"
                      : language === "ar"
                        ? "سلة الطلبات"
                        : language === "ma"
                          ? "سلة الطلبات"
                          : "Your Order"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Order Status Banner */}
            {activeOrder && (
              <div className="bg-zinc-900 border-b border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400">订单状态 (Order Status)</span>
                  <span className="text-xs font-mono text-zinc-500">{activeOrder.orderNumber}</span>
                </div>
                <div className="flex items-center gap-3">
                  {(!activeOrder.status || activeOrder.status === "pending") && (
                    <div className="flex items-center gap-2 text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg w-full border border-orange-500/20">
                      <Clock size={16} className="animate-pulse" />
                      <span className="font-bold text-sm">已下单，待接单 (Pending)</span>
                    </div>
                  )}
                  {activeOrder.status === "preparing" && (
                    <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg w-full border border-blue-500/20">
                      <ChefHat size={16} className="animate-bounce" />
                      <span className="font-bold text-sm">后厨制作中 (Preparing)</span>
                    </div>
                  )}
                  {activeOrder.status === "served" && (
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center gap-2 text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-lg w-full border border-teal-500/20">
                        <CheckCircle2 size={16} />
                        <span className="font-bold text-sm">已上菜，请慢用 (Served)</span>
                      </div>
                      {receiptSettings?.googleMapsReviewLink && (
                        <a
                          href={receiptSettings.googleMapsReviewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-2 rounded-lg w-full border border-orange-500/20 transition-colors"
                        >
                          <Star size={16} className="fill-orange-500" />
                          <span className="font-bold text-sm">给我们在谷歌地图上留下好评！</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {cartEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 opacity-60">
                  <ShoppingBag size={48} strokeWidth={1} />
                  <p>
                    {language === "zh" ? "购物车是空的" : "Your cart is empty"}
                  </p>
                </div>
              ) : (
                cartEntries.map(([id, qty]) => {
                  const item = allItems.find((i) => i.id === id);
                  if (!item) return null;

                  return (
                    <div key={id} className="flex gap-4 items-center">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-16 h-16 rounded-xl object-cover bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-zinc-100 truncate">
                          {getLoc(item, language, "title")}
                        </h3>
                        <p className="text-xs text-orange-500 mt-1">
                          {item.price}
                        </p>
                        {item.isSoldOut && (
                          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                            {language === "zh" ? "已售罄" : language === "en" ? "Sold Out" : language === "fr" ? "Épuisé" : language === "ar" || language === "ma" ? "مباع" : "Sold Out"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                        <button
                          onClick={() => updateCart(id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold w-4 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => {
                            if (!item.isSoldOut) {
                              updateCart(id, 1);
                            }
                          }}
                          disabled={item.isSoldOut}
                          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${item.isSoldOut ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-orange-600'}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {cartEntries.length > 0 &&
              (() => {
                // Extract currency symbol dynamically from cart items or all items
                let currencySymbol = "¥";
                const firstItemWithSymbol = cartEntries
                  .map(([id]) => allItems.find((i) => i.id === id))
                  .find(
                    (i) => i && i.price && /[^\d.\s]/.test(String(i.price)),
                  );
                if (firstItemWithSymbol && firstItemWithSymbol.price) {
                  currencySymbol = String(firstItemWithSymbol.price).replace(
                    /[\d.\s]/g,
                    "",
                  );
                } else {
                  const anyItemWithSymbol = allItems.find(
                    (i) => i && i.price && /[^\d.\s]/.test(String(i.price)),
                  );
                  if (anyItemWithSymbol && anyItemWithSymbol.price) {
                    currencySymbol = String(anyItemWithSymbol.price).replace(
                      /[\d.\s]/g,
                      "",
                    );
                  } else {
                    currencySymbol = "";
                  }
                }

                return (
                  <div className="p-6 bg-zinc-900/50 border-t border-zinc-800">
                    <div className="flex items-end justify-between mb-6">
                      <span className="text-zinc-400">Total</span>
                      <span className="text-3xl font-serif font-bold text-orange-500">
                        {currencySymbol}
                        {totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {orderSuccess ? (
                        <div className="bg-green-500/20 text-green-400 border border-green-500/50 p-4 rounded-xl text-center font-bold">
                          {language === "zh"
                            ? "下单成功！"
                            : "Order Placed Successfully!"}
                        </div>
                      ) : showTableInput ? (
                        <div className="space-y-2">
                          <label className="text-xs text-orange-400 font-medium flex items-center gap-1.5">
                            <span>📌</span>
                            {language === "zh"
                              ? "请输入或确认用餐桌号："
                              : language === "fr"
                                ? "Numéro de table :"
                                : language === "ar" || language === "ma"
                                  ? "أدخل رقم الطاولة:"
                                  : "Enter Table Number:"}
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder={
                                language === "zh" ? "例如: 7" : "e.g. 7"
                              }
                              value={tableNumber}
                              onChange={(e) => setTableNumber(e.target.value)}
                              className="flex-1 bg-zinc-800 border border-orange-500/50 rounded-xl px-4 py-3 text-white text-base font-bold focus:outline-none focus:border-orange-500"
                              autoFocus
                            />
                            <button
                              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-center cursor-pointer shadow-lg shadow-orange-600/30"
                              onClick={async () => {
                                if (!tableNumber) return;
                                const matchedDevice = getAuthenticatedDevice();
                                const deviceName =
                                  matchedDevice?.name ||
                                  (isAdminAuthed
                                    ? "管理员端 (Admin)"
                                    : "未知设备 (Unknown)");

                                await startSubmitFlow(`桌号_${tableNumber}`, deviceName);
                              }}
                            >
                              {language === "zh" ? "确认下单" : "Confirm"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={clearCart}
                            className="p-3 bg-zinc-800 text-zinc-400 hover:bg-red-900/30 hover:text-red-500 rounded-xl transition-colors border border-zinc-700"
                            title="Clear Cart"
                          >
                            <Trash2 size={24} />
                          </button>
                          <button
                            className={`flex-1 ${isSubmitting ? 'bg-orange-500/50 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 cursor-pointer'} text-white font-bold py-3 px-6 rounded-xl transition-colors text-center flex justify-center items-center gap-2`}
                            onClick={handleCheckoutClick}
                            disabled={isSubmitting}
                          >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {language === "zh"
                              ? "提交订单"
                              : language === "fr"
                                ? "Passer la commande"
                                : language === "ar"
                                  ? "تأكيد الطلب"
                                  : language === "ma"
                                    ? "تأكيد الطلب"
                                    : "Place Order"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
          </motion.div>
        </>
      )}

      {pendingAppendOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {language === "zh" ? "检测到进行中订单" : "Active Order Found"}
            </h3>
            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
              {language === "zh"
                ? `该桌号 (${pendingAppendOrder.customerName}) 当前已有未结账的订单 (${pendingAppendOrder.activeOrder.orderNumber})。`
                : `Active unpaid order (${pendingAppendOrder.activeOrder.orderNumber}) found for ${pendingAppendOrder.customerName}.`}
            </p>

            <p className="text-xs text-zinc-400 mb-5">
              {language === "zh" ? "请选择本次提交方式：" : "Please select submission method:"}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleConfirmAppendChoice(true)}
                className="w-full py-3 rounded-xl transition-colors text-sm font-bold flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 cursor-pointer"
              >
                <PlusCircle size={18} />
                {language === "zh" ? "追加加菜 (合并至当前订单)" : "Add Dish to Current Order"}
              </button>
              <button
                onClick={() => handleConfirmAppendChoice(false)}
                className="w-full py-3 rounded-xl transition-colors text-sm font-bold flex items-center justify-center gap-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
              >
                <Plus size={18} />
                {language === "zh" ? "开立独立新订单" : "Create New Separate Order"}
              </button>
              <button
                onClick={() => {
                  setPendingAppendOrder(null);
                  setIsSubmitting(false);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-400 mt-2 py-1 cursor-pointer"
              >
                {language === "zh" ? "取消" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
