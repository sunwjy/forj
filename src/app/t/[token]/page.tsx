import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TripLoading, TripScreen } from "@/components/trip/TripScreen";
import { tripMetadata } from "@/lib/trip/trip-metadata";

/**
 * The messenger link preview (spec 7.5). `htmlLimitedBots` in `next.config.ts`
 * makes every request wait for this, so the tags land in `<head>` and a missing
 * trip answers a real HTTP 404.
 */
export async function generateMetadata({ params }: PageProps<"/t/[token]">): Promise<Metadata> {
  const { token } = await params;
  const metadata = await tripMetadata(token);
  if (metadata === "not_found") notFound();
  return metadata;
}

/**
 * The trip screen (spec 7.3). The static shell shows the loading state; the
 * token is read inside Suspense and the trip loads in the browser via `get_trip`.
 */
export default function TripPage({ params }: PageProps<"/t/[token]">) {
  return (
    <Suspense fallback={<TripLoading />}>
      <TripScreen params={params} />
    </Suspense>
  );
}
