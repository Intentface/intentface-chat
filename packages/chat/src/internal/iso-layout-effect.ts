"use client";

import { useEffect, useLayoutEffect } from "react";

// SSR-safe layout effect. There is no layout to read on the server, so it
// degrades to useEffect there; on the client it still runs before paint, which
// is the whole point for anything that measures or corrects the DOM.
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
