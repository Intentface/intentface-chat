"use client";

import { Shimmer } from "@/components/ai/shimmer";

// A loading affordance — the highlight sweeps across the text. Spread scales
// with the text length; duration is configurable.
export const ShimmerBasic = () => (
  <Shimmer className="font-medium text-lg">Generating response…</Shimmer>
);
