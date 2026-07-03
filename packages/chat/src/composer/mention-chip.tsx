"use client";

// TipTap mention-chip extension. Renders the headless Chip in a NodeView; the
// icon map is injected through extension options (getChipIcons) so the package
// ships no icons — unknown keys render no icon. The command-list plugin rides
// along here so a single extension wires the whole prefix system.

import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { ReactNode } from "react";
import { Chip } from "../chip";
import type { ChipIconKey, ChipVariant } from "../chip-markdown";
import { type CommandListPluginOptions, createCommandListPlugin } from "./prefix-plugin";

export type MentionChipOptions = CommandListPluginOptions & {
  /** Icon map for chip icon keys. Read per render; unknown keys render nothing. */
  getChipIcons: () => Record<string, ReactNode>;
};

type MentionChipNodeViewProps = {
  node: { attrs: Record<string, unknown> };
  extension: { options: MentionChipOptions };
};

const MentionChipNodeView = ({ node, extension }: MentionChipNodeViewProps) => {
  const label = node.attrs.label as string;
  const icon = node.attrs.icon as ChipIconKey | null;
  const variant = node.attrs.variant as ChipVariant | null;
  const iconNode = icon ? extension.options.getChipIcons()[icon] : undefined;

  return (
    <NodeViewWrapper
      as="span"
      style={{ display: "inline", verticalAlign: "baseline" }}
      data-mention-chip
    >
      <Chip variant={variant ?? undefined}>
        {iconNode && <Chip.Icon>{iconNode}</Chip.Icon>}
        <Chip.Label>{label}</Chip.Label>
      </Chip>
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
        variant: { default: null },
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
