// App-owned message-info extractors: how reasoning, tool chains, and sources
// are grouped and labelled for rendering. These encode this app's conventions
// (bold `**Header**` reasoning sections, dedup-by-domain sources, the
// chain-of-thought grouping) over the package's generic part contracts.

import type { MessageSegment } from "@intentface/chat/message-utils";
import { isSourceUrlPart, type ReasoningPart, type UnknownPart } from "@intentface/chat/types";

// ---------------------------------------------------------------------------
// Reasoning sections — split by standalone bold `**Header**` lines
// ---------------------------------------------------------------------------

/** A section of reasoning text split by a bold `**Header**` line. */
export type ReasoningSection = { header: string | null; body: string };

/**
 * Splits reasoning text into sections by standalone bold `**Header**` lines.
 * Each header and its following body become a separate section.
 */
export const splitReasoningByHeaders = (texts: readonly string[]): ReasoningSection[] => {
  const combined = texts.join("\n\n");
  const parts = combined.split(/(?=^\*\*[^*]+\*\*$)/m);

  const sections: ReasoningSection[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*/);
    const header = headerMatch?.[1];
    if (headerMatch && header) {
      sections.push({
        header: header.trim(),
        body: trimmed.slice(headerMatch[0].length).trim(),
      });
    } else {
      sections.push({ header: null, body: trimmed });
    }
  }
  return sections;
};

// ---------------------------------------------------------------------------
// Chain of thought — reasoning + tool segments as one collapsible unit
// ---------------------------------------------------------------------------

/** Info about the reasoning + tool "chain of thought" portion of a message. */
export type ChainInfo = {
  /** Reasoning and tool segments in chronological order. */
  segments: MessageSegment[];
  hasTools: boolean;
  /** True when reasoning is present but no tool calls — renders standalone. */
  onlyReasoning: boolean;
};

/**
 * Filters segments to the steps subset (reasoning + tools) and
 * classifies whether tools are present.
 */
export const getChainInfo = (segments: readonly MessageSegment[]): ChainInfo => {
  const chainSegments = segments.filter((s) => s.type === "reasoning" || s.type === "tool");
  const hasTools = chainSegments.some((s) => s.type === "tool");
  const hasReasoning = chainSegments.some((s) => s.type === "reasoning");
  return {
    segments: chainSegments,
    hasTools,
    onlyReasoning: hasReasoning && !hasTools,
  };
};

// ---------------------------------------------------------------------------
// Standalone reasoning info
// ---------------------------------------------------------------------------

/** Standalone reasoning info (used when no tools are present). */
export type ReasoningInfo = {
  parts: ReasoningPart[];
  texts: string[];
  /** Section headers extracted from reasoning text (e.g. **Analyzing data**). */
  headers: string[] | undefined;
  isStreaming: boolean;
};

/**
 * Extracts reasoning parts, their text content, section headers for the
 * collapsible trigger, and whether reasoning is actively streaming.
 */
export const getReasoningInfo = (
  segments: readonly MessageSegment[],
  isMessageStreaming: boolean,
): ReasoningInfo => {
  const parts = segments
    .filter((s): s is MessageSegment & { type: "reasoning" } => s.type === "reasoning")
    .flatMap((s) => s.parts);
  const texts = parts.map((p) => p.text);
  const isStreaming = isMessageStreaming && segments.at(-1)?.type === "reasoning";
  const sectionHeaders = splitReasoningByHeaders(texts)
    .map((section) => section.header)
    .filter((header): header is string => header !== null);
  const headers = sectionHeaders.length > 0 ? sectionHeaders : undefined;
  return { parts, texts, headers, isStreaming };
};

// ---------------------------------------------------------------------------
// Source URLs — deduplicated by display domain
// ---------------------------------------------------------------------------

/** A deduplicated source extracted from `source-url` parts. */
export type SourceInfo = {
  url: string;
  domain: string;
};

/** Aggregated source-url info for a message. */
export type SourcesInfo = {
  sources: SourceInfo[];
  hasSources: boolean;
};

/**
 * Extracts `source-url` parts, deduplicates by hostname (stripping `www.`),
 * and returns an array of unique sources with their display domain.
 */
export const getSourcesInfo = (parts: readonly UnknownPart[]): SourcesInfo => {
  const seen = new Set<string>();
  const sources: SourceInfo[] = [];

  for (const part of parts) {
    if (!isSourceUrlPart(part)) continue;
    try {
      const domain = new URL(part.url).hostname.replace(/^www\./, "");
      if (seen.has(domain)) continue;
      seen.add(domain);
      sources.push({ url: part.url, domain });
    } catch {
      // skip malformed URLs
    }
  }

  return { sources, hasSources: sources.length > 0 };
};
