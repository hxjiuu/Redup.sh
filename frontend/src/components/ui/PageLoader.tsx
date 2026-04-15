// PageLoader is the shared animated loading state for route-level
// fallbacks that shouldn't ship content-shaped skeletons. Three brand-
// coloured dots bounce in sequence with a breathing halo behind them
// and a short label below — no boxy frames, no sidebar ghosts, no
// placeholder cards that don't match the final page. Used by the
// category list, topic detail, and any other route-level loading.tsx
// that needs to show activity without guessing at content shape.
export function PageLoader({
  label = "加载中",
  size = "lg",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dotSize = size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3 w-3";
  const gap = size === "sm" ? "gap-1.5" : size === "md" ? "gap-2" : "gap-2.5";
  const haloSize = size === "sm" ? "h-10 w-20" : size === "md" ? "h-14 w-28" : "h-20 w-40";
  const padY = size === "sm" ? "py-4" : size === "md" ? "py-10" : "py-24";

  return (
    <div className={`flex w-full flex-col items-center justify-center ${padY}`}>
      <div className="relative flex items-center justify-center">
        {/* Halo — a soft radial wash behind the dots that slowly breathes
            to give the animation depth without any visible frame. */}
        <div
          className={`pointer-events-none absolute rounded-full bg-primary/15 blur-2xl animate-halo-breathe ${haloSize}`}
        />
        <div className={`relative flex ${gap}`}>
          <span
            className={`rounded-full bg-primary animate-loader-bounce ${dotSize}`}
            style={{ animationDelay: "0ms" }}
          />
          <span
            className={`rounded-full bg-primary animate-loader-bounce ${dotSize}`}
            style={{ animationDelay: "160ms" }}
          />
          <span
            className={`rounded-full bg-primary animate-loader-bounce ${dotSize}`}
            style={{ animationDelay: "320ms" }}
          />
        </div>
      </div>
      {label && (
        <div className="mt-6 text-[11px] font-medium tracking-wider text-muted-foreground animate-loader-label">
          {label}
        </div>
      )}
    </div>
  );
}

// InlineLoader is a compact horizontal variant of PageLoader for places
// that need a small "loading more" cue inline with existing content —
// e.g. at the bottom of an infinite-scroll list. No halo, no padding.
export function InlineLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <div className="flex gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-loader-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-loader-bounce"
          style={{ animationDelay: "160ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-loader-bounce"
          style={{ animationDelay: "320ms" }}
        />
      </div>
      {label && (
        <span className="text-[11px] text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
