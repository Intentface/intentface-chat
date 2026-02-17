"use client";

import type { LucideIcon } from "lucide-react";
import { CircleCheckIcon, CircleDotIcon, CircleIcon } from "lucide-react";
import { motion } from "motion/react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { Collapsible } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ChainOfThoughtContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null,
);

export const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought",
    );
  }
  return context;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type ChainOfThoughtRootProps = Omit<
  ComponentProps<"div">,
  "defaultOpen"
> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ChainOfThoughtRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...props
}: ChainOfThoughtRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen }),
    [isOpen, setIsOpen],
  );

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        data-slot="chain-of-thought"
        className={cn("not-prose w-full", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </ChainOfThoughtContext.Provider>
  );
};

ChainOfThoughtRoot.displayName = "ChainOfThought";

// ---------------------------------------------------------------------------
// Header (trigger)
// ---------------------------------------------------------------------------

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof Collapsible.Trigger
>;

const ChainOfThoughtHeader = ({
  children,
  className,
  ...props
}: ChainOfThoughtHeaderProps) => {
  const { isOpen } = useChainOfThought();

  return (
    <Collapsible.Trigger
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children ?? "Chain of Thought"}
      <ChevronDownIcon
        className={cn(
          "size-4 transition-transform",
          isOpen ? "rotate-180" : "rotate-0",
        )}
      />
    </Collapsible.Trigger>
  );
};

ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";

// ---------------------------------------------------------------------------
// Content (collapsible panel)
// ---------------------------------------------------------------------------

export type ChainOfThoughtContentProps = ComponentProps<
  typeof Collapsible.Panel
>;

const ChainOfThoughtContent = ({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) => (
  <Collapsible.Panel className={cn("mt-3", className)} {...props}>
    <div className="flex flex-col gap-3">{children}</div>
  </Collapsible.Panel>
);

ChainOfThoughtContent.displayName = "ChainOfThoughtContent";

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

type StepStatus = "complete" | "active" | "pending";

const statusIcons: Record<StepStatus, LucideIcon> = {
  complete: CircleCheckIcon,
  active: CircleDotIcon,
  pending: CircleIcon,
};

export type ChainOfThoughtStepProps = ComponentProps<typeof motion.div> & {
  icon?: LucideIcon;
  label: string;
  description?: string;
  status?: StepStatus;
  children?: ReactNode;
};

const ChainOfThoughtStep = ({
  icon,
  label,
  description,
  status = "complete",
  className,
  children,
  ...props
}: ChainOfThoughtStepProps) => {
  const Icon = icon ?? statusIcons[status];

  return (
    <motion.div
      data-slot="chain-of-thought-step"
      data-status={status}
      className={cn("flex gap-2.5", className)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      <div
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center",
          status === "complete" && "text-foreground",
          status === "active" && "text-foreground animate-pulse",
          status === "pending" && "text-muted-foreground/50",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-sm leading-tight",
            status === "pending"
              ? "text-muted-foreground/50"
              : "text-foreground",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="text-muted-foreground text-xs">{description}</span>
        )}
        {children}
      </div>
    </motion.div>
  );
};

ChainOfThoughtStep.displayName = "ChainOfThoughtStep";

// ---------------------------------------------------------------------------
// SearchResults / SearchResult
// ---------------------------------------------------------------------------

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

const ChainOfThoughtSearchResults = ({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultsProps) => (
  <div
    data-slot="chain-of-thought-search-results"
    className={cn("mt-1 flex flex-wrap gap-1.5", className)}
    {...props}
  >
    {children}
  </div>
);

ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";

export type ChainOfThoughtSearchResultProps = ComponentProps<"span">;

const ChainOfThoughtSearchResult = ({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultProps) => (
  <span
    data-slot="chain-of-thought-search-result"
    className={cn(
      "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-muted-foreground text-xs",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
  src?: string;
  alt?: string;
};

const ChainOfThoughtImage = ({
  caption,
  src,
  alt,
  className,
  children,
  ...props
}: ChainOfThoughtImageProps) => (
  <div
    data-slot="chain-of-thought-image"
    className={cn("mt-1 flex flex-col gap-1", className)}
    {...props}
  >
    {src ? (
      <img
        src={src}
        alt={alt ?? caption ?? ""}
        className="max-h-48 rounded-md object-cover"
      />
    ) : (
      children
    )}
    {caption && (
      <span className="text-muted-foreground text-xs">{caption}</span>
    )}
  </div>
);

ChainOfThoughtImage.displayName = "ChainOfThoughtImage";

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const ChainOfThought = Object.assign(ChainOfThoughtRoot, {
  Header: ChainOfThoughtHeader,
  Content: ChainOfThoughtContent,
  Step: ChainOfThoughtStep,
  SearchResults: ChainOfThoughtSearchResults,
  SearchResult: ChainOfThoughtSearchResult,
  Image: ChainOfThoughtImage,
});
