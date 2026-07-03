"use client";

// Cycles through a string array on an interval. Drives placeholder rotation;
// the styled layer keys its crossfade off `key`.

import { useCallback, useEffect, useMemo, useState } from "react";

export const useLoop = (array: string[], delay = 3000) => {
  const [key, setKey] = useState(0);

  const incrementKey = useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  const currentItem = useMemo(() => {
    return array[key % array.length];
  }, [array, key]);

  useEffect(() => {
    const interval = setInterval(incrementKey, delay);
    return () => clearInterval(interval);
  }, [delay, incrementKey]);

  return { currentItem, key };
};
