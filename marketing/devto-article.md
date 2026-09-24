---
title: I rebuilt the iPhone 3GS UI as a React library — here is the CSS recipe
published: false
description: The iOS 3 "gel" look is one gradient recipe with a hard highlight split at 50%. Here is how it works, how tokens make it themeable, and how I ended up re-rendering arbitrary websites with it.
tags: react, css, webdev, design
cover_image: https://design-system-3gs.vercel.app/og.png
---

Skeuomorphism gets remembered as a pile of drop shadows and leather textures. It wasn't. The iOS 3
interface was a **system**: one gradient recipe, applied consistently, with tokens for the bits that
varied. I rebuilt it as a React component library to find out how much of it was method rather than
taste, and it turned out to be almost all method.

Here's the part you can steal in thirty seconds, then the architecture, then the strange place it
ended up.

## The gel is four layers

Every control on that device — buttons, the nav bar, the ON/OFF switch, the tab bar — is the same
four things with different colours:

```css
.button {
  /* 1. the shine, as a separate layer so any body colour can wear it */
  background:
    linear-gradient(to bottom,
      rgba(255,255,255,.30) 0%,
      rgba(255,255,255,.12) 50%,
      rgba(255,255,255,0)  50.5%,   /* ← the hard stop. this is the whole trick */
      rgba(255,255,255,0)  100%),
  /* 2. the body, split at the same point */
    linear-gradient(to bottom, #8fb8f5 0%, #4d8ae4 49%, #2a6bd2 50%, #1d55b5 100%);

  /* 3. a hard outline and a light inner rim */
  border: 1px solid rgba(0,0,0,.9);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22),  /* inner top rim: the lit edge */
    0 1px 0 rgba(0,0,0,.75);              /* drop edge: it sits on something */

  /* 4. type stamped into the surface, not floating above it */
  text-shadow: 0 -1px 0 rgba(0,0,0,.7);
}
```

The hard stop at 50% is what your eye reads as *glass*. Make it a smooth gradient and you get 2014
flat design with a shadow on it; keep the discontinuity and the surface looks wet. The inverted
text-shadow matters just as much: light comes from above, so text is debossed with a dark shadow
*upward*, never a dark shadow downward.

Pressed state is the same recipe minus the shine, plus an inset:

```css
.button:active {
  background: linear-gradient(to bottom, #17427f 0%, #1f56a8 50%, #2b66bf 100%);
  box-shadow: inset 0 2px 4px rgba(0,0,0,.6);
}
```

That's it. Every screenshot from 2009 you've ever squinted at is that, in different colours.

## Tokens are what make it a system

If each component hard-codes those gradients you have a costume, not a design system. So every value
lives in a CSS custom property, and components compose them:

```css
.gs-button {
  --gs-button-gel: var(--gs-gradient-neutral);
  --gs-button-gel-pressed: var(--gs-gradient-neutral-pressed);
  --gs-button-text: var(--gs-text-on-neutral);
  --gs-button-text-shadow: var(--gs-text-shadow-on-neutral);

  background: var(--gs-gloss), var(--gs-button-gel);
  border: var(--gs-border);
  box-shadow: var(--gs-emboss);
  color: var(--gs-button-text);
  text-shadow: var(--gs-button-text-shadow);
}
```

The payoff shows up when you add the second theme. iOS 3 had two chromes — the black glass one and
the original blue-grey — and the light theme here is **one file of token overrides**:

```css
.gs-root[data-theme="light"] {
  --gs-gradient-bar: linear-gradient(to bottom,
    #b0bccd 0%, #8a9bb4 49%, #6d84a2 50%, #5b7397 100%);
  --gs-bar-border: #2d3642;
  --gs-bar-rim: rgba(255,255,255,.45);
  --gs-text-emboss: 0 1px 0 rgba(255,255,255,.75);  /* light theme: shadow flips down */
  /* …36 more */
}
```

### The mistake worth avoiding

My first attempt remapped the *raw* tokens: in light mode, `--gs-gradient-dark` became a light
gradient. Everything went pale — including the tab bar, which was black on the real device in both
appearances, and the app icon tiles, which were always saturated.

The fix is a **semantic layer**. Raw tokens keep their literal meaning forever (`--gs-gradient-dark`
is *dark*, in every theme). Components read intent-named tokens instead:

- `--gs-gradient-neutral` — "the default control surface"
- `--gs-gradient-barbutton` — "a button sitting inside a bar"
- `--gs-text-on-bar`, `--gs-text-emboss` — "text on that surface"

Themes redefine the semantic tokens. Anything that must stay constant simply doesn't use them. A
third theme is now one more file, and components never change.

## The components that were actually hard

**The switch** is not a toggle with a knob. It's a 200%-wide strip holding both halves — blue "ON"
and grey "OFF" — sliding under a fixed silver knob, with `overflow: hidden` on the track. That's how
the original works, and it's why the label appears to be *pushed out* rather than faded.

**The picker** — the spinning wheel — is `scroll-snap-type: y mandatory` with 44px rows, spacer
elements top and bottom so the first and last items can reach the centre, and two absolutely
positioned shading overlays to fake the cylinder. The fiddly part is that selection and scroll
position drive each other: committing a value scrolls the drum, and scrolling commits a value. That
needs a guard — a ~150ms window after a programmatic scroll where scroll events are ignored — or you
get an infinite feedback loop.

**The keyboard** has three layers, shift-with-caps-lock, delete auto-repeat, and the enlarged key
popup. The non-obvious bit: every key must `preventDefault()` on pointerdown, or tapping it blurs
whatever field you were typing into.

## Where it went sideways: rendering other people's websites

A component gallery is a boring way to show a design system. So the docs site got a text field: paste
a URL, and it rebuilds *that site* as a 2009 iPhone app.

A Vercel function fetches the page and extracts structure — title, icons, nav links, headings, body
copy, prices, FAQ pairs, forms — then maps it onto a `ScreenSpec` the client renders with the
components. It's navigable: tabs open real pages, rows push screens with a Back button, search runs
the site's own search (Hacker News goes through Algolia), and forms are editable.

Two problems were interesting.

**Feed pages.** Hacker News is a table layout from 2007 with no `<article>` anywhere, and my
prose-oriented extractor returned nothing. The fix is structural rather than site-specific: group
every candidate link by a *signature* of its own tag plus three ancestors — ignoring generated class
names like `css-1x2y3z` — and take the dominant repeated pattern. HN's `A < SPAN.titleline <
TD.title < TR.athing` and a modern blog's `A < H2 < ARTICLE` both fall out of the same rule, so HN,
Lobsters, GitHub Trending and changelogs all come out as news apps.

**"Paste any URL" is an SSRF machine.** The fetcher re-resolves DNS on *every* redirect hop and
refuses loopback, private, link-local (including `169.254.169.254`, the cloud metadata endpoint),
CGNAT and IPv4-mapped forms of all of those. Plus a read cap that truncates rather than fails, an
8-second timeout, and per-IP rate limiting. If you build anything that fetches user-supplied URLs,
validate after every redirect, not just once — that's the hole most implementations leave open.

## Honest limits

Client-rendered pages come back thin: there's nothing in the HTML to read. Some hosts block the
fetcher outright. And the whole thing is a caricature — nobody should ship a SaaS dashboard in 2009
gel. It's ~22kB of JS and 27kB of CSS gzipped, one dependency (lucide for icons), MIT.

- Try it on your own site: **[design-system-3gs.vercel.app](https://design-system-3gs.vercel.app)**
- Hacker News as a 2009 news app: **[/p/news.ycombinator.com](https://design-system-3gs.vercel.app/p/news.ycombinator.com)**
- Source: **[github.com/TimonBozzApps/design-system-3gs](https://github.com/TimonBozzApps/design-system-3gs)**
- `npm i @3gs/ui`

If you take one thing: the hard stop at 50%. Add it to any gradient you have lying around and watch
it turn into glass.
