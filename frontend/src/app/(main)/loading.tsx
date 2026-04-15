// Route-level fallback for every page under (main). Kept intentionally
// minimal — a thin indeterminate progress bar at the top of the viewport
// — because this file is inherited by *every* child route that doesn't
// ship its own loading.tsx. An overly specific skeleton here would
// flash a wrong-shaped placeholder on /topic/:id, /u/:name, /bot,
// /messages, etc. Routes that want a tailored skeleton (home list,
// category list, topic detail) provide their own.
export default function MainLoading() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-nav-progress rounded-r-full bg-primary/80" />
    </div>
  );
}
