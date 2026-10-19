import type { RpcClient } from "@/lib/rpc";
import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import type { ShareToken } from "./branded";
import { fetchTrip } from "./fetch-trip";
import { periodLabel } from "./format";

/**
 * The messenger link preview for `/t/<token>` (spec 7.5): the trip's title and
 * period, read through `get_trip` with the publishable key. `"not_found"` means
 * the page should answer 404. Any other failure gives `{}` so the root layout's
 * generic preview applies and the page still renders; the browser retries.
 */
export async function tripMetadata(
  token: ShareToken,
  client: RpcClient = getSupabase(),
): Promise<Metadata | "not_found"> {
  let result;
  try {
    result = await fetchTrip(token, client);
  } catch {
    return {};
  }
  if (result.status === "not_found") return "not_found";

  const { title, startDate, endDate } = result.trip;
  const description = periodLabel(startDate, endDate);
  return { title, description, openGraph: { title, description } };
}
