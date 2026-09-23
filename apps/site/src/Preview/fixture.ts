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

// A stand-in in-page screenshot for an `image` block: a preview deployment with a comment pin.
const SHOT = svgUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 300">
    <rect width="580" height="300" fill="#f4f4f6"/>
    <rect width="580" height="46" fill="#ffffff"/>
    <circle cx="26" cy="23" r="6" fill="#ff5f57"/><circle cx="46" cy="23" r="6" fill="#febc2e"/><circle cx="66" cy="23" r="6" fill="#28c840"/>
    <rect x="92" y="13" width="300" height="20" rx="10" fill="#ececf0"/>
    <text x="106" y="28" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13" fill="#8b8b92">acme-git-redesign.vercel.app</text>
    <rect x="28" y="74" width="230" height="22" rx="4" fill="#1c1c1f"/>
    <rect x="28" y="108" width="330" height="12" rx="4" fill="#cfcfd6"/>
    <rect x="28" y="130" width="280" height="12" rx="4" fill="#cfcfd6"/>
    <rect x="28" y="164" width="132" height="34" rx="6" fill="#1c1c1f"/>
    <text x="52" y="186" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="14" fill="#ffffff">Deploy now</text>
    <rect x="360" y="150" width="192" height="104" rx="10" fill="#ffffff" stroke="#dcdce2"/>
    <circle cx="384" cy="174" r="12" fill="#2f74d8"/>
    <text x="378" y="179" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" fill="#ffffff">R</text>
    <rect x="404" y="166" width="90" height="10" rx="5" fill="#1c1c1f"/>
    <rect x="404" y="186" width="126" height="9" rx="4" fill="#d3d3da"/>
    <rect x="404" y="203" width="106" height="9" rx="4" fill="#d3d3da"/>
    <rect x="376" y="224" width="76" height="22" rx="6" fill="#2f74d8"/>
    <text x="392" y="239" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" fill="#ffffff">Resolve</text>
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
  intro: [
    {
      kind: "text",
      text: "Vercel gives developers the frameworks, workflows and infrastructure to build a faster, more personalized web — without managing a single server.",
    },
  ],
  sections: [
    {
      heading: "Build and deploy on the AI Cloud",
      text: "Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster, more personalized web.",
      blocks: [
        {
          kind: "list",
          items: [
            "Deploy straight from a git push — no pipeline to write",
            "Every commit gets its own preview URL",
            "Automatic HTTPS, caching and image optimization",
            "Scales to zero when nobody is visiting",
          ],
        },
        { kind: "stat", value: "300 ms", label: "Median global response", note: "Measured across 100+ edge regions" },
      ],
    },
    {
      heading: "Git-connected deploys",
      text: "From localhost to https, in seconds. Deploy from git or your CLI — every push gets a preview URL.",
      href: "https://vercel.com/docs/deployments",
      blocks: [
        {
          kind: "code",
          text: "$ vercel deploy --prod\n  Inspecting  https://vercel.com/acme/site/7Fk2\n  Production  https://acme.com  [3s]",
        },
        { kind: "link", text: "Read the deployment docs", href: "https://vercel.com/docs/deployments", external: false },
      ],
    },
    {
      heading: "Collaborative pre-production",
      text: "Every deploy is remarkable. Chat with your team on real, production-grade UI, not just designs.",
      href: "https://vercel.com/docs/comments",
      blocks: [
        { kind: "image", dataUri: SHOT, alt: "A preview deployment with an inline review comment" },
        {
          kind: "quote",
          text: "We shipped the redesign in six weeks instead of six months — every pull request was a real URL the whole team could click.",
          source: "Head of Engineering, Sonos",
        },
      ],
    },
    {
      heading: "Scale your enterprise without compromising security",
      text: "Turbocharge your teams with a platform built for the unique needs of the enterprise.",
      href: "https://vercel.com/enterprise",
      blocks: [
        { kind: "stat", value: "$0", label: "Free forever", note: "Hobby projects — no credit card" },
        { kind: "stat", value: "99.99%", label: "Uptime SLA", note: "Enterprise plans" },
        {
          kind: "qa",
          question: "Do I need a credit card to start?",
          answer: "No. The Hobby plan is free forever and includes preview deployments, HTTPS and 100 GB of bandwidth every month.",
        },
        {
          kind: "qa",
          question: "Can I bring my own domain?",
          answer: "Yes — add a domain on any plan. Certificates are issued and renewed for you.",
        },
      ],
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
  // A GET search form: typing here really loads `…/templates?q=<query>`.
  search: {
    placeholder: "Search templates",
    scopes: [
      { label: "Docs", href: "https://vercel.com/docs" },
      { label: "Templates", href: "https://vercel.com/templates" },
      { label: "Blog", href: "https://vercel.com/blog" },
    ],
    action: "https://vercel.com/templates",
    method: "get",
    param: "q",
  },
  // Two forms, one of each kind: the filter really submits (GET + action),
  // the contact form can only be shown (POST).
  forms: [
    {
      title: "Find a template",
      action: "https://vercel.com/templates",
      method: "get",
      submitLabel: "Show templates",
      fields: [
        { kind: "text", name: "q", label: "Search", inputType: "search", placeholder: "blog, commerce, ai…" },
        {
          kind: "choice",
          name: "framework",
          label: "Framework",
          style: "picker",
          value: "next.js",
          options: [
            { label: "Next.js", value: "next.js" },
            { label: "Svelte", value: "svelte" },
            { label: "Nuxt", value: "nuxt" },
            { label: "Astro", value: "astro" },
            { label: "Remix", value: "remix" },
          ],
        },
        {
          kind: "choice",
          name: "type",
          label: "Type",
          style: "segmented",
          value: "site",
          options: [
            { label: "Site", value: "site" },
            { label: "App", value: "app" },
            { label: "API", value: "api" },
          ],
        },
        { kind: "toggle", name: "free", label: "Free only", value: true },
      ],
    },
    {
      title: "Talk to an expert",
      action: "https://vercel.com/contact/sales",
      method: "post",
      submitLabel: "Contact sales",
      fields: [
        { kind: "text", name: "name", label: "Name", inputType: "text", placeholder: "Ada Lovelace", required: true },
        { kind: "text", name: "email", label: "Email", inputType: "email", placeholder: "you@company.com", required: true },
        { kind: "textarea", name: "message", label: "Message", placeholder: "What are you building?" },
      ],
    },
  ],
  notes: ["Sample — paste a URL above to generate a real one."],
  generator: "heuristic",
  generatedAt: "2026-09-21T09:41:00.000Z",
};
