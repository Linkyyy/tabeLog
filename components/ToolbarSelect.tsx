"use client";
import { ChevronDown } from "lucide-react";
export default function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; short: string }[];
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <div
      className="toolbar-select"
      title={`${label}：${selected?.label || ""}`}
    >
      <span className="select-long" aria-hidden="true">
        {selected?.label}
      </span>
      <span className="select-short" aria-hidden="true">
        {selected?.short}
      </span>
      <ChevronDown size={11} aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
