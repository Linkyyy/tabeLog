"use client";

import { Check, MapPin, Utensils } from "lucide-react";
import { DEFAULT_THEME, THEMES } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import Modal from "./Modal";
import type { MapProvider } from "@/lib/types";

export default function ThemeSettings({
  onClose,
  provider,
  onProviderChange,
}: {
  onClose: () => void;
  provider: MapProvider;
  onProviderChange: (provider: MapProvider) => void;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <Modal title="设置" onClose={onClose}>
      <div className="theme-settings">
        <div className="theme-settings-heading">
          <h3>外观主题</h3>
          <p>换一种心情，继续记录美味。</p>
        </div>
        <fieldset className="theme-options">
          <legend className="sr-only">选择主题</legend>
          {THEMES.map((item) => (
            <label
              key={item.id}
              className={`theme-option ${theme === item.id ? "selected" : ""}`}
            >
              <input
                className="theme-radio"
                type="radio"
                name="appearance-theme"
                value={item.id}
                aria-label={item.name}
                checked={theme === item.id}
                onChange={() => setTheme(item.id)}
              />
              <div
                className="theme-preview"
                data-theme={item.id}
                aria-hidden="true"
              >
                <div className="theme-preview-nav">
                  <Utensils size={11} />
                  <span />
                  <b>+</b>
                </div>
                <MapPin className="theme-preview-pin" size={18} />
                <div className="theme-preview-sheet">
                  <i />
                  <div>
                    <span />
                    <span />
                  </div>
                  <div>
                    <span />
                    <span />
                  </div>
                </div>
                <span className="theme-check">
                  <Check size={13} />
                </span>
              </div>
              <span className="theme-option-title">
                {item.name}
                {item.id === DEFAULT_THEME && <small>默认</small>}
              </span>
              <span className="theme-option-description">
                {item.description}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="theme-settings-note">
          探店和菜单共用主题，选择会保存在当前浏览器。
        </p>
        <label className="map-setting">
          <span>
            <MapPin size={16} /> 地图服务
          </span>
          <select
            aria-label="地图服务"
            value={provider}
            onChange={(event) =>
              onProviderChange(event.target.value as MapProvider)
            }
          >
            <option value="osm">OpenStreetMap</option>
            <option value="google">Google 地图</option>
            <option value="amap">高德地图</option>
          </select>
        </label>
        <button
          className="button primary theme-settings-done"
          type="button"
          onClick={onClose}
        >
          完成
        </button>
      </div>
    </Modal>
  );
}
