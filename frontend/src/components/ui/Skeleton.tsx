import { cn } from "@/lib/utils";

// Skeleton is the minimal building block for placeholder UI. Compose it
// into shapes that mirror the real component so the transition from
// loading to loaded feels like the same block settling in, not a
// layout shift. Uses the shimmer utility from globals.css — callers
// can pass a style prop to stagger the shimmer via animationDelay.
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("animate-shimmer rounded-md", className)} style={style} />;
}
