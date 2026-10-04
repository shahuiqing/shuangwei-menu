import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** 读 PNG 的宽高（IHDR 第 8~15 字节） */
const pngSize = (p: string): { w: number; h: number } => {
  const buf = readFileSync(join(ROOT, p));
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

describe("PWA manifest", () => {
  const m = JSON.parse(read("public/manifest.webmanifest"));

  it("具备可安装应用的必备字段", () => {
    expect(m.name).toContain("双味居");
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("./");
    expect(m.scope).toBe("./");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("提供 192 / 512 / maskable 图标且文件存在", () => {
    const sizes = m.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      m.icons.some((i: any) => String(i.purpose || "").includes("maskable")),
    ).toBe(true);

    expect(pngSize("public/icons/icon-192.png")).toEqual({ w: 192, h: 192 });
    expect(pngSize("public/icons/icon-512.png")).toEqual({ w: 512, h: 512 });
    expect(pngSize("public/icons/icon-maskable-512.png")).toEqual({
      w: 512,
      h: 512,
    });
    expect(existsSync(join(ROOT, "public/icons/icon.svg"))).toBe(true);
  });
});

describe("index.html PWA 声明", () => {
  const html = read("index.html");

  it("声明 manifest 与 iOS 安装相关 meta", () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain("manifest.webmanifest");
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="theme-color"');
    expect(html).not.toContain("\uFFFD");
  });
});

describe("Service Worker", () => {
  const sw = read("public/sw.js");

  it("语法可执行且使用版本化缓存", () => {
    expect(() => new Function(sw)).not.toThrow();
    expect(sw).toMatch(/const VERSION = "/);
    expect(sw).toContain("addEventListener(");
    expect(sw).toContain('"activate"');
  });

  it("放行跨域请求（Supabase 不被拦截）", () => {
    expect(sw).toContain("url.origin !== self.location.origin");
  });
});

describe("SW 注册", () => {
  const main = read("src/main.tsx");

  it("仅生产环境注册，且路径相对（适配子目录部署）", () => {
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain('"./sw.js"');
    expect(main).toContain('scope: "./"');
  });

  it("新版本接管后提示用户刷新（controllerchange）", () => {
    expect(main).toContain("controllerchange");
    expect(main).toContain("新版本已生效");
  });
});

describe("构建盖章 stamp-sw", () => {
  const stamp = read("scripts/stamp-sw.mjs");
  const pkg = JSON.parse(read("package.json"));

  it("按时间戳替换 dist/sw.js 的 VERSION，失败即退出", () => {
    expect(stamp).toContain("dist/sw.js");
    expect(stamp).toContain('const VERSION = "[^"]+"');
    expect(stamp).toContain("shuangwei-owner-${Date.now()}");
    expect(stamp).toContain("process.exit(1)");
  });

  it("build 流程已接入盖章步骤", () => {
    expect(pkg.scripts.build).toContain("stamp-sw.mjs");
  });
});
