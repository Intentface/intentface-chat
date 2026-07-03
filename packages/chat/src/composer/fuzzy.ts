// Command list — fuzzy filtering. A prefix match wins outright (2); otherwise
// every matched character scores, with bonuses for adjacency and word-boundary
// hits, normalized by query length. Returns 0 when the query can't be matched.

import type { CommandItemData } from "./types";

export const fuzzyScore = (query: string, target: string): number => {
  if (!query) return 1;
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (lowerTarget.startsWith(lowerQuery)) return 2;

  let queryIndex = 0;
  let score = 0;
  let previousMatchIndex = -1;

  for (
    let targetIndex = 0;
    targetIndex < lowerTarget.length && queryIndex < lowerQuery.length;
    targetIndex++
  ) {
    if (lowerTarget[targetIndex] === lowerQuery[queryIndex]) {
      score += 1;
      if (previousMatchIndex === targetIndex - 1) score += 2;
      if (targetIndex === 0 || lowerTarget[targetIndex - 1] === " ") score += 1;
      previousMatchIndex = targetIndex;
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length ? score / lowerQuery.length : 0;
};

export const filterArrayItems = (items: CommandItemData[], query: string): CommandItemData[] => {
  if (!query) return items;
  return items
    .map((item) => {
      const target = `${item.label ?? item.value ?? ""} ${item.keywords ?? ""}`.trim();
      return { item, score: fuzzyScore(query, target) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};
