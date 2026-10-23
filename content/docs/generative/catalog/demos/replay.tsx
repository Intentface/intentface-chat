import { RotateCcw } from "@keyline-icons/react";

type ReplayProps = {
  /** A run is playing. */
  busy: boolean;
  onReplay: () => void;
};

/*
 * The button under each demo, so nothing moves until you ask. It stays
 * focusable during a run (`aria-disabled`, not `disabled`), so focus isn't
 * lost when you press it.
 */
export const Replay = ({ busy, onReplay }: ReplayProps) => (
  <button
    type="button"
    aria-disabled={busy}
    onClick={() => {
      if (!busy) onReplay();
    }}
    className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white bg-linear-to-b from-white to-[#fdfdfd] px-3 font-medium text-[13px] text-zinc-900 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)] hover:from-[#fafafa] hover:to-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#0169cc]/60 focus-visible:outline-offset-2 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:from-white aria-disabled:hover:to-[#fdfdfd] dark:bg-[#2d2d30] dark:from-[#313134] dark:to-[#2a2a2d] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] dark:hover:from-[#38383b] dark:hover:to-[#313134] dark:aria-disabled:hover:from-[#313134] dark:aria-disabled:hover:to-[#2a2a2d]"
  >
    <RotateCcw className="size-3.5 shrink-0" />
    Replay
  </button>
);
