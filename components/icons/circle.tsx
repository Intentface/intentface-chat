import type { ComponentProps } from "react";

export const CircleIcon = (props: ComponentProps<"svg">) => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="10" fill="currentColor" />
  </svg>
);
