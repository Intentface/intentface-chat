import type { SVGProps } from "react";

export const NpmIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="false"
      role="img"
      aria-label="npm"
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M3 21H12V7.5H16.5V21H21V3H3V21Z" fill="currentColor" />
    </svg>
  );
};
