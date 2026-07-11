import type { SVGProps } from "react";

export const InputFormIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g>
      <path d="M9 21H7.5V3H9V21Z" fill="currentColor" />
      <path
        d="M6 18H4.75C3.23122 18 2 16.7688 2 15.25V8.75C2 7.23122 3.23122 6 4.75 6H6V18Z"
        fill="currentColor"
      />
      <path
        d="M19.25 6C20.7688 6 22 7.23122 22 8.75V15.25C22 16.7688 20.7688 18 19.25 18H10.5V6H19.25Z"
        fill="currentColor"
      />
    </g>
  </svg>
);
