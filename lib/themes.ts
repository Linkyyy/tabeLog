export const DEFAULT_THEME = "coral";
export const THEME_STORAGE_KEY = "tabelog-theme";

export const THEMES = [
  {
    id: "coral",
    name: "珊瑚晴空",
    description: "暖白底色 · 明亮珊瑚",
    color: "#fffcf9",
    dark: false,
  },
  {
    id: "mint",
    name: "薄荷白",
    description: "清爽留白 · 翡翠绿",
    color: "#f2f8f5",
    dark: false,
  },
  {
    id: "midnight",
    name: "午夜蓝",
    description: "深色界面 · 电光蓝",
    color: "#101724",
    dark: true,
  },
  {
    id: "lavender",
    name: "雾紫银白",
    description: "冷白雾紫 · 清透安静",
    color: "#f9fafd",
    dark: false,
  },
  {
    id: "classic",
    name: "经典原色",
    description: "原有风格 · 米白橄榄",
    color: "#f8f7f2",
    dark: false,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

// Run before first paint so a saved dark theme never flashes the light default.
// Only the fixed allowlist is written to the DOM, never arbitrary stored content.
export const themeBootstrap = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!${JSON.stringify(THEMES.map((theme) => theme.id))}.includes(t))t=${JSON.stringify(DEFAULT_THEME)};document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
