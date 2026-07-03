import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/docs/source";

// Static Orama index built from the docs' structuredData.
export const { GET } = createFromSource(source);
