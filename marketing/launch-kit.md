# Launch kit — 3GS UI

Everything here is ready to paste. Nothing is posted automatically; you post, you own the accounts.

**Links** · site https://design-system-3gs.vercel.app · repo https://github.com/TimonBozzApps/design-system-3gs · npm https://www.npmjs.com/package/@3gs/ui
**Assets** · `marketing/assets/` (demo GIFs + stills)
**Dashboard** · https://eu.posthog.com/project/261942/dashboard/969655

---

## The positioning

One line, used everywhere:

> **A React component library that recreates the iPhone 3GS UI — and re-renders any website in it.**

Two hooks, and they serve different audiences:
- **The toy** (paste a URL → your site as a 2009 iPhone app) is what gets shared. Lead with it on social.
- **The library** (23 components, tokens, two themes, RTL, i18n) is what earns respect and installs. Lead with it on r/reactjs and in newsletters.

Do not oversell it as production-ready for serious apps. It's a craft piece that happens to be genuinely well built — say exactly that, and people will respect it. The honesty *is* the pitch.

---

## 1. Hacker News — "Show HN"

Post Tue–Thu, **09:00–11:00 CET** (that's early-morning US East, when the front page turns over). One submission only; don't repost if it flops — try again in a few weeks with a different angle.

**Title** (80 char limit, no hype words, no emoji):

```
Show HN: A React design system that recreates the iPhone 3GS UI
```

Alternatives if you'd rather lead with the toy:
```
Show HN: Paste a URL, see your site as a 2009 iPhone app
Show HN: I rebuilt the iOS 3 glossy UI as a React component library
```

**URL**: `https://design-system-3gs.vercel.app`

**First comment** (post immediately after submitting — this is what people actually read):

```
I missed the gel gradients, so I rebuilt the iPhone 3GS / iOS 3 interface as a
proper React component library: 23 components (nav bar, tab bar, grouped tables,
the ON/OFF switch, the spinning picker, the keyboard, HUDs, action sheets),
CSS custom properties for every gradient and rim, a dark theme and the original
blue-grey light theme, RTL, and a provider for localised strings.

The part that surprised me is on the docs site: paste any URL and it re-renders
that site as a 2009 iPhone app. It fetches the page server-side, pulls out the
title, icons, nav links, headings, body copy, prices, FAQ entries and forms, and
maps them onto the components — so you get a navigable app, not a screenshot.
Tabs and rows open real pages, search runs the site's own search (Hacker News
goes through Algolia), and forms are editable. /p/<site> gives you a standalone
phone you can share: https://design-system-3gs.vercel.app/p/news.ycombinator.com

Technical bits I'd call out:
- The "gel" is one recipe: a vertical gradient with a hard highlight split at
  50%, a 1px black outline, a light inner rim, and text with an inverted shadow.
  Everything else is that recipe with different tokens.
- Theming is only token redefinition — the light theme is one file of overrides.
  Components read semantic tokens (--gs-gradient-neutral, --gs-text-on-bar), so
  parts that were always black on the device (the tab bar) stay black.
- The preview fetcher re-resolves DNS on every redirect hop and refuses private,
  link-local and metadata addresses, caps the read, and rate-limits per IP.
- Icons are lucide, tinted through an SVG gradient so they get the same glass.

Limits, honestly: sites that render their content client-side come back thin,
some hosts block the fetcher outright, and the whole thing is a caricature, not
a port. MIT, npm i @3gs/ui.
```

**While it's live**: answer every comment for the first 3 hours. Don't argue; "fair, that's a real limitation" is a fine answer. Upvote nothing from alt accounts, don't ask for votes anywhere — HN detects it and it's the one thing that will actually kill the post.

**Prepared answers** to the questions you'll definitely get:

- *"Why?"* — "Because it looked good and I wanted to see if the recipe still holds up. It does."
- *"Is this production-ready?"* — "For a toy, a portfolio site or a retro project, yes. For your SaaS dashboard, obviously not — that's the joke."
- *"How big is it?"* — "22 kB of JS and 27 kB of CSS gzipped, one dependency (lucide-react)."
- *"Does it work with Tailwind / RSC / Next?"* — "It's plain CSS with custom properties and client components; it drops into any React 18/19 app. The components are interactive, so they need `'use client'` in RSC apps."
- *"Accessibility?"* — "Native elements where possible, roles and aria where not, keyboard operable, visible focus. The skeuomorphism is decoration on top of ordinary controls."
- *"Did an AI write this?"* — Answer honestly. "Yes, most of it, with me directing and reviewing — the architecture decisions, the token layer and the taste calls are mine." People respect the straight answer far more than a dodge, and lying about it is how launches implode.

---

## 2. Reddit

Different text per sub; Reddit punishes copy-paste across subs. Space them a day apart. Read each sub's rules first — several ban link posts from new accounts.

**r/reactjs** — *"Show & Tell" flair.* The library angle.
```
Title: I recreated the iPhone 3GS (iOS 3) UI as a React component library

23 components — nav bar, tab bar, grouped tables, the ON/OFF switch, the
spinning picker, the on-screen keyboard, HUDs, action sheets, a date picker —
all built on one "gel" recipe: a vertical gradient with a hard highlight split
at 50%, a 1px black outline and a light inner rim.

Everything is CSS custom properties, so theming is just redefining tokens: dark
by default, and `data-theme="light"` gives you the original blue-grey iOS 3
chrome. RTL works through logical properties, strings come from a provider, and
the docs site generates its prop tables from the TypeScript types.

Demo (paste a URL and it rebuilds that site in the style):
https://design-system-3gs.vercel.app
npm i @3gs/ui · MIT · https://github.com/TimonBozzApps/design-system-3gs
```

**r/webdev** — the tool angle, with the technical write-up.
```
Title: I built a thing that re-renders any website as a 2009 iPhone app

Paste a URL and it fetches the page, extracts the structure — title, icons, nav,
headings, body copy, prices, FAQs, forms — and maps it onto a React component
library I wrote that recreates the iPhone 3GS interface. You get a navigable
app: tabs open real pages, search runs the site's own search, forms are editable.

https://design-system-3gs.vercel.app/p/news.ycombinator.com (Hacker News, as an
iOS 3 news app)

The fetcher was the interesting part: DNS re-resolved on every redirect hop,
private/link-local/metadata addresses refused, read cap with truncation instead
of failure, per-IP rate limiting. And feed detection — finding the repeated item
pattern on a page structurally, so HN's table layout and a blog index both work.
```

**r/InternetIsBeautiful** — the toy only, no library talk, no self-promo tone.
```
Title: Paste any URL and see it rebuilt as a 2009 iPhone app
https://design-system-3gs.vercel.app
```

**Also worth a post**: r/skeuomorphism, r/nostalgia (frame it as "the iPhone 3GS interface, working, in your browser"), r/SideProject, r/opensource.

---

## 3. X / Bluesky thread

Lead with the GIF. The first post must work with the video alone.

```
1/ I rebuilt the iPhone 3GS interface as a React component library.

Then I made it do this: paste any URL, and your site comes back as a 2009
iPhone app.

design-system-3gs.vercel.app
[demo-3gsify.gif]

2/ 23 components — nav bars, the grouped tables, the ON/OFF switch, the spinning
picker, the keyboard with the key popup, HUDs, action sheets.

All from one recipe: a vertical gradient with a hard highlight split at 50%, a
1px black outline, a light inner rim, and text with an inverted shadow.
[still-themes.png]

3/ It's not a screenshot — it's navigable. Tabs open real pages, rows push new
screens with a Back button, search runs the site's own search (HN goes through
Algolia), forms are editable.
[demo-hn.gif]

4/ Two themes, and theming is only token redefinition: the light theme is one
file of CSS custom property overrides. The parts that were always black on the
device — the tab bar — stay black.
[still-tokens.png]

5/ MIT, npm i @3gs/ui, 22 kB gzipped, one dependency (lucide).

Share a phone of your own site: design-system-3gs.vercel.app/p/<your-site>
```

Bluesky: same thread, 300 chars per post — trim each to its first two sentences.

---

## 4. LinkedIn

Different register — the craft and the method, not the joke.

```
I spent a week rebuilding an interface that was retired in 2013.

The iPhone 3GS UI — glossy gel buttons, embossed type, the black glass tab bar —
is now a React component library: 23 components, design tokens, two themes, RTL
and localisation. MIT licensed.

The docs site does something I haven't seen before: paste any URL and it
re-renders that website as a 2009 iPhone app — navigable, with the site's own
content, search and forms.

Two things I took from it. First, skeuomorphism was a system, not decoration:
one gradient recipe with a hard highlight split explains almost every control on
that device. Second, an interface you can paste your own site into gets shared;
a component gallery does not.

design-system-3gs.vercel.app
```

---

## 5. Product Hunt

Launch 00:01 PT on a Tue/Wed/Thu. Have the GIF as the first gallery item.

- **Name**: 3GS UI
- **Tagline** (60 chars): `The iPhone 3GS UI, as a React library — and a toy`
- **Description**: "23 React components that recreate the iPhone 3GS / iOS 3 glossy interface — nav bars, grouped tables, the ON/OFF switch, the spinning picker, the keyboard. Two themes, design tokens, RTL, MIT. Plus: paste any URL and see that site rebuilt as a 2009 iPhone app, navigable and shareable."
- **First comment**: reuse the HN first comment, trimmed to the first two paragraphs.
- **Topics**: Design Tools, Developer Tools, User Experience

---

## 6. Newsletters & directories (submit, then forget)

Short, factual, one link. Submit Thu–Fri for the following week's issue.

```
Subject: 3GS UI — the iPhone 3GS interface as a React component library

Hi — I built 3GS UI: 23 React components recreating the iPhone 3GS / iOS 3
glossy skeuomorphic interface, with design tokens, a dark and the original light
theme, RTL and localisation. MIT, 22 kB gzipped.

The docs site also re-renders any website you paste into it as a 2009 iPhone app:
https://design-system-3gs.vercel.app

Repo: https://github.com/TimonBozzApps/design-system-3gs
```

Send to: **React Status** and **JavaScript Weekly** (cooperpress.com, "suggest a link"), **Bytes** (bytes.dev), **Frontend Focus**, **TLDR Web Dev**, **Console** (console.dev/submit), **Awesome React** (PR to the list), **lucide showcase** (they list projects built on their icons — you qualify), **Godly / Siteinspire / Awwwards** for the docs site itself.

---

## 6b. The "how it's built" comment

Posted on the r/reactjs thread 2026-09-23 to give the post something to chew on. Reusable on any
thread that goes quiet — it works because it hands over the actual recipe instead of describing it.

The three beats: (1) the gel is four CSS layers with a hard stop at 50 %, quoted verbatim so people can
paste it; (2) theming is only token redefinition, with the trap called out (don't remap raw tokens or the
always-black parts flip); (3) the preview's structural feed detection and the SSRF guard. Then the limits,
stated plainly. Full text in the shell history / the Reddit thread.

---

## 7. Day-of checklist

- [ ] Reread the README top section — it's the second thing people open
- [ ] Have the repo's About + topics filled in (`react`, `design-system`, `skeuomorphism`, `ios`, `retro`)
- [ ] Post to HN, then immediately add the first comment
- [ ] Tweet the thread ~30 min later, linking the HN post in the last reply
- [ ] Watch the PostHog dashboard: **Where visitors come from** (is HN converting?), **Preview funnel** (do they try the toy?), **Sites people preview** (screenshot the good ones — that's your follow-up content), **Preview successes vs failures** and **Errors on the site** (does anything break under load?)
- [ ] Watch Vercel function logs for rate limiting or timeouts: `npx vercel logs <deployment-url>`
- [ ] Reddit the next day, LinkedIn the day after, newsletters at the end of the week

**If it takes off**: the follow-up post writes itself — "the 50 sites people 3GS-ified" with the best screenshots. Pull them from the *Sites people preview* tile.

**If it flops**: it is almost always the title, not the work. Wait three weeks, lead with the toy instead of the library, and post the GIF standalone on X first to see which framing gets traction.
