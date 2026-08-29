/**
 * Canonical site config for NOX // NEON VOID
 * Single source for URLs, names and link metadata.
 * Change SITE to your deployed domain. Vercel injects VERCEL_URL automatically.
 * Do not add em dashes here.
 */

export const SITE = {
  name: "NOX // NEON VOID",
  shortName: "NOX",
  titleDefault: "NOX // NEON VOID - Two players. One void.",
  description:
    "A chaotic local multiplayer arena where the floor is lava and the last one standing wins. Same keyboard, 60 seconds, first to 5.",
  // Canonical base. Prefer explicit env, then Vercel URL, then fallback.
  url: (
    typeof process !== "undefined" && process.env.PUBLIC_SITE_URL
      ? process.env.PUBLIC_SITE_URL
      : typeof process !== "undefined" && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://nox-void.vercel.app"
  ).replace(/\/$/, ""),
  author: "NOX",
  locale: "en_US",
  themeColor: "#07090b",
  twitterHandle: "",
  ogImage: "/og.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const

export type SiteConfig = typeof SITE

/**
 * Internal link map. All primary routes. Keep in sync with src/pages.
 * Used for sitemap, breadcrumbs and docs.
 */
export const SITE_LINKS = {
  home: "/",
  play: "/play",
  play1v1: "/play/1v1",
  docs: "/docs",
  mockup: "/mockup",
} as const

export const NAV_LINKS = [
  { href: SITE_LINKS.home, label: "HOME" },
  { href: SITE_LINKS.play, label: "PLAY" },
  { href: SITE_LINKS.docs, label: "DOCS" },
] as const
