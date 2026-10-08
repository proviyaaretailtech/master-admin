import React, { useEffect, useId, useRef, useState } from "react";

/** Button + panel. Closes on outside click and Esc (focus returns to the button). */
export const Popover: React.FC<{
  buttonLabel: string;
  button: React.ReactNode;
  buttonClassName?: string;
  align?: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}> = ({ buttonLabel, button, buttonClassName = "", align = "right", children }) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      className="relative"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          btn.current?.focus();
        }
      }}
    >
      <button
        ref={btn}
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#65D000]/50 ${buttonClassName}`}
      >
        {button}
      </button>
      {open && (
        <div
          id={panelId}
          className={`absolute z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
