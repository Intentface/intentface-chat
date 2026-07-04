import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { source } from "@/lib/docs/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-primary">
      <DocsSidebar tree={source.pageTree} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full px-4 pt-10 md:px-6">{children}</main>
      </div>
    </div>
  );
}
