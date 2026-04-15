import { PageLoader } from "@/components/ui/PageLoader";

// Category list loading — the previous skeleton painted a bunch of
// empty rounded rows which looked like a broken list. Now we just
// show the shared animated loader and let the real list drop in
// when SSR finishes.
export default function CategoryLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <PageLoader />
    </main>
  );
}
