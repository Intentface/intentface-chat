"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import Drawer from "@/components/ui/drawer";
import { IconButton } from "@/components/ui/icon-button";
import Tooltip from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { useIsMobile } from "@/hooks/use-mobile";
import { useArtifactStore } from "@/lib/store/artifact";
import { cn } from "@/lib/utils";
import { CopyIcon } from "./icons/copy";

// Memoized markdown renderer
const ArtifactsPanelContent = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      controls={{ table: false }}
      className={cn(
        "size-full text-md [&_p]:whitespace-pre-wrap [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

ArtifactsPanelContent.displayName = "ArtifactsPanelContent";

// Header with title and close button
const ArtifactsPanelHeader = ({
  title,
  onClose,
  className,
  ...props
}: ComponentProps<"div"> & {
  title: string;
  onClose: () => void;
}) => (
  <div
    data-slot="artifacts-panel-header"
    className={cn(
      "flex items-center justify-between border-b border-border px-4 py-3",
      className,
    )}
    {...props}
  >
    <h2 className="truncate text-sm font-semibold">{title}</h2>
    <IconButton variant="ghost" size="sm" onClick={onClose}>
      <XIcon />
    </IconButton>
  </div>
);

// Footer with copy button
const ArtifactsPanelFooter = ({
  content,
  className,
  ...props
}: ComponentProps<"div"> & { content: string }) => {
  const { copy, isCopied } = useCopy();

  return (
    <div
      data-slot="artifacts-panel-footer"
      className={cn(
        "flex items-center justify-end border-t border-border px-4 py-2",
        className,
      )}
      {...props}
    >
      <Tooltip.Provider>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => copy(content)}
              >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
              </IconButton>
            }
          />
          <Tooltip.Content>
            {isCopied ? "Copied!" : "Copy markdown"}
          </Tooltip.Content>
        </Tooltip>
      </Tooltip.Provider>
    </div>
  );
};

// Desktop panel — animated side panel inside Sidebar.Inset
const DesktopPanel = () => {
  const { activeArtifact, isOpen, closePanel } = useArtifactStore();

  return (
    <AnimatePresence>
      {isOpen && activeArtifact && (
        <motion.aside
          data-slot="artifacts-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "var(--artifacts-panel-width)", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="relative h-full shrink-0 overflow-hidden border-l border-border bg-background"
        >
          <div className="flex h-full w-(--artifacts-panel-width) flex-col">
            <ArtifactsPanelHeader
              title={activeArtifact.title}
              onClose={closePanel}
            />
            <div className="flex-1 overflow-y-auto p-4">
              <ArtifactsPanelContent>
                {activeArtifact.content}
              </ArtifactsPanelContent>
            </div>
            <ArtifactsPanelFooter content={activeArtifact.content} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

// Mobile panel — Drawer overlay
const MobilePanel = () => {
  const { activeArtifact, isOpen, closePanel } = useArtifactStore();

  return (
    <Drawer side="right" open={isOpen} onOpenChange={closePanel}>
      <Drawer.Content side="right" className="w-full sm:max-w-lg">
        <Drawer.Header>
          <Drawer.Title>{activeArtifact?.title}</Drawer.Title>
        </Drawer.Header>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ArtifactsPanelContent>
            {activeArtifact?.content ?? ""}
          </ArtifactsPanelContent>
        </div>
        {activeArtifact && (
          <ArtifactsPanelFooter content={activeArtifact.content} />
        )}
      </Drawer.Content>
    </Drawer>
  );
};

// Root component — responsive switch
const ArtifactsPanelRoot = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobilePanel />;
  }

  return <DesktopPanel />;
};

export const ArtifactsPanel = Object.assign(ArtifactsPanelRoot, {
  Header: ArtifactsPanelHeader,
  Content: ArtifactsPanelContent,
  Footer: ArtifactsPanelFooter,
});
