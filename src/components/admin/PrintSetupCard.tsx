import { Printer } from "lucide-react";

export interface PrintConfig {
  layout: "grid" | "list";
  showLogo: boolean;
  showBackground: boolean;
  showImages: boolean;
  showDescription: boolean;
  showQrCode: boolean;
  langs: {
    zh: boolean;
    en: boolean;
    fr: boolean;
    ar: boolean;
    ma: boolean;
  };
}

export function PrintSetupCard({
  printConfig,
  onPrintConfigChange,
  onPrint,
}: {
  printConfig: PrintConfig;
  onPrintConfigChange: (value: PrintConfig) => void;
  onPrint: () => void;
}) {
  return (
    <div className="mb-6 bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/50 bg-zinc-900/50">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Printer size={20} className="text-orange-500" /> 打印与排版设置 /
            Print Setup
          </h3>
          <p className="text-xs text-zinc-400">
            定制您的纸质菜单排版和内容 / Customize your physical menu layout.
          </p>
        </div>
        <button
          onClick={onPrint}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit"
        >
          <Printer size={16} /> 预览 & 打印 (Print PDF)
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-zinc-300 block mb-2">
              排版风格 / Layout Style
            </label>
            <div className="flex bg-zinc-900 p-1 rounded-xl w-full border border-zinc-800">
              <button
                onClick={() =>
                  onPrintConfigChange({
                    ...printConfig,
                    layout: "grid",
                  })
                }
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${printConfig.layout === "grid" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
              >
                网格双列 (Grid)
              </button>
              <button
                onClick={() =>
                  onPrintConfigChange({
                    ...printConfig,
                    layout: "list",
                  })
                }
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${printConfig.layout === "list" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
              >
                列表单列 (List)
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-300 block mb-2">
              包含元素 / Include Elements
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.showImages}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      showImages: e.target.checked,
                    })
                  }
                />
                <span className="text-sm text-zinc-400 font-medium">
                  菜品图片 (Images)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.showDescription}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      showDescription: e.target.checked,
                    })
                  }
                />
                <span className="text-sm text-zinc-400 font-medium">
                  详细描述 (Descriptions)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                    checked={printConfig.showBackground}
                    onChange={(e) =>
                      onPrintConfigChange({
                        ...printConfig,
                        showBackground: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm text-zinc-400 font-medium">
                    背景 (Background)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                    checked={printConfig.showLogo}
                    onChange={(e) =>
                      onPrintConfigChange({
                        ...printConfig,
                        showLogo: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm text-zinc-400 font-medium">
                    Logo
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                    checked={printConfig.showQrCode}
                    onChange={(e) =>
                      onPrintConfigChange({
                        ...printConfig,
                        showQrCode: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm text-zinc-400 font-medium">
                    二维码 (QR)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-zinc-300 block mb-2">
              多语言配置 / Printed Languages
            </label>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.langs.zh}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      langs: {
                        ...printConfig.langs,
                        zh: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm text-zinc-300 font-medium flex-1">
                  中文 (Chinese)
                </span>
                <span className="text-xs text-orange-500">主语言</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.langs.en}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      langs: {
                        ...printConfig.langs,
                        en: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm text-zinc-300 font-medium flex-1">
                  English (英语)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.langs.fr}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      langs: {
                        ...printConfig.langs,
                        fr: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm text-zinc-300 font-medium flex-1">
                  Français (法语)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.langs.ar}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      langs: {
                        ...printConfig.langs,
                        ar: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm text-zinc-300 font-medium flex-1">
                  العربية (阿拉伯语)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                  checked={printConfig.langs.ma}
                  onChange={(e) =>
                    onPrintConfigChange({
                      ...printConfig,
                      langs: {
                        ...printConfig.langs,
                        ma: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm text-zinc-300 font-medium flex-1">
                  الدارجة (摩洛哥方言)
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
