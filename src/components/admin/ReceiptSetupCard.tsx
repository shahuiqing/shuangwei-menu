import { useEffect, useState } from "react";
import { Printer, Usb, Unplug } from "lucide-react";
import type { ReceiptSettings } from "../../types/menu";
import { usbPrinter } from "../../lib/usbPrinter";

export function ReceiptSetupCard({
  receiptSettings,
  onReceiptSettingsChange,
  onSaveToCloud,
  currency,
  isPrintServer,
  setIsPrintServer,
}: {
  receiptSettings: ReceiptSettings;
  onReceiptSettingsChange: (value: ReceiptSettings) => void;
  onSaveToCloud?: (overrides?: any) => void;
  currency: string;
  isPrintServer: boolean;
  setIsPrintServer: (value: boolean) => void;
}) {
  const [usbState, setUsbState] = useState(usbPrinter.state);
  const [usbBusy, setUsbBusy] = useState(false);
  const [usbMsg, setUsbMsg] = useState("");

  useEffect(() => usbPrinter.subscribe(setUsbState), []);

  const handleConnectUsb = async () => {
    setUsbBusy(true);
    setUsbMsg("");
    try {
      await usbPrinter.requestAndConnect();
    } catch (e) {
      setUsbMsg(String((e as Error)?.message || e));
    } finally {
      setUsbBusy(false);
    }
  };

  const handleDisconnectUsb = async () => {
    await usbPrinter.disconnect();
  };

  const handleTestUsb = async () => {
    setUsbBusy(true);
    setUsbMsg("");
    try {
      const ok = await usbPrinter.printTest(receiptSettings);
      if (!ok) setUsbMsg("未连接 USB 打印机，请先连接");
    } catch (e) {
      setUsbMsg(String((e as Error)?.message || e));
    } finally {
      setUsbBusy(false);
    }
  };

  return (
    <div className="mb-6 bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/50 bg-zinc-900/50">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Printer size={20} className="text-orange-500" /> 小票打印设置 /
            Receipt Setup
          </h3>
          <p className="text-xs text-zinc-400">
            定制您的热敏小票排版和内容 / Customize your thermal receipt layout.
          </p>
        </div>
        {onSaveToCloud && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const testOrder = {
                  id: "TEST-" + Math.floor(Math.random() * 10000),
                  timestamp: new Date().toISOString(),
                  customerName: "Test Customer (测试)",
                  items: [
                    {
                      name: "Test Item 1",
                      enTitle: "Test Item 1 English",
                      frTitle: "Test Item 1 Français",
                      arTitle: "عنصر اختبار 1",
                      maTitle: "عنصر اختبار الدارجة 1",
                      quantity: 2,
                      price: 50,
                    },
                    {
                      name: "Test Item 2",
                      enTitle: "Test Item 2 English",
                      frTitle: "Test Item 2 Français",
                      arTitle: "عنصر اختبار 2",
                      maTitle: "عنصر اختبار الدارجة 2",
                      quantity: 1,
                      price: 100,
                    },
                  ],
                  total: 200,
                };
                import("../../lib/print").then((m) =>
                  m.printReceipt(testOrder, currency, receiptSettings),
                );
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit border border-zinc-700"
            >
              <Printer size={16} /> 打印测试 (Test Print)
            </button>
            <button
              onClick={() =>
                onSaveToCloud({
                  receiptSettings,
                  silent: false,
                })
              }
              className="bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit"
            >
              保存小票设置
            </button>
          </div>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              店铺名称 (Store Name)
            </label>
            <input
              type="text"
              value={receiptSettings.storeName}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  storeName: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
              placeholder="默认使用页面标题"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              二维码中心图标 URL (QR Center Logo Image)
            </label>
            <input
              type="text"
              value={receiptSettings.topLogoUrl || ""}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  topLogoUrl: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
              placeholder="留空则使用默认图标"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              二维码配色 (QR Code Colors)
            </label>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {[
                {
                  name: "经典黑白",
                  fg: "#18181b",
                  bg: "#ffffff",
                },
                {
                  name: "暗夜鎏金",
                  fg: "#fbbf24",
                  bg: "#18181b",
                },
                {
                  name: "品牌鲜橙",
                  fg: "#ea580c",
                  bg: "#ffffff",
                },
                {
                  name: "极光碧绿",
                  fg: "#064e3b",
                  bg: "#ecfdf5",
                },
                {
                  name: "深海湛蓝",
                  fg: "#1e3a8a",
                  bg: "#eff6ff",
                },
                {
                  name: "勃艮第红",
                  fg: "#831843",
                  bg: "#fdf2f8",
                },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    onReceiptSettingsChange({
                      ...receiptSettings,
                      qrCodeFgColor: preset.fg,
                      qrCodeBgColor: preset.bg,
                    })
                  }
                  className="flex items-center gap-2 p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-orange-500 transition-colors text-left"
                >
                  <div className="flex w-6 h-6 rounded-md overflow-hidden border border-zinc-600 shrink-0">
                    <div
                      className="w-1/2 h-full"
                      style={{ backgroundColor: preset.bg }}
                    ></div>
                    <div
                      className="w-1/2 h-full"
                      style={{ backgroundColor: preset.fg }}
                    ></div>
                  </div>
                  <span className="text-xs text-zinc-300 truncate">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">
                  前景色 (Foreground)
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={receiptSettings.qrCodeFgColor || "#18181b"}
                    onChange={(e) =>
                      onReceiptSettingsChange({
                        ...receiptSettings,
                        qrCodeFgColor: e.target.value,
                      })
                    }
                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={receiptSettings.qrCodeFgColor || "#18181b"}
                    onChange={(e) =>
                      onReceiptSettingsChange({
                        ...receiptSettings,
                        qrCodeFgColor: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono uppercase"
                    placeholder="#18181B"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">
                  背景色 (Background)
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={receiptSettings.qrCodeBgColor || "#ffffff"}
                    onChange={(e) =>
                      onReceiptSettingsChange({
                        ...receiptSettings,
                        qrCodeBgColor: e.target.value,
                      })
                    }
                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={receiptSettings.qrCodeBgColor || "#ffffff"}
                    onChange={(e) =>
                      onReceiptSettingsChange({
                        ...receiptSettings,
                        qrCodeBgColor: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono uppercase"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              二维码容错率 (QR Error Correction Level)
            </label>
            <select
              value={receiptSettings.qrCodeLevel || "H"}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  qrCodeLevel: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            >
              <option value="L">L (7%) - 适合简单二维码，线条较少</option>
              <option value="M">M (15%) - 适合无中心图标的常规情况</option>
              <option value="Q">Q (25%) - 适合中心有较小图标</option>
              <option value="H">H (30%) - 适合中心有较大图标 (推荐)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              底部 Logo URL (Bottom Logo Image)
            </label>
            <input
              type="text"
              value={receiptSettings.bottomLogoUrl || ""}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  bottomLogoUrl: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
              placeholder="例如: https://example.com/footer.png"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              底部语 1 (Footer Line 1)
            </label>
            <input
              type="text"
              value={receiptSettings.footerText1}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  footerText1: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              底部语 2 (Footer Line 2)
            </label>
            <input
              type="text"
              value={receiptSettings.footerText2}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  footerText2: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              谷歌地图好评链接 (Google Maps Review Link)
            </label>
            <input
              type="text"
              value={receiptSettings.googleMapsReviewLink || ""}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  googleMapsReviewLink: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
              placeholder="https://g.page/r/..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              设置后，顾客可以在点餐后的相关界面直接点击链接为您留下好评。
            </p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer p-4 bg-zinc-900 border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-600 focus:ring-orange-500 w-5 h-5"
                  checked={isPrintServer}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setIsPrintServer(val);
                    if (val) {
                      localStorage.setItem("isPrintServer", "true");
                    } else {
                      localStorage.removeItem("isPrintServer");
                    }
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  将此设备设为打印服务器 (Set this device as Print Server)
                </span>
                <span className="text-xs text-zinc-400 mt-1">
                  开启后，当有新订单或加菜单时，此设备将自动唤起打印机进行打印。(When
                  enabled, this device will automatically trigger the printer
                  for new orders and additions.)
                </span>
              </div>
            </label>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Usb
                    size={20}
                    className={
                      usbState.connected ? "text-green-500" : "text-zinc-500"
                    }
                  />
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      USB 热敏打印机（全自动出纸）
                    </span>
                    <span className="text-xs text-zinc-400">
                      {usbState.connected
                        ? `已连接：${usbState.name}`
                        : usbState.supported
                          ? "通过 WebUSB 直连打印机，新订单自动出纸，无需人工确认"
                          : "当前浏览器不支持 WebUSB，请使用 Chrome 或 Edge"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {usbState.connected ? (
                    <>
                      <button
                        onClick={handleTestUsb}
                        disabled={usbBusy}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-semibold rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 border border-zinc-700"
                      >
                        <Printer size={14} /> 测试出纸
                      </button>
                      <button
                        onClick={handleDisconnectUsb}
                        disabled={usbBusy}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 border border-zinc-700"
                      >
                        <Unplug size={14} /> 断开
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectUsb}
                      disabled={usbBusy || !usbState.supported}
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-lg px-3 py-2 text-xs flex items-center gap-1.5"
                    >
                      <Usb size={14} /> {usbBusy ? "连接中..." : "连接打印机"}
                    </button>
                  )}
                </div>
              </div>
              {usbMsg && (
                <p className="text-xs text-amber-400 mt-2">{usbMsg}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              小票列宽 (Receipt Column Width)
            </label>
            <select
              value={receiptSettings.columnWidth || "80mm"}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  columnWidth: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            >
              <option value="58mm">58mm (窄边小票)</option>
              <option value="80mm">80mm (标准小票)</option>
              <option value="100%">100% (自适应宽度)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              字体大小 (Font Size)
            </label>
            <select
              value={receiptSettings.fontSize || "14px"}
              onChange={(e) =>
                onReceiptSettingsChange({
                  ...receiptSettings,
                  fontSize: e.target.value,
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            >
              <option value="12px">小号 (Small - 12px)</option>
              <option value="14px">中号 (Medium - 14px)</option>
              <option value="16px">大号 (Large - 16px)</option>
              <option value="18px">特大号 (X-Large - 18px)</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-3">
              显示设置 (Display Options)
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={receiptSettings.showStoreName}
                  onChange={(e) =>
                    onReceiptSettingsChange({
                      ...receiptSettings,
                      showStoreName: e.target.checked,
                    })
                  }
                />
                <span className="text-sm text-zinc-400 font-medium">
                  打印店铺名称 (Print Store Name)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={receiptSettings.showDate}
                  onChange={(e) =>
                    onReceiptSettingsChange({
                      ...receiptSettings,
                      showDate: e.target.checked,
                    })
                  }
                />
                <span className="text-sm text-zinc-400 font-medium">
                  打印日期时间 (Print Date)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={receiptSettings.showQrCode}
                  onChange={(e) =>
                    onReceiptSettingsChange({
                      ...receiptSettings,
                      showQrCode: e.target.checked,
                    })
                  }
                />
                <span className="text-sm text-zinc-400 font-medium">
                  打印底部二维码 (Print QR Code)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-3">
              打印语言 (Print Languages)
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "zh", label: "中文" },
                { id: "en", label: "English" },
                { id: "fr", label: "Français" },
                { id: "ar", label: "العربية" },
                { id: "ma", label: "Darija" },
              ].map((lang) => {
                const currentLangs = receiptSettings.printLanguages || [
                  "zh",
                  "en",
                  "fr",
                  "ar",
                  "ma",
                ];
                const isChecked = currentLangs.includes(lang.id);
                return (
                  <label
                    key={lang.id}
                    className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50"
                  >
                    <input
                      type="checkbox"
                      className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                      checked={isChecked}
                      onChange={(e) => {
                        let newLangs;
                        if (e.target.checked) {
                          newLangs = [...currentLangs, lang.id];
                        } else {
                          newLangs = currentLangs.filter(
                            (l: string) => l !== lang.id,
                          );
                        }
                        onReceiptSettingsChange({
                          ...receiptSettings,
                          printLanguages: newLangs,
                        });
                      }}
                    />
                    <span className="text-sm text-zinc-400 font-medium">
                      {lang.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
