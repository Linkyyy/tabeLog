"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, Search, X } from "lucide-react";

export default function CompactSearch({
  value,
  onChange,
  placeholder,
  onOpen,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <div
      className="compact-search"
      ref={root}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`compact-search-trigger ${value ? "has-query" : ""}`}
        aria-label="搜索"
        aria-expanded={open}
        aria-controls={id}
        title={value ? `当前搜索：${value}` : placeholder}
        onClick={() => {
          if (open) close();
          else {
            onOpen();
            setOpen(true);
          }
        }}
      >
        <Search size={17} />
        {value && <span className="search-active-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div
          className="search-box compact-search-popover"
          role="search"
          id={id}
        >
          <Search size={15} aria-hidden="true" />
          <input
            ref={input}
            aria-label="搜索日记"
            placeholder={placeholder}
            value={value}
            enterKeyHint="search"
            onChange={(event) => onChange(event.target.value)}
          />
          {value && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => {
                onChange("");
                input.current?.focus({ preventScroll: true });
              }}
            >
              <X size={14} />
            </button>
          )}
          <button type="button" aria-label="收起搜索" onClick={close}>
            <ChevronUp size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
