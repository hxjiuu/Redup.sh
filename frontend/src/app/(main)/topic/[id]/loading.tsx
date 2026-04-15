import { PageLoader } from "@/components/ui/PageLoader";

// Topic detail loading — drops the old "author avatar + body block"
// skeleton in favour of the shared animated loader. The real topic
// page has so many variations (anon / bot / banned / gated) that any
// static skeleton would flash the wrong shape for half of them.
export default function TopicLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
      <PageLoader />
    </main>
  );
}
