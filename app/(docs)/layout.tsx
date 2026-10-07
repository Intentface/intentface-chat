import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/docs-shell";
import { source } from "@/lib/docs/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell tree={source.pageTree}>{children}</DocsShell>;
}
