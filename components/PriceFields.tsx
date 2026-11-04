"use client";
import type { MealRecordInput } from "@/lib/types";
import { PRICE_UNITS } from "@/lib/pricing";
export default function PriceFields({
  value,
  onChange,
  disabled = false,
  label = "价格 / 花费（选填）",
}: {
  value: Pick<MealRecordInput, "price" | "currency" | "customUnit">;
  onChange: (patch: Partial<MealRecordInput>) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="optional-price">
      <label>
        {label}
        <div className="price-field">
          <input
            aria-label="价格金额"
            type="number"
            step="0.01"
            min="0"
            max="1000000"
            placeholder="不填则不展示"
            value={value.price ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                price: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          <select
            aria-label="价格单位"
            value={value.currency}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                currency: e.target.value as MealRecordInput["currency"],
              })
            }
          >
            {PRICE_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </label>
      {value.currency === "CUSTOM" && (
        <label>
          自定义单位
          <input
            aria-label="自定义价格单位"
            maxLength={12}
            required
            value={value.customUnit || ""}
            placeholder="例如：次遛狗、块小饼干"
            disabled={disabled}
            onChange={(e) => onChange({ customUnit: e.target.value })}
          />
        </label>
      )}
      <small>可以填真实花费，也可以用一点小心意定价。</small>
    </div>
  );
}
