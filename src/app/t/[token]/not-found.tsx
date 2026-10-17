import { TripNotFound } from "@/components/trip/TripNotFound";

/** Rendered when the server side calls `notFound()` for a missing trip (spec 7.5, 7.6). */
export default function TripNotFoundPage() {
  return <TripNotFound />;
}
