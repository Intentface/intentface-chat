import type { ReactNode } from "react";

// The site shell lives in the root layout; the docs only add their own scroller.
// The panel scrolls, not the window, so the frame stays put around it.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-docs-scroll="" className="h-full w-full overflow-y-auto">
      {children}
    </div>
  );
}
