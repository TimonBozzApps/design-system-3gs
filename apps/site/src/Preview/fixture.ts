import type { ScreenSpec } from "../../../../api/_lib/spec";

/** Inline SVG → `data:` URI (same shape the server sends for favicons and OG images). */
const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

// A stand-in "touch icon": black tile, white triangle.
const ICON = svgUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#000"/>
    <path d="M32 16 52 50H12z" fill="#fff"/>
  </svg>
`);

// A stand-in OG image, 2:1 like the real one: dark gradient, wordmark, deploy line.
const HERO = svgUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1c1c1f"/><stop offset="1" stop-color="#050506"/>
      </linearGradient>
    </defs>
    <rect width="600" height="300" fill="url(#g)"/>
    <path d="M78 96 118 166H38z" fill="#fff"/>
    <text x="140" y="164" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#fff" letter-spacing="-3">Vercel</text>
    <text x="40" y="238" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="24" fill="#8b8b92">Develop. Preview. Ship.</text>
  </svg>
`);

/**
 * What the generator produces for vercel.com's front page — the screen shown
 * before the visitor submits anything, in the server's shape: hero row, content
 * sections, link groups, gel buttons, and tabs that open real vercel.com pages.
 */
export const FIXTURE: ScreenSpec = {
  url: "https://vercel.com/",
  host: "vercel.com",
  title: "Vercel",
  siteName: "Vercel",
  description: "Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration.",
  iconDataUri: ICON,
  imageDataUri: HERO,
  themeColor: "#000000",
  tabs: [
    { label: "Home", icon: "home" },
    { label: "Products", icon: "layout-grid", href: "https://vercel.com/products" },
    { label: "Docs", icon: "book", href: "https://vercel.com/docs" },
    { label: "Blog", icon: "newspaper", badge: 3, href: "https://vercel.com/blog" },
    { label: "Account", icon: "log-in", href: "https://vercel.com/login" },
  ],
  sections: [
    {
      heading: "Build and deploy on the AI Cloud",
      text: "Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster, more personalized web.",
    },
    {
      heading: "Git-connected deploys",
      text: "From localhost to https, in seconds. Deploy from git or your CLI — every push gets a preview URL.",
      href: "https://vercel.com/docs/deployments",
    },
    {
      heading: "Collaborative pre-production",
      text: "Every deploy is remarkable. Chat with your team on real, production-grade UI, not just designs.",
      href: "https://vercel.com/docs/comments",
    },
    {
      heading: "Scale your enterprise without compromising security",
      text: "Turbocharge your teams with a platform built for the unique needs of the enterprise.",
      href: "https://vercel.com/enterprise",
    },
  ],
  groups: [
    {
      header: "Vercel",
      rows: [
        {
          title: "Vercel: Build and deploy the best web experiences",
          subtitle: "Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration.",
          href: "https://vercel.com/",
          imageDataUri: HERO,
          tile: "blue",
          accessory: "chevron",
        },
      ],
    },
    {
      header: "Products",
      rows: [
        { title: "AI SDK", subtitle: "The AI Toolkit for TypeScript", icon: "zap", tile: "blue", accessory: "chevron", href: "https://vercel.com/ai" },
        { title: "Next.js", subtitle: "The native Next.js platform", icon: "code", tile: "gray", accessory: "chevron", href: "https://vercel.com/frameworks/nextjs" },
        { title: "v0", subtitle: "Build apps with natural language", icon: "rocket", tile: "red", accessory: "chevron", href: "https://v0.dev" },
        { title: "Observability", subtitle: "Trace every request", icon: "search", tile: "green", accessory: "chevron", href: "https://vercel.com/products/observability" },
      ],
    },
    {
      header: "Resources",
      rows: [
        { title: "Documentation", icon: "book", tile: "gray", accessory: "chevron", href: "https://vercel.com/docs" },
        { title: "Templates", detail: "200+", icon: "layout-grid", tile: "gray", accessory: "chevron", href: "https://vercel.com/templates" },
        { title: "Changelog", detail: "Today", icon: "clock", tile: "gray", accessory: "chevron", href: "https://vercel.com/changelog" },
        { title: "Customers", icon: "users", tile: "gray", accessory: "chevron", href: "https://vercel.com/customers" },
      ],
      footer: "Ship faster with the Frontend Cloud.",
    },
    {
      header: "Company",
      rows: [
        { title: "Pricing", icon: "credit-card", tile: "gray", accessory: "chevron", href: "https://vercel.com/pricing" },
        { title: "Enterprise", icon: "briefcase", tile: "gray", accessory: "chevron", href: "https://vercel.com/enterprise" },
        { title: "Contact Sales", icon: "phone", tile: "gray", accessory: "detail", href: "https://vercel.com/contact/sales" },
      ],
    },
  ],
  actions: [
    { label: "Start Deploying", variant: "primary", href: "https://vercel.com/new" },
    { label: "Get a Demo", variant: "default", href: "https://vercel.com/contact/sales" },
  ],
  search: { placeholder: "Search docs and templates", scopes: ["Docs", "Templates", "Blog"] },
  notes: ["Sample — paste a URL above to generate a real one."],
  generator: "heuristic",
  generatedAt: "2026-09-21T09:41:00.000Z",
};
