"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  hideHeader = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  hideHeader?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  const closeButton = (
    <button
      className="icon-button"
      type="button"
      aria-label="关闭"
      onClick={onClose}
    >
      <X size={21} />
    </button>
  );
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={hideHeader ? title : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {hideHeader ? (
        <div className="modal-dismiss">{closeButton}</div>
      ) : (
        <header className="modal-heading">
          <div>
            <span className="eyebrow">A TASTE TO REMEMBER</span>
            <h2>{title}</h2>
          </div>
          {closeButton}
        </header>
      )}
      {children}
    </dialog>
  );
}
