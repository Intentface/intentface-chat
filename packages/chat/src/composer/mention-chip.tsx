"use client";

// TipTap mention-chip extension. Renders committed chips in a NodeView through
// the injected renderChip seam — the package interprets none of the chip's
// opaque data (the icon key); without a renderer a label-only Chip renders.
// The command-list plugin rides along here so a single extension wires the
// whole prefix system.

import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { ReactNode } from "react";
import { Chip } from "../chip";
import type { ChipData, ChipIconKey } from "../chip-markdown";
import { type CommandListPluginOptions, createCommandListPlugin } from "./prefix-plugin";

export type MentionChipOptions = CommandListPluginOptions & {
  /** Custom renderer for committed chips. Read per render; defaults to a label-only Chip. */
  renderChip?: (chip: ChipData) => ReactNode;
};

type MentionChipNodeViewProps = {
  node: { attrs: Record<string, unknown> };
  extension: { options: MentionChipOptions };
};

const MentionChipNodeView = ({ node, extension }: MentionChipNodeViewProps) => {
  const chip: ChipData = {
    prefix: (node.attrs.prefix as string) ?? "",
    value: (node.attrs.value as string) ?? "",
    label: (node.attrs.label as string) ?? "",
    icon: (node.attrs.icon as ChipIconKey | null) ?? undefined,
  };

  return (
    <NodeViewWrapper
      as="span"
      style={{ display: "inline", verticalAlign: "baseline" }}
      data-mention-chip
    >
      {extension.options.renderChip?.(chip) ?? (
        <Chip>
          <Chip.Label>{chip.label}</Chip.Label>
        </Chip>
      )}
    </NodeViewWrapper>
  );
};

export const createMentionChipExtension = (options: MentionChipOptions) =>
  TiptapNode.create<MentionChipOptions>({
    name: "mentionChip",
    group: "inline",
    inline: true,
    atom: true,

    addOptions() {
      return options;
    },

    addAttributes() {
      return {
        prefix: { default: "" },
        label: { default: "" },
        value: { default: "" },
        icon: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: "span[data-mention-chip]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", mergeAttributes({ "data-mention-chip": "" }, HTMLAttributes), 0];
    },

    addNodeView() {
      return ReactNodeViewRenderer(MentionChipNodeView);
    },

    addProseMirrorPlugins() {
      return [createCommandListPlugin(this.options)];
    },
  });
