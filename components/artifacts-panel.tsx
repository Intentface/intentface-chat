"use client";

import { ArtifactsPanel } from "@/components/ai/artifacts-panel";
import { useChatContext } from "@/components/chat";
import Drawer from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

const DesktopPanel = () => {
  const {
    activeArtifact,
    isArtifactOpen: isOpen,
    closeArtifact: closePanel,
  } = useChatContext();

  if (!activeArtifact) return null;

  return (
    <ArtifactsPanel open={isOpen}>
      <ArtifactsPanel.Header
        title={activeArtifact.title}
        onClose={closePanel}
      />
      <ArtifactsPanel.Viewport>
        <ArtifactsPanel.Content>
          {activeArtifact.content}
        </ArtifactsPanel.Content>
      </ArtifactsPanel.Viewport>
      <ArtifactsPanel.Footer content={activeArtifact.content} />
    </ArtifactsPanel>
  );
};

const MobilePanel = () => {
  const {
    activeArtifact,
    isArtifactOpen: isOpen,
    closeArtifact: closePanel,
  } = useChatContext();

  return (
    <Drawer side="right" open={isOpen} onOpenChange={closePanel}>
      <Drawer.Content side="right" className="w-full sm:max-w-lg">
        <Drawer.Header>
          <Drawer.Title>{activeArtifact?.title}</Drawer.Title>
        </Drawer.Header>
        <ArtifactsPanel.Viewport className="px-4 pb-4">
          <ArtifactsPanel.Content>
            {activeArtifact?.content ?? ""}
          </ArtifactsPanel.Content>
        </ArtifactsPanel.Viewport>
        {activeArtifact && (
          <ArtifactsPanel.Footer content={activeArtifact.content} />
        )}
      </Drawer.Content>
    </Drawer>
  );
};

export const ChatArtifactsPanel = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobilePanel />;
  }

  return <DesktopPanel />;
};
