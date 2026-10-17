"use client";

import { defaultCatalog, defineCatalog } from "@intentface/chat/genui";
import { defineComponents, GenUi } from "@intentface/chat/genui-render";
import { useEffect, useState } from "react";

/*
 * A spec as it streams in, replayed from the snapshots a model's tool input
 * passes through. Watch three things:
 *
 * - Before there is a root, the Placeholder holds the space.
 * - A Metric whose props don't parse yet (no value) is Pending; once it has a
 *   value it draws, and when the format is caught mid-word ("curr") the last
 *   props that parsed stay on screen instead of blinking back to pending.
 * - Because `live` is on, each piece goes through `Arrive` as it lands — here
 *   a fade. A spec mounted whole (`live` off, the default) draws still.
 */
const catalog = defineCatalog({
  version: defaultCatalog.version,
  elements: {
    Card: defaultCatalog.elements.Card,
    Metric: defaultCatalog.elements.Metric,
    Text: defaultCatalog.elements.Text,
  },
});

const card = (props: object, children: string[]) => ({
  id: "card",
  type: "Card",
  props,
  children,
});
const metric = (props: object) => ({ id: "open", type: "Metric", props });
const note = (text: string) => ({ id: "note", type: "Text", props: { text } });

const frames = [
  { root: "card" },
  { root: "card", elements: [card({}, [])] },
  { root: "card", elements: [card({ title: "Wee" }, [])] },
  { root: "card", elements: [card({ title: "Weekly" }, ["open"]), metric({ label: "Open" })] },
  {
    root: "card",
    elements: [card({ title: "Weekly" }, ["open"]), metric({ label: "Open", value: 240000 })],
  },
  {
    root: "card",
    elements: [
      card({ title: "Weekly" }, ["open"]),
      metric({ label: "Open", value: 240000, format: "curr" }),
    ],
  },
  {
    root: "card",
    elements: [
      card({ title: "Weekly" }, ["open", "note"]),
      metric({ label: "Open", value: 240000, format: "currency", currency: "EUR" }),
      note("Up 8% on"),
    ],
  },
  {
    root: "card",
    elements: [
      card({ title: "Weekly" }, ["open", "note"]),
      metric({ label: "Open", value: 240000, format: "currency", currency: "EUR" }),
      note("Up 8% on last week, all of it from two renewals."),
    ],
  },
];

const components = defineComponents(catalog, {
  elements: {
    Card: ({ title, children }) => (
      <section className="flex flex-col gap-3 rounded-xl border border-[#f0f0f0] bg-white p-4 dark:border-[#262626] dark:bg-[#181818]">
        <h3 className="h-5 font-medium text-sm">{title}</h3>
        {children}
      </section>
    ),
    Metric: ({ label, text }) => (
      <div>
        <div className="text-[#686868] text-xs dark:text-[#9b9b9b]">{label}</div>
        <div className="font-medium text-lg tabular-nums">{text}</div>
      </div>
    ),
    Text: ({ text }) => <p className="text-sm">{text}</p>,
  },
  Placeholder: () => (
    <div className="h-24 animate-pulse rounded-xl bg-[#f0f0f0] dark:bg-[#262626]" />
  ),
  Pending: ({ container, children }) =>
    container ? (
      <div className="flex flex-col gap-3">{children}</div>
    ) : (
      <div className="h-12 rounded-lg bg-[#f5f5f5] dark:bg-[#1f1f1f]" />
    ),
  Arrive: ({ children }) => <div className="fade-in-0 animate-in duration-300">{children}</div>,
});

const Replay = () => {
  const [frame, setFrame] = useState(0);
  const complete = frame === frames.length - 1;

  useEffect(() => {
    if (complete) return;
    const timer = setTimeout(() => setFrame(frame + 1), 600);
    return () => clearTimeout(timer);
  }, [frame, complete]);

  return (
    <GenUi.Root
      catalog={catalog}
      components={components}
      live
      phase={complete ? "accepted" : "streaming"}
    >
      <GenUi.Spec input={frames[frame]} />
    </GenUi.Root>
  );
};

export const Streaming = () => {
  // A new key is a new mount: `live` is read once, as it would be for a reply.
  const [run, setRun] = useState(0);
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Replay key={run} />
      <button
        className="self-start rounded-lg border border-[#f0f0f0] px-2.5 py-1 text-xs dark:border-[#262626]"
        onClick={() => setRun((current) => current + 1)}
        type="button"
      >
        Replay
      </button>
    </div>
  );
};
