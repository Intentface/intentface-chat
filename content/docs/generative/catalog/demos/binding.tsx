"use client";

import { type FoundBinding, useTree } from "@intentface/chat/generative";
import { useEffect, useRef, useState } from "react";
import { catalog } from "./catalog";
import { DrawNode } from "./draw";
import { Replay } from "./replay";

/*
 * The model already called a data tool, `getDeals`, and saw its rows by ref
 * only. Instead of copying them into the UI call, it binds the table's `rows`
 * to that ref and names the columns it wants.
 *
 * `resolve` looks the ref up. In an app that's the data tool's output among
 * the message's parts, by its tool call id. Until it returns something, the
 * table is pending; once it does, the named columns are picked from each row.
 */
const DEALS = [
  { company: "Aalto Labs", stage: "Proposal", amount: "€62,400", owner: "Ilona" },
  { company: "Kide Systems", stage: "Negotiation", amount: "€88,000", owner: "Mikko" },
  { company: "Lumo Oy", stage: "Won", amount: "€31,600", owner: "Ilona" },
  { company: "Revontuli", stage: "Qualified", amount: "€14,000", owner: "Aino" },
];

const CALL = {
  root: "deals",
  elements: [
    { id: "deals", type: "Card", props: { title: "Open deals" }, children: ["table"] },
    {
      id: "table",
      type: "Table",
      props: {
        columns: ["Company", "Stage", "Amount"],
        rows: { $data: "call_getDeals_1", columns: ["company", "stage", "amount"] },
      },
    },
  ],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Binding = () => {
  // Tool results by call id: the data has arrived at rest; Replay clears it.
  const [results, setResults] = useState<Record<string, unknown>>({ call_getDeals_1: DEALS });
  // Arrival motion is on from the first Replay, so the page loads still.
  const [live, setLive] = useState(false);
  const runs = useRef(0);
  const resolve = (binding: FoundBinding) => results[binding.$data];
  const { root } = useTree(CALL, catalog, { resolve });
  const loading = !("call_getDeals_1" in results);

  useEffect(
    () => () => {
      runs.current += 1;
    },
    [],
  );

  const replay = async () => {
    const run = ++runs.current;
    setLive(true);
    setResults({});
    await sleep(1600);
    if (run !== runs.current) return;
    setResults({ call_getDeals_1: DEALS });
  };

  return (
    <div
      data-live={live || undefined}
      className="flex w-full max-w-[520px] flex-col items-center gap-3"
    >
      {root ? <DrawNode node={root} /> : null}
      <Replay busy={loading} onReplay={replay} />
    </div>
  );
};
