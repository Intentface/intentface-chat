# Components

Conventions for authoring components in `components/ai/` and `components/ui/`. Read `DESIGN_SYSTEM.md` for tokens, theming, and color/spacing scales.

## Stack

- **React 19** with new JSX transform — `ref` is a regular prop, never `forwardRef`
- **Base UI** (`@base-ui/react`) for headless primitives
- **CVA** (`class-variance-authority`) for variant matrices
- **`cn()`** from `lib/utils.ts` (`clsx` + `tailwind-merge`) for class merging
- **Motion** (`motion/react`) for entrance/exit animations

## The compound component pattern

Every component in `components/ai/` and `components/ui/` is a compound component. Consumers compose pieces; components never hardcode their layout.

### Shape

```tsx
// One file, one named export — the assembled object.
const FooRoot = ({ className, ...props }: FooRootProps) => (
  <div data-slot="foo" className={cn("...", className)} {...props} />
);

const FooItem = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="foo-item" className={cn("...", className)} {...props} />
);

export const Foo = Object.assign(FooRoot, {
  Item: FooItem,
});
```

### Usage

```tsx
<Foo>
  <Foo.Item>Hello</Foo.Item>
</Foo>
```

### Rules

- **One named export per file** — the `Object.assign(...)` result. No barrel `index.ts` files.
- **Single-file components** — keep all sub-components in the same file. Don't split into `foo-item.tsx`, `foo-root.tsx`, etc.
- **Single-dot compound names** — `Foo.Item`, never `Foo.Item.Label`. Flatten nested concepts as `Foo.ItemLabel`.
- **No monolithic render-all components** — break UI into composable pieces (root, content, item, action, etc.).
- **Accept `children`** instead of hardcoding internal structure.
- **Accept `className`** on every sub-component for style overrides; merge with `cn()`.
- **Convenience wrappers are fine** — a higher-level component can compose primitives with default behavior.
- **Marker sub-components for slot routing** — when a sub-component shouldn't render in place but feed content elsewhere (e.g. into a popup), declare it as a no-op (`return null`) and inspect `children` in the root via `Children.toArray` + `isValidElement` + `child.type === Marker`. See `components/ai/chip.tsx` (`Chip.Preview`).

### Pulling props from Base UI primitives

Reuse the primitive's prop types directly — don't redeclare them.

```tsx
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

const TooltipTrigger = (props: TooltipPrimitive.Trigger.Props) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
);
```

For HTML primitives, use `ComponentProps<"div">` / `ComponentProps<"button">` / etc.

For wrapping another local component, use `ComponentProps<typeof OtherComponent>`.

## Variants with CVA

Use CVA when a component has variant + size matrices. Two layers: a base string of common classes, then a `variants` object.

```tsx
const buttonVariants = cva(
  // Base — long, can be a single string OR an array (see below)
  "inline-flex items-center ... rounded-lg ...",
  {
    variants: {
      variant: {
        primary: "bg-primary border-primary-border ...",
        secondary: "bg-secondary border-secondary-border ...",
        ghost: "hover:bg-primary-hover",
      },
      size: {
        xs: "h-6 px-2 text-xs ...",
        sm: "h-7 px-2.5 text-[0.8rem] ...",
        md: "h-8 px-2.5 ...",
        lg: "h-9 px-2.5 ...",
        xl: "h-10 px-3 ...",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

const Button = ({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) => (
  <ButtonPrimitive
    data-slot="button"
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  />
);
```

### CVA conventions

- **Standard size names**: `xs`, `sm`, `md`, `lg`, `xl` (and `2xs` only when needed). No `small` / `large` / `default`.
- **Always set `defaultVariants`** so callers can omit them.
- **Long base strings**: organize as an array with `// comments` grouping concerns (Layout, Base styles, Focus, Disabled, etc.). See `components/ui/select.tsx`.
- **Pass `className` through CVA**: `buttonVariants({ variant, size, className })` — CVA merges it before `cn()` does the final tailwind-merge pass.
- **Export the `cva` result** alongside the component when other components compose it (e.g. `iconButtonVariants`).

## Styling conventions

### `data-slot` and `data-role`

Set `data-slot="component-name"` on every rendered element. Use it for:

- Targeted styling from parents (`*:data-[slot=select-icon]:text-muted-foreground`)
- Container-relative styling (`in-data-[slot=button-group]:rounded-lg`)
- DOM querying / testing

Use `data-role`, `data-state`, `data-error`, `data-last`, etc. for state-driven styling. Set them as empty strings when truthy, `undefined` when falsy:

```tsx
data-error={isError ? "" : undefined}
```

Read with `data-[role=user]:`, `group-data-[role=assistant]:`, etc.

### `cn()` everywhere

Always merge `className` from props as the **last** argument to `cn()` so callers can override:

```tsx
className={cn("base-classes", conditionalClass && "...", className)}
```

### Tokens, not raw colors

Use semantic tokens — `bg-primary`, `text-ink-primary`, `border-primary-border`, `bg-accent`. Never hardcode hex values. Token system is documented in `DESIGN_SYSTEM.md`.

### Animations

- Open/close: `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` + matching `data-closed:` variants (Base UI primitives expose `data-open` / `data-closed`).
- Side-aware slide: `data-[side=top]:slide-in-from-bottom-2`, `data-[side=bottom]:slide-in-from-top-2`, etc.
- Entrance/exit on lists: wrap in `<AnimatePresence>` and use `motion.div` with `initial` / `animate` / `exit`.

## TypeScript conventions

- **Prefer `type` over `interface`** for type definitions.
- **Prefer arrow functions** (`const Foo = () => ...`) over `function` keyword for components, handlers, and utilities.
- **No `forwardRef`** — accept `ref` directly in the props type (React 19).
- **No inline JSX generics** — type the callback param, don't write `<Component<T> prop>`.
- **No aliased destructuring** — use the actual namespace name; rename only on local conflict.
- **Full descriptive names** — no `e`, `el`, `idx`, `cb`, etc.

## Anti-patterns

- A component that only accepts a `props.title` / `props.actions` / etc. instead of `children` and slots.
- Splitting a compound into `foo-root.tsx` + `foo-item.tsx` + `foo-action.tsx` files.
- Re-exporting from `index.ts` barrels.
- `useEffect` to sync derived state. Compute it inline, or compare against a ref.
- `forwardRef`.
- Hardcoded hex colors or arbitrary spacing instead of tokens.
- Custom size names like `default`, `small`, `tight`.
- Three-level compound names (`Foo.Item.Label`).

## Reference components to copy from

- **Compound pattern, full**: `components/ai/message.tsx`, `components/ui/select.tsx`
- **Marker sub-component routing**: `components/ai/chip.tsx` (`Chip.Preview`)
- **CVA + Base UI primitive**: `components/ui/button.tsx`, `components/ui/icon-button.tsx`
- **Portal + animations**: `components/ui/dialog.tsx`, `components/ui/tooltip.tsx`
- **Context-driven compound**: `components/ai/thread.tsx`
