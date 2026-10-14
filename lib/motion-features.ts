// Loaded on demand by the LazyMotion provider so the animation engine ships in
// its own chunk instead of every route's first load. domMax, not domAnimation:
// attachment chips use the `layout` prop.
import { domMax } from "motion/react";

export default domMax;
