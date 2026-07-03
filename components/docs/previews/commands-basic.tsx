"use client";

import { FileTextIcon, GlobeIcon, SparklesIcon } from "lucide-react";
import { Commands } from "@/components/ai/commands";

// The styled command-list surface on its own. In the composer it renders inside
// a panel and the highlight tracks keyboard navigation; here it's static.
export const CommandsBasic = () => (
  <div className="w-full max-w-xs rounded-xl border border-primary-border bg-secondary shadow-md">
    <Commands>
      <Commands.Group>
        <Commands.GroupLabel>Actions</Commands.GroupLabel>
        <Commands.Item icon={SparklesIcon} highlighted>
          <Commands.ItemLabel>Improve writing</Commands.ItemLabel>
        </Commands.Item>
        <Commands.Item icon={GlobeIcon}>
          <Commands.ItemLabel>Search the web</Commands.ItemLabel>
          <Commands.ItemDescription>Find current sources</Commands.ItemDescription>
        </Commands.Item>
        <Commands.Item icon={FileTextIcon}>
          <Commands.ItemLabel>Summarize document</Commands.ItemLabel>
        </Commands.Item>
      </Commands.Group>
    </Commands>
  </div>
);
