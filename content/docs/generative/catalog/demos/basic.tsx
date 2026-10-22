"use client";

import { useTree } from "@intentface/chat/generative";
import { parsePartialJson } from "ai";
import { useEffect, useRef, useState } from "react";
import { catalog } from "./catalog";
import { DrawNode } from "./draw";
import { Replay } from "./replay";

/*
 * A model's UI tool call, drawn by your own components while it streams.
 *
 * `useTree` reads whatever part of the call has arrived: a node shows up once
 * its type is written, and stays pending until its props validate. With
 * `streaming` on, a node that was ready keeps its last valid props, so nothing
 * blinks back to a placeholder mid-word.
 *
 * In an app the input is `part.input` from `useChat`. Here a timer feeds the
 * call's JSON through `parsePartialJson`, which is what the AI SDK does with a
 * tool call's input as it streams.
 */
const CALL = {
  root: "pipeline",
  elements: [
    {
      id: "pipeline",
      type: "Card",
      props: { title: "Pipeline" },
      children: ["value", "deals", "table"],
    },
    { id: "value", type: "Metric", props: { label: "Pipeline value", value: "€196,000" } },
    { id: "deals", type: "Metric", props: { label: "Open deals", value: "4" } },
    {
      id: "table",
      type: "Table",
      props: {
        columns: ["Company", "Stage", "Amount"],
        rows: [
          ["Aalto Labs", "Proposal", "€62,400"],
          ["Kide Systems", "Negotiation", "€88,000"],
          ["Lumo Oy", "Won", "€31,600"],
          ["Revontuli", "Qualified", "€14,000"],
        ],
      },
    },
  ],
};

const TEXT = JSON.stringify(CALL);
const CHARACTERS_PER_TICK = 12;
const TICK_MS = 40;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Basic = () => {
  // The finished call at rest; Replay streams it in again.
  const [input, setInput] = useState<unknown>(CALL);
  const [streaming, setStreaming] = useState(false);
  // Arrival motion is on from the first Replay, so the page loads still.
  const [live, setLive] = useState(false);
  const runs = useRef(0);
  const { root } = useTree(input, catalog, { streaming });

  useEffect(
    () => () => {
      runs.current += 1;
    },
    [],
  );

  const replay = async () => {
    const run = ++runs.current;
    setLive(true);
    setStreaming(true);
    try {
      for (let end = 0; end < TEXT.length; end += CHARACTERS_PER_TICK) {
        await sleep(TICK_MS);
        const { value } = await parsePartialJson(TEXT.slice(0, end));
        if (run !== runs.current) return;
        setInput(value);
      }
    } finally {
      // Back at rest however the run ends, so Replay can't stay disabled.
      setInput(CALL);
      setStreaming(false);
    }
  };

  return (
    <div
      data-live={live || undefined}
      className="flex w-full max-w-[520px] flex-col items-center gap-3"
    >
      {/* Reserves the finished card's height, so the button stays put while it streams. */}
      <div className="min-h-82 w-full">{root ? <DrawNode node={root} /> : null}</div>
      <Replay busy={streaming} onReplay={replay} />
    </div>
  );
};
