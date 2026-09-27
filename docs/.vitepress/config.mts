import { defineConfig } from "vitepress"

/** Served from GitHub Pages as a project site. */
const BASE = "/zepp-otp-auth-app/"
const REPO = "https://github.com/remigius42/zepp-otp-auth-app"

/**
 * The porting analysis in reading order. Its files link to their
 * neighbors themselves, so they read in order on GitHub too; the theme's
 * own previous/next footer is switched off for them.
 */
const PORTING_ANALYSIS = [
  ["README", "1–2. Verdict and the current app"],
  ["03-platform-mapping", "3.0–3.8 Target platform mapping"],
  ["03-build-and-hardware-findings", "3.9–3.12 Build and hardware findings"],
  ["04-qr-workaround", "4. The QR code workaround"],
  ["05-effort-estimate", "5. Effort estimate"],
  ["06-tooling", "6. Tooling assessment"],
  ["07-market", "7. Market landscape"],
  ["08-reach-and-maintenance", "8. Reach and maintenance cost"],
  ["09-risks", "9. Risks and unknowns"],
  ["10-phasing", "10. Suggested phasing"],
  ["11-decisions", "11. Decisions and remaining questions"],
  ["sources", "Sources"]
]

const DECISION_RECORDS = [
  ["0001-local-file-enrollment-no-hosted-scanner", "0001 Enrollment"],
  ["0002-zml-transport-and-single-token-message", "0002 Sync transport"],
  ["0003-no-phone-side-connection-status", "0003 Connection status"],
  ["0004-no-on-watch-token-storage-initially", "0004 Token storage"],
  ["0005-progress-arc-as-prerendered-image-frames", "0005 Progress arc"],
  ["0006-typescript-via-precompile-step", "0006 TypeScript"],
  ["0007-no-bigint-on-the-watch", "0007 No BigInt"]
]

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "OTP Auth for Zepp OS",
  description:
    "Time-based one-time passwords (TOTP) on Amazfit / Zepp OS watches",
  lang: "en-US",
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  // maintainer-only; CONTRIBUTING.md links it on GitHub
  srcExclude: ["RELEASING.md"],
  transformPageData(pageData) {
    if (pageData.relativePath.startsWith("porting-analysis/")) {
      pageData.frontmatter.prev = false
      pageData.frontmatter.next = false
    }
  },
  themeConfig: {
    nav: [
      { text: "Manual", link: "/manual/README" },
      { text: "Decisions", link: "/adr/README" },
      { text: "Porting analysis", link: "/porting-analysis/README" }
    ],
    sidebar: [
      {
        text: "Manual",
        items: [
          { text: "English", link: "/manual/README" },
          { text: "Deutsch", link: "/manual/de" }
        ]
      },
      {
        text: "Decisions",
        items: [
          { text: "Index", link: "/adr/README" },
          ...DECISION_RECORDS.map(([file, text]) => ({
            text,
            link: `/adr/${file}`
          }))
        ]
      },
      {
        text: "Porting analysis",
        collapsed: true,
        items: PORTING_ANALYSIS.map(([file, text]) => ({
          text,
          link: `/porting-analysis/${file}`
        }))
      }
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`
    },
    search: { provider: "local" }
  }
})
