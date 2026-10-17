import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Block on generateMetadata for every user agent, not only Next's bot list
  // (KakaoTalk's scraper is not on it by name): link-preview tags land in
  // <head>, and TRIP_NOT_FOUND answers HTTP 404 instead of a streamed 200.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
