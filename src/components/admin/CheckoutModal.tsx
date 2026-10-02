import { NUMPAD_KEYS } from "./adminConstants";

export interface CheckoutResult {
  finalTotal: number;
  discountAmount: number;
  receivedAmount: number;
  changeAmount: number;
}

const PAYMENT_METHODS = [
  { id: "微信支付", label: "微信支付", icon: "💬" },
  { id: "现金", label: "现金", icon: "💵" },
  { id: "POS机", label: "POS刷卡", icon: "💳" },
  { id: "支付宝", label: "支付宝", icon: "📱" },
  { id: "其他", label: "其他", icon: "✨" },
];

const DISCOUNT_PRESETS = [
  { label: "9折", mode: "rate", val: "9" },
  { label: "8.5折", mode: "rate", val: "8.5" },
  { label: "8折", mode: "rate", val: "8" },
  { label: "半价(5折)", mode: "rate", val: "5" },
];

export function CheckoutModal({
  order,
  currency,
  paymentMethod,
  onPaymentMethodChange,
  discountMode,
  onDiscountModeChange,
  discountStr,
  onDiscountStrChange,
  receivedStr,
  onReceivedStrChange,
  activeField,
  onActiveFieldChange,
  onCancel,
  onComplete,
}: {
  order: any;
  currency: string;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  discountMode: "amount" | "rate";
  onDiscountModeChange: (mode: "amount" | "rate") => void;
  discountStr: string;
  onDiscountStrChange: (value: string) => void;
  receivedStr: string;
  onReceivedStrChange: (value: string) => void;
  activeField: "discount" | "received";
  onActiveFieldChange: (field: "discount" | "received") => void;
  onCancel: () => void;
  onComplete: (result: CheckoutResult) => void;
}) {
  const rawDiscountNum = parseFloat(discountStr) || 0;
  let parsedDiscount = 0;
  if (discountMode === "rate") {
    let rate = rawDiscountNum;
    if (rate > 10 && rate <= 100) rate = rate / 10;
    if (rate > 0 && rate < 10) {
      const total = order?.total || 0;
      parsedDiscount = total * (1 - rate / 10);
    } else if (rate === 10 || rate === 0) {
      parsedDiscount = 0;
    }
  } else {
    parsedDiscount = rawDiscountNum;
  }
  const parsedReceived = parseFloat(receivedStr) || 0;

  const handleNumpadInput = (key: string) => {
    const prev = activeField === "discount" ? discountStr : receivedStr;
    const setState =
      activeField === "discount" ? onDiscountStrChange : onReceivedStrChange;

    if (key === "C") return setState("0");
    if (key === "⌫") return setState(prev.length > 1 ? prev.slice(0, -1) : "0");
    if (key === ".") {
      if (prev.includes(".")) return;
      return setState(prev + ".");
    }
    setState(prev === "0" && key !== "." ? key : prev + key);
  };

  if (!order) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto touch-pan-y"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl flex flex-col md:flex-row shadow-2xl max-h-[90dvh] my-auto overflow-y-auto custom-scrollbar">
        {/* Left Column: Order Summary & Inputs */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          <h3 className="text-xl font-bold text-white mb-4">
            订单结账 (Checkout)
          </h3>
          <div className="space-y-4 mb-6 flex-1">
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-1">
                订单总金额 (Total Amount)
              </label>
              <div className="text-2xl font-bold text-white">
                {currency} {order.total}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">
                结算方式 (Payment Method)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => onPaymentMethodChange(pm.id)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === pm.id
                        ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-500/20"
                        : "bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                    }`}
                  >
                    <span>{pm.icon}</span>
                    <span>{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                activeField === "discount"
                  ? "border-orange-500 bg-orange-500/10 shadow-sm"
                  : "border-zinc-800 bg-zinc-800/40"
              }`}
              onClick={() => onActiveFieldChange("discount")}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                  🏷️ 打折/优惠额度 (Discount)
                </label>
                <div className="flex bg-zinc-900 border border-zinc-700 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscountModeChange("amount");
                      onDiscountStrChange("0");
                      onActiveFieldChange("discount");
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      discountMode === "amount"
                        ? "bg-orange-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    立减金额 (￥)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscountModeChange("rate");
                      onDiscountStrChange("8.5");
                      onActiveFieldChange("discount");
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      discountMode === "rate"
                        ? "bg-orange-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    折率/几折 (折)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                    {discountMode === "amount" ? "￥" : "折"}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountStr}
                    onChange={(e) => {
                      onDiscountStrChange(e.target.value);
                    }}
                    onFocus={() => onActiveFieldChange("discount")}
                    placeholder={
                      discountMode === "amount"
                        ? "输入立减金额 (如 15)"
                        : "输入折扣率 (如 8.8)"
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-orange-500 rounded-xl pl-8 pr-3 py-2 text-lg font-bold text-white outline-none transition-colors"
                  />
                </div>
              </div>

              {discountMode === "rate" && (
                <div className="text-xs text-orange-400 font-medium mb-2 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                  当前为{" "}
                  {rawDiscountNum > 0
                    ? rawDiscountNum > 10
                      ? (rawDiscountNum / 10).toFixed(1)
                      : rawDiscountNum
                    : 10}{" "}
                  折，优惠折算立减 {currency} {parsedDiscount.toFixed(2)}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  ...DISCOUNT_PRESETS,
                  {
                    label: "免单",
                    mode: "amount",
                    val: String(order.total || 0),
                  },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscountModeChange(d.mode as any);
                      onDiscountStrChange(d.val);
                      onActiveFieldChange("received");
                    }}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-xs font-semibold text-zinc-200 rounded-lg transition-all border border-zinc-700"
                  >
                    {d.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const val = prompt(
                      "请输入自定义打折额度：\n- 输入折扣率（如 8.8 表示 8.8折）\n- 或输入立减金额（如 20 表示减免 20 元）",
                      discountStr || "8.5",
                    );
                    if (val !== null && val.trim() !== "") {
                      const trimmed = val.trim();
                      const num = parseFloat(trimmed);
                      if (!isNaN(num)) {
                        if (num > 0 && num < 10) {
                          onDiscountModeChange("rate");
                          onDiscountStrChange(trimmed);
                        } else {
                          onDiscountModeChange("amount");
                          onDiscountStrChange(trimmed);
                        }
                        onActiveFieldChange("received");
                      }
                    }
                  }}
                  className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 active:scale-95 text-xs font-semibold rounded-lg transition-all border border-orange-500/30 flex items-center gap-1"
                >
                  ✏️ 自定义打折
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-1">
                折后应收 (After Discount)
              </label>
              <div className="text-xl font-bold text-orange-500">
                {currency}{" "}
                {Math.max(0, (order.total || 0) - parsedDiscount).toFixed(2)}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border transition-all ${
                activeField === "received"
                  ? "border-orange-500 bg-orange-500/10 shadow-sm"
                  : "border-zinc-800 bg-zinc-800/40"
              }`}
              onClick={() => onActiveFieldChange("received")}
            >
              <label className="block text-sm font-semibold text-zinc-300 mb-1">
                💵 顾客支付金额 (Amount Received)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                  ￥
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={receivedStr}
                  onChange={(e) => onReceivedStrChange(e.target.value)}
                  onFocus={() => onActiveFieldChange("received")}
                  placeholder="0.00"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-orange-500 rounded-xl pl-8 pr-3 py-2 text-xl font-bold text-white outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-1">
                找零 (Change)
              </label>
              <div className="text-xl font-bold text-green-500">
                {currency}{" "}
                {Math.max(
                  0,
                  parsedReceived -
                    Math.max(0, (order.total || 0) - parsedDiscount),
                ).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end whitespace-nowrap pt-4 border-t border-zinc-800">
            <button
              onClick={onCancel}
              className="px-4 py-3 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-transparent"
            >
              取消 (Cancel)
            </button>
            <button
              onClick={() => {
                const finalTotalVal = Math.max(
                  0,
                  (order.total || 0) - parsedDiscount,
                );
                const changeVal = Math.max(0, parsedReceived - finalTotalVal);
                onComplete({
                  finalTotal: finalTotalVal,
                  discountAmount: parsedDiscount,
                  receivedAmount: parsedReceived,
                  changeAmount: changeVal,
                });
              }}
              className="px-6 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20 rounded-xl transition-colors"
            >
              完成结账 (Complete)
            </button>
          </div>
        </div>

        {/* Right Column: Numpad */}
        <div className="w-full md:w-[320px] bg-zinc-950 p-4 sm:p-6 flex items-center justify-center border-t md:border-t-0 md:border-l border-zinc-800">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[280px] md:max-w-none mx-auto">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleNumpadInput(key)}
                className={`h-12 sm:h-16 rounded-xl sm:rounded-2xl text-lg sm:text-xl font-bold transition-colors shadow-sm flex items-center justify-center
                  ${
                    key === "C"
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : key === "⌫"
                        ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                  }
                  active:scale-95`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
