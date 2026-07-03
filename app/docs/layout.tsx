import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { source } from "@/lib/docs/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 md:px-6">
      <DocsSidebar tree={source.pageTree} />
      <main className="min-w-0 flex-1 pt-10">{children}</main>
    </div>
  );
}
