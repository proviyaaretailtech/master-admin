import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

const SlotCtx = createContext<{
  node: HTMLElement | null;
  setNode: (n: HTMLElement | null) => void;
}>({
  node: null,
  setNode: () => {},
});

export const TopbarSlotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  return <SlotCtx.Provider value={{ node, setNode }}>{children}</SlotCtx.Provider>;
};

/** Rendered once inside the Topbar. */
export const TopbarSlotOutlet: React.FC = () => {
  const { setNode } = useContext(SlotCtx);
  return <div ref={setNode} data-testid="topbar-action-slot" className="flex items-center gap-2" />;
};

/** A page puts its primary contextual actions in the Topbar with <TopbarAction>…</TopbarAction>. */
export const TopbarAction: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { node } = useContext(SlotCtx);
  return node ? createPortal(children, node) : null;
};
