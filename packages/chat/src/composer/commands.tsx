"use client";

// Command-list structural primitives used internally by the composer's command
// palette (see command-list.tsx). Pure markup with data-slot hooks — selection
// and keyboard behavior live in the composer's command plumbing; styling belongs
// to the styled layer. Not a public export.

import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";

type CommandsRootProps = PrimitiveProps<"div">;

const CommandsRoot = ({ className, render, style, ...elementProps }: CommandsRootProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "command-list" }, elementProps] },
  );

type CommandsGroupProps = PrimitiveProps<"div">;

const CommandsGroup = ({ className, render, style, ...elementProps }: CommandsGroupProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "command-group" }, elementProps] },
  );

type CommandsGroupLabelProps = PrimitiveProps<"div">;

const CommandsGroupLabel = ({
  className,
  render,
  style,
  ...elementProps
}: CommandsGroupLabelProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "command-group-label" }, elementProps] },
  );

export type CommandsItemState = {
  /** Present as data-highlighted while keyboard/hover highlighted. */
  highlighted: boolean;
};

export type CommandsItemProps = PrimitiveProps<"button", CommandsItemState> & {
  highlighted?: boolean;
};

const CommandsItem = ({
  highlighted = false,
  className,
  render,
  style,
  ...elementProps
}: CommandsItemProps) =>
  useRenderElement(
    "button",
    { className, render, style },
    {
      state: { highlighted },
      props: [{ "data-slot": "command-item" }, elementProps],
    },
  );

type CommandsItemLabelProps = PrimitiveProps<"span">;

const CommandsItemLabel = ({ className, render, style, ...elementProps }: CommandsItemLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "command-item-label" }, elementProps] },
  );

type CommandsItemDescriptionProps = PrimitiveProps<"span">;

const CommandsItemDescription = ({
  className,
  render,
  style,
  ...elementProps
}: CommandsItemDescriptionProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "command-item-description" }, elementProps] },
  );

type CommandsEmptyProps = PrimitiveProps<"div">;

const CommandsEmpty = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: CommandsEmptyProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "command-empty", children: children ?? "No results" }, elementProps] },
  );

type CommandsFooterProps = PrimitiveProps<"div">;

const CommandsFooter = ({ className, render, style, ...elementProps }: CommandsFooterProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "command-footer" }, elementProps] },
  );

export const Commands = Object.assign(CommandsRoot, {
  Group: CommandsGroup,
  GroupLabel: CommandsGroupLabel,
  Item: CommandsItem,
  ItemLabel: CommandsItemLabel,
  ItemDescription: CommandsItemDescription,
  Empty: CommandsEmpty,
  Footer: CommandsFooter,
});
