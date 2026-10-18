import { ForgetMissingTrip } from "@/components/trip/ForgetMissingTrip";
import { TripNotFound } from "@/components/trip/TripNotFound";

/**
 * Rendered when the server side calls `notFound()` for a missing trip (spec
 * 7.5, 7.6). The trip screen never mounts, so this page drops the trip from
 * recent trips itself (spec 7.2).
 */
export default function TripNotFoundPage() {
  return (
    <>
      <ForgetMissingTrip />
      <TripNotFound />
    </>
  );
}
