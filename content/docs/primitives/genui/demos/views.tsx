"use client";

import { defaultCatalog, viewToMarkdown } from "@intentface/chat/genui";
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
  MarkdownText,
  SplitWindow,
  Switch,
} from "./frame";

/*
 * The six ready-made views. A view tool offers them; the model picks one and
 * fills its props, and that is the whole call. Right is the call, left is
 * what it draws with the components in `components.tsx`, or the Markdown it
 * reads as wherever it can't be drawn. The props are the catalog's own
 * examples: the ones the model is shown.
 */

type Name = keyof typeof defaultCatalog.views;

const TITLES: Partial<Record<Name, string>> = {
  table: "Deals in play",
  chart: "New and renewed, by month",
  metrics: "This week",
  steps: "Before the renewal",
};

const NAMES = Object.keys(defaultCatalog.views) as Name[];

const inputOf = (name: Name) => ({
  view: name,
  ...(TITLES[name] ? { title: TITLES[name] } : {}),
  props: defaultCatalog.views[name].example,
});

const format = { locale: "en-GB", timeZone: "UTC" } as const;

export const Views = () => {
  const [name, setName] = useState<Name>("table");
  const [shown, setShown] = useState<"screen" | "markdown">("screen");
  const input = inputOf(name);

  return (
    <SplitWindow
      bar={
        <Switch
          label="View"
          onChange={setName}
          options={NAMES.map((value) => ({ value, label: value }))}
          value={name}
        />
      }
      height="sm:h-120"
    >
      <DrawnPane
        actions={
          <Switch
            label="Shown as"
            onChange={setShown}
            options={[
              { value: "screen", label: "On screen" },
              { value: "markdown", label: "Markdown" },
            ]}
            value={shown}
          />
        }
        title="Drawn"
      >
        {shown === "screen" ? (
          <GenUi.Root components={components} {...format}>
            <GenUi.View input={input} />
          </GenUi.Root>
        ) : (
          <MarkdownText markdown={viewToMarkdown(input, format)} />
        )}
      </DrawnPane>
      <CodeSide>
        <CodeSection header={<CodeTitle>show_view</CodeTitle>} status="the model’s call">
          <Json text={formatJson(input, 40)} />
        </CodeSection>
      </CodeSide>
    </SplitWindow>
  );
};
