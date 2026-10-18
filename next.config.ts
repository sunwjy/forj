import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Block on generateMetadata for every user agent, not only Next's bot list
  // (KakaoTalk's scraper is not on it by name): link-preview tags land in
  // <head>, and TRIP_NOT_FOUND answers HTTP 404 instead of a streamed 200.
  // Required for that 404 (spec 7.5): without it `notFound()` in
  // generateMetadata streams into a 200. Side effect: `next dev` logs a
  // "did not produce a static shell" invariant for /t/[token]; it is dev-only
  // and harmless, and `next build` still prerenders the shell.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
