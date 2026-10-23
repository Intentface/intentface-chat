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
  // Score and filter in a single pass, then sort by score.
  const scored: { item: CommandItemData; score: number }[] = [];
  for (const item of items) {
    const target = `${item.label ?? item.value ?? ""} ${item.keywords ?? ""}`.trim();
    const score = fuzzyScore(query, target);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ item }) => item);
};

// Ghost-text completion: the part of the highlighted item's label that would
// complete the query — only for a case-insensitive prefix match (a fuzzy hit
// completed inline would read as broken), with the label's own casing.
export const suggestionRemainder = (query: string, label: string): string | null => {
  if (!label.toLowerCase().startsWith(query.toLowerCase())) return null;
  const remainder = label.slice(query.length);
  return remainder.length > 0 ? remainder : null;
};
