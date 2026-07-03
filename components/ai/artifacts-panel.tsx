"use client";

import { ArtifactsPanel as ArtifactsPanelPrimitive } from "@intentface/chat/artifacts-panel";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { CheckMarkMediumIcon } from "@/components/icons/check-mark-medium";
import { CopyIcon } from "@/components/icons/copy";
import { IconButton } from "@/components/ui/icon-button";
import { Markdown } from "@/components/ui/markdown";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

type ArtifactsPanelRootProps = {
  open: boolean;
  children?: ReactNode;
  className?: string;
};

const ArtifactsPanelRoot = ({ open, children, className, ...props }: ArtifactsPanelRootProps) => (
  <AnimatePresence>
    {open && (
      <motion.aside
        data-slot="artifacts-panel"
        data-open=""
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "var(--artifacts-panel-width)", opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "relative h-full shrink-0 overflow-hidden border-l border-border bg-background",
          className,
        )}
        {...props}
      >
        <div className="flex h-full w-(--artifacts-panel-width) flex-col">{children}</div>
      </motion.aside>
    )}
  </AnimatePresence>
);

const ArtifactsPanelContent = ({ className, ...props }: ComponentProps<typeof Markdown>) => (
  <Markdown className={cn("size-full", className)} {...props} />
);

const ArtifactsPanelHeader = ({
  title,
  onClose,
  className,
  ...props
}: ComponentProps<typeof ArtifactsPanelPrimitive.Header> & {
  title: string;
  onClose: () => void;
}) => (
  <ArtifactsPanelPrimitive.Header
    className={cn("flex items-center justify-between border-b border-border px-4 py-3", className)}
    {...props}
  >
    <h2 className="truncate text-sm font-semibold">{title}</h2>
    <IconButton variant="ghost" size="sm" onClick={onClose}>
      <XIcon />
    </IconButton>
  </ArtifactsPanelPrimitive.Header>
);

const ArtifactsPanelFooter = ({
  content,
  className,
  ...props
}: ComponentProps<typeof ArtifactsPanelPrimitive.Footer> & { content: string }) => {
  const { copy, isCopied } = useCopy();

  return (
    <ArtifactsPanelPrimitive.Footer
      className={cn("flex items-center justify-end border-t border-border px-4 py-2", className)}
      {...props}
    >
      <Tooltip.Provider>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <IconButton variant="ghost" size="sm" onClick={() => copy(content)}>
                {isCopied ? <CheckMarkMediumIcon /> : <CopyIcon />}
              </IconButton>
            }
          />
          <Tooltip.Content>{isCopied ? "Copied!" : "Copy markdown"}</Tooltip.Content>
        </Tooltip>
      </Tooltip.Provider>
    </ArtifactsPanelPrimitive.Footer>
  );
};

const ArtifactsPanelViewport = ({
  className,
  ...props
}: ComponentProps<typeof ArtifactsPanelPrimitive.Viewport>) => (
  <ArtifactsPanelPrimitive.Viewport
    className={cn("flex-1 overflow-y-auto p-4", className)}
    {...props}
  />
);

export const ArtifactsPanel = Object.assign(ArtifactsPanelRoot, {
  Header: ArtifactsPanelHeader,
  Viewport: ArtifactsPanelViewport,
  Content: ArtifactsPanelContent,
  Footer: ArtifactsPanelFooter,
});
