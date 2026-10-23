"use client";

import { useTree } from "@intentface/chat/generative";
import { catalog } from "./catalog";
import { DrawNode } from "./draw";

/*
 * One component on its own: the model wrote `{ type, props }`, because the
 * tool's schema came from `tree.schema(catalog, { single: true })`. There are
 * no ids or children to get wrong, and `useTree` reads it as a one-node tree.
 */
const CALL = {
  type: "Metric",
  props: { label: "Pipeline value", value: "€196,000", note: "+12% on last month" },
};

export const Single = () => {
  const { root } = useTree(CALL, catalog);

  return <div className="w-64">{root ? <DrawNode node={root} /> : null}</div>;
};
