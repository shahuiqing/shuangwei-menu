import {
  Layout,
  Palette,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { PRESET_BACKGROUNDS } from "./adminConstants";
import { compressImage } from "../../utils/image";
import { uploadBase64ToStorage } from "../../utils/storage";

export function AppearanceTab({
  layoutStyle = "grid",
  setLayoutStyle,
  theme = "midnight",
  setTheme,
  soundEnabled = true,
  setSoundEnabled,
  onFullscreenToggle,
  restaurantName = "",
  setRestaurantName,
  welcomeMessage = "",
  setWelcomeMessage,
  onGenerateWelcome,
  isGeneratingWelcome,
  generatedWelcomes,
  bgUrl,
  setBgUrl,
  logoUrl,
  setLogoUrl,
  isUploading,
  setIsUploading,
  onSaveToCloud,
}: {
  layoutStyle?: "grid" | "list" | "bento";
  setLayoutStyle?: (style: "grid" | "list" | "bento") => void;
  theme?: "midnight" | "light";
  setTheme?: (theme: "midnight" | "light") => void;
  soundEnabled?: boolean;
  setSoundEnabled?: (enabled: boolean) => void;
  onFullscreenToggle: () => void;
  restaurantName?: string;
  setRestaurantName?: (name: string) => void;
  welcomeMessage?: string;
  setWelcomeMessage?: (msg: string) => void;
  onGenerateWelcome: () => void;
  isGeneratingWelcome: boolean;
  generatedWelcomes: string[];
  bgUrl: string;
  setBgUrl: (url: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  isUploading: boolean;
  setIsUploading: (value: boolean) => void;
  onSaveToCloud?: (overrides?: any) => void;
}) {
  return (
    <>
      {/* Layout Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Layout size={20} className="text-orange-500" />
          菜单布局样式 / Layout Style
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setLayoutStyle && setLayoutStyle("grid")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "grid" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
          >
            <div className="w-16 h-12 bg-zinc-800 rounded flex flex-col gap-1 p-1">
              <div className="w-full h-1/2 bg-zinc-700 rounded-sm"></div>
              <div className="w-full h-1/4 bg-zinc-600 rounded-sm"></div>
              <div className="w-1/2 h-1/4 bg-zinc-600 rounded-sm"></div>
            </div>
            <span className="text-sm font-semibold mt-1">经典网格 (Grid)</span>
          </button>
          <button
            onClick={() => setLayoutStyle && setLayoutStyle("list")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "list" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
          >
            <div className="w-16 h-12 bg-zinc-800 rounded flex gap-1 p-1">
              <div className="w-1/3 h-full bg-zinc-700 rounded-sm"></div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="w-full h-1/3 bg-zinc-600 rounded-sm"></div>
                <div className="w-2/3 h-1/3 bg-zinc-600 rounded-sm"></div>
              </div>
            </div>
            <span className="text-sm font-semibold mt-1">优雅列表 (List)</span>
          </button>
          <button
            onClick={() => setLayoutStyle && setLayoutStyle("bento")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "bento" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
          >
            <div className="w-16 h-12 bg-zinc-800 rounded grid grid-cols-2 grid-rows-2 gap-1 p-1">
              <div className="col-span-2 row-span-1 bg-zinc-700 rounded-sm"></div>
              <div className="col-span-1 border border-zinc-700 rounded-sm"></div>
              <div className="col-span-1 border border-zinc-700 rounded-sm"></div>
            </div>
            <span className="text-sm font-semibold mt-1">便当网格 (Bento)</span>
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Palette size={20} className="text-orange-500" />
          界面主题 / Theme Mode
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setTheme && setTheme("midnight")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${theme === "midnight" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
          >
            <Moon
              size={24}
              className={
                theme === "midnight" ? "text-orange-500" : "text-zinc-500"
              }
            />
            <span className="text-sm font-semibold mt-1">
              暗夜黑 (Midnight)
            </span>
          </button>
          <button
            onClick={() => setTheme && setTheme("light")}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border ${theme === "light" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
          >
            <Sun
              size={24}
              className={
                theme === "light" ? "text-orange-500" : "text-zinc-500"
              }
            />
            <span className="text-sm font-semibold mt-1">明亮白 (Light)</span>
          </button>
        </div>
      </div>

      {/* Sound Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            {soundEnabled ? (
              <Volume2 size={20} className="text-orange-500" />
            ) : (
              <VolumeX size={20} className="text-zinc-500" />
            )}
            翻页音效
          </h3>
          <p className="text-xs text-zinc-400">
            开启或关闭菜单页面切换时的高级音效
          </p>
        </div>
        <button
          onClick={() => setSoundEnabled && setSoundEnabled(!soundEnabled)}
          className={`w-14 h-8 rounded-full p-1 transition-colors relative flex items-center ${soundEnabled ? "bg-orange-500" : "bg-zinc-700"}`}
        >
          <div
            className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${soundEnabled ? "translate-x-6" : "translate-x-0"}`}
          />
        </button>
      </div>

      {/* Fullscreen Action */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Maximize size={20} className="text-orange-500" /> 全屏模式 /
            Fullscreen
          </h3>
          <p className="text-xs text-zinc-400">
            切换浏览器全屏模式以获得沉浸式体验 / Toggle fullscreen mode
          </p>
        </div>
        <button
          onClick={onFullscreenToggle}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700 flex items-center gap-2 max-w-fit"
        >
          <Maximize size={16} /> 切换全屏 / Toggle
        </button>
      </div>

      {/* Brand Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-orange-500" /> 品牌与欢迎语 (Brand
          & Welcome)
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              店铺名称 / Restaurant Name
            </label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) =>
                setRestaurantName && setRestaurantName(e.target.value)
              }
              placeholder="例如: 炙·双味居"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              定制欢迎语 / Custom Welcome Message
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={welcomeMessage}
                onChange={(e) =>
                  setWelcomeMessage && setWelcomeMessage(e.target.value)
                }
                placeholder="例如: Premium Charcoal BBQ"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={onGenerateWelcome}
                disabled={isGeneratingWelcome}
                className="shrink-0 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-600/50 rounded-xl transition-colors disabled:opacity-50"
              >
                {isGeneratingWelcome ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                AI 智能生成标语
              </button>
            </div>

            {generatedWelcomes.length > 0 && (
              <div className="mt-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  点击选择 AI 生成的标语:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {generatedWelcomes.map((msg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setWelcomeMessage && setWelcomeMessage(msg)
                      }
                      className="text-xs text-left px-3 py-2 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-400 transition-colors rounded-lg border border-zinc-700"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Background Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ImageIcon size={20} className="text-orange-500" /> 更换背景与 Logo
        </h3>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400">
              背景图片 / Background
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
                placeholder="输入图片 URL 或点击上传"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <label className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 cursor-pointer transition-colors text-sm font-semibold text-zinc-300">
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" /> 上传中
                  </>
                ) : (
                  <span>上传图片</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        setIsUploading(true);
                        const compressed = await compressImage(file);
                        const publicUrl = await uploadBase64ToStorage(
                          compressed,
                          "backgrounds",
                        );
                        if (setBgUrl) {
                          setBgUrl(publicUrl);
                          if (onSaveToCloud)
                            onSaveToCloud({
                              bgUrl: publicUrl,
                              silent: true,
                            });
                        }
                      } catch (err: any) {
                        console.error("Image upload failed:", err);
                        alert(err.message || "上传失败");
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
              </label>
            </div>

            <div className="mt-3">
              <div className="text-xs font-medium text-zinc-400 mb-2">
                预设绝佳主题风格 / Preset Themes:
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {PRESET_BACKGROUNDS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setBgUrl(preset.url)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border ${bgUrl === preset.url ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"} transition-colors gap-2 relative overflow-hidden group`}
                  >
                    <div className="w-full h-16 rounded-lg bg-zinc-800 relative z-10 flex items-center justify-center overflow-hidden">
                      {preset.url ? (
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-b from-zinc-800 to-zinc-950"></div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold z-10 ${bgUrl === preset.url ? "text-orange-500" : "text-zinc-400"}`}
                    >
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-zinc-800/50">
            <label className="text-xs font-medium text-zinc-400">
              品牌图标 / Brand Logo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="输入 Logo 图片 URL 或点击上传"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <label className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 cursor-pointer transition-colors text-sm font-semibold text-zinc-300">
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" /> 上传中
                  </>
                ) : (
                  <span>上传 Logo</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        setIsUploading(true);
                        const compressed = await compressImage(file);
                        const publicUrl = await uploadBase64ToStorage(
                          compressed,
                          "logos",
                        );
                        if (setLogoUrl) {
                          setLogoUrl(publicUrl);
                          if (onSaveToCloud)
                            onSaveToCloud({
                              logoUrl: publicUrl,
                              silent: true,
                            });
                        }
                      } catch (err: any) {
                        console.error("Image upload failed:", err);
                        alert(err.message || "上传失败");
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 mt-2">
          背景留空以使用默认暗黑渐变背景。Logo 留空使用系统默认图标。
        </p>
      </div>
    </>
  );
}
