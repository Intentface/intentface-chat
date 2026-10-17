"use client";

import { defaultCatalog, type RenderContext } from "@intentface/chat/genui";
import { GenUi } from "@intentface/chat/genui-render";
import { useState } from "react";
import { components } from "./components";
import {
  CodeSection,
  CodeSide,
  CodeTitle,
  DrawnPane,
  formatJson,
  Json,
  SplitWindow,
  Switch,
} from "./frame";

/*
 * What the model writes is shaped for the model: raw numbers, rows as arrays,
 * as few tokens as it takes. What your component gets is shaped for drawing:
 * every value formatted, alignment and tone decided. The package works one out
 * from the other (each entry's `toRender`), so your component only draws.
 */

const PIECES = ["Metric", "KeyValue", "DataTable", "Chart"] as const;
type Piece = (typeof PIECES)[number];

const context: RenderContext = {
  locale: "en-GB",
  timeZone: "UTC",
  phase: "accepted",
  state: {},
  update: () => {},
};

// A function in the render props is shown by what it does, not its source.
const shown = (value: unknown): unknown =>
  typeof value === "function"
    ? "(value) => text"
    : Array.isArray(value)
      ? value.map(shown)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shown(inner)]))
        : value;

const renderOf = (piece: Piece) => {
  const entry = defaultCatalog.elements[piece];
  const props = entry.props.parse(entry.example);
  return (entry.toRender as (props: unknown, context: RenderContext) => unknown)(props, context);
};

export const RenderProps = () => {
  const [piece, setPiece] = useState<Piece>("Metric");
  const example = defaultCatalog.elements[piece].example;
  // Drawn in a card, as it would sit in a reply.
  const spec = {
    root: "card",
    elements: [
      { id: "card", type: "Card", props: {}, children: ["piece"] },
      { id: "piece", type: piece, props: example },
    ],
  };

  return (
    <SplitWindow
      bar={
        <Switch
          label="Element"
          onChange={setPiece}
          options={PIECES.map((value) => ({ value, label: value }))}
          value={piece}
        />
      }
      height="sm:h-120"
    >
      <DrawnPane title="Drawn by your component">
        <GenUi.Root components={components} locale="en-GB" timeZone="UTC">
          <GenUi.Spec input={spec} />
        </GenUi.Root>
      </DrawnPane>
      <CodeSide>
        <CodeSection header={<CodeTitle>{piece} props</CodeTitle>} status="the model writes">
          <Json text={formatJson(example, 40)} />
        </CodeSection>
        <CodeSection header={<CodeTitle>render props</CodeTitle>} status="your component gets">
          <Json text={formatJson(shown(renderOf(piece)), 40)} />
        </CodeSection>
      </CodeSide>
    </SplitWindow>
  );
};
