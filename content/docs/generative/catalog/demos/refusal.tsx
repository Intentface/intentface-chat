"use client";

import { useTree, validateTree } from "@intentface/chat/generative";
import { useEffect, useRef, useState } from "react";
import { catalog } from "./catalog";
import { DrawNode } from "./draw";
import { Replay } from "./replay";

/*
 * The model's first call uses a component the catalog doesn't have.
 *
 * While it streams, `useTree` skips the node it can't draw. Once the call is
 * whole, `validateTree` names the problem; on a server that runs in the tool's
 * `execute`, and `formatIssues` goes back to the model as the tool's result.
 * The model reads it and calls again, and the second call replaces the first.
 */
const FIRST_CALL = {
  root: "deal",
  elements: [
    { id: "deal", type: "Card", props: { title: "Kide Systems" }, children: ["amount", "close"] },
    { id: "amount", type: "Metric", props: { label: "Amount", value: "€88,000" } },
    { id: "close", type: "Chart", props: { series: [12, 18, 31] } },
  ],
};

const SECOND_CALL = {
  root: "deal",
  elements: [
    { id: "deal", type: "Card", props: { title: "Kide Systems" }, children: ["amount", "close"] },
    { id: "amount", type: "Metric", props: { label: "Amount", value: "€88,000" } },
    { id: "close", type: "Metric", props: { label: "Expected close", value: "14 Nov" } },
  ],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Refusal = () => {
  const [input, setInput] = useState<unknown>(SECOND_CALL);
  // What went back to the model, shown while it calls again.
  const [sentBack, setSentBack] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Arrival motion is on from the first Replay, so the page loads still.
  const [live, setLive] = useState(false);
  const runs = useRef(0);
  const { root } = useTree(input, catalog);

  useEffect(
    () => () => {
      runs.current += 1;
    },
    [],
  );

  const replay = async () => {
    const run = ++runs.current;
    setLive(true);
    setBusy(true);
    setInput(FIRST_CALL);
    try {
      const result = await validateTree(FIRST_CALL, catalog);
      await sleep(700);
      if (run !== runs.current) return;
      setSentBack(result.issues?.[0]?.message);
      await sleep(2800);
    } finally {
      // Back at rest however the run ends, so Replay can't stay disabled.
      setInput(SECOND_CALL);
      setSentBack(undefined);
      setBusy(false);
    }
  };

  return (
    <div data-live={live || undefined} className="flex w-full max-w-lg flex-col items-center gap-3">
      <div className="min-h-35 w-full">{root ? <DrawNode node={root} /> : null}</div>
      {/* Always one line tall, so the button stays put when the issue shows. */}
      <p
        role="status"
        className="min-h-5 text-center text-[13px] text-zinc-500 leading-5 dark:text-zinc-400"
      >
        {sentBack ? (
          <span className="transition-opacity duration-150 ease-in-out starting:opacity-0 motion-reduce:transition-none">
            Sent back: {sentBack}
          </span>
        ) : null}
      </p>
      <Replay busy={busy} onReplay={replay} />
    </div>
  );
};
