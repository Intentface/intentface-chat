import { describe, expect, test } from "bun:test";
import { filterArrayItems, fuzzyScore, suggestionRemainder } from "../src/composer/fuzzy";
import type { CommandItemData } from "../src/composer/types";

describe("fuzzyScore", () => {
  test("empty query matches everything with 1", () => {
    expect(fuzzyScore("", "anything")).toBe(1);
  });

  test("prefix match wins outright with 2", () => {
    expect(fuzzyScore("web", "web search")).toBe(2);
  });

  test("scattered match scores above zero, adjacency beats gaps", () => {
    const adjacent = fuzzyScore("sea", "web search");
    const scattered = fuzzyScore("wsh", "web search");
    expect(adjacent).toBeGreaterThan(0);
    expect(scattered).toBeGreaterThan(0);
    expect(adjacent).toBeGreaterThan(scattered);
  });

  test("unmatchable query scores 0", () => {
    expect(fuzzyScore("xyz", "web search")).toBe(0);
  });
});

describe("filterArrayItems", () => {
  const item = (value: string, label: string, keywords?: string): CommandItemData => ({
    value,
    label,
    keywords,
  });

  const items = [
    item("create-doc", "Create document"),
    item("web-search", "Web search", "internet google"),
    item("code", "Write code"),
  ];

  test("empty query returns items untouched", () => {
    expect(filterArrayItems(items, "")).toEqual(items);
  });

  test("filters out non-matches and sorts by score", () => {
    const result = filterArrayItems(items, "web");
    expect(result[0]?.value).toBe("web-search");
    expect(result.every((r) => r.value !== "create-doc" || r.label.includes("doc"))).toBe(true);
  });

  test("keywords participate in matching", () => {
    const result = filterArrayItems(items, "google");
    expect(result.map((r) => r.value)).toContain("web-search");
  });
});

describe("suggestionRemainder", () => {
  test("empty query suggests the full label", () => {
    expect(suggestionRemainder("", "Test Document")).toBe("Test Document");
  });

  test("prefix match completes with the label's own casing", () => {
    expect(suggestionRemainder("te", "Test Document")).toBe("st Document");
  });

  test("fuzzy (non-prefix) matches suggest nothing", () => {
    expect(suggestionRemainder("doc", "Test Document")).toBeNull();
  });

  test("a fully typed label suggests nothing", () => {
    expect(suggestionRemainder("Test Document", "Test Document")).toBeNull();
  });
});
