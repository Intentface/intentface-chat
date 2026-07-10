"use client";

// Command-list structural primitives used internally by the composer's command
// palette (see command-list.tsx). Pure markup with part-attribute hooks — selection
// and keyboard behavior live in the composer's command plumbing; styling belongs
// to the styled layer. Not a public export.

import { createContext, use, useId } from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";

type CommandsRootProps = PrimitiveProps<"div">;

const CommandsRoot = ({ className, render, style, ...elementProps }: CommandsRootProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-command-list": "" }, elementProps] },
  );

// Group → its label association: the group mints the id, the label stamps it.
// role="group" keeps listbox→option ownership intact through the wrapper div.
const GroupLabelIdContext = createContext<string>("");

type CommandsGroupProps = PrimitiveProps<"div">;

const CommandsGroup = ({ className, render, style, ...elementProps }: CommandsGroupProps) => {
  const labelId = useId();
  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      props: [
        { role: "group", "aria-labelledby": labelId, "data-command-group": "" },
        elementProps,
      ],
    },
  );
  return <GroupLabelIdContext value={labelId}>{element}</GroupLabelIdContext>;
};

type CommandsGroupLabelProps = PrimitiveProps<"div">;

const CommandsGroupLabel = ({
  className,
  render,
  style,
  ...elementProps
}: CommandsGroupLabelProps) => {
  const labelId = use(GroupLabelIdContext);
  return useRenderElement(
    "div",
    { className, render, style },
    { props: [{ id: labelId || undefined, "data-command-group-label": "" }, elementProps] },
  );
};

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
      // Options, not buttons: keyboard selection stays in the editor
      // (activedescendant pattern), so rows must never be tab stops or
      // announce as "button".
      props: [{ role: "option", tabIndex: -1, "data-command-item": "" }, elementProps],
    },
  );

type CommandsItemLabelProps = PrimitiveProps<"span">;

const CommandsItemLabel = ({ className, render, style, ...elementProps }: CommandsItemLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-command-item-label": "" }, elementProps] },
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
    { props: [{ "data-command-item-description": "" }, elementProps] },
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
    { props: [{ "data-command-empty": "", children }, elementProps] },
  );

type CommandsFooterProps = PrimitiveProps<"div">;

const CommandsFooter = ({ className, render, style, ...elementProps }: CommandsFooterProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-command-footer": "" }, elementProps] },
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
