import { Suspense } from "react";
import { TripLoading, TripScreen } from "@/components/trip/TripScreen";

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
