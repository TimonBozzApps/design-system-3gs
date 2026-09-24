---
title: I rebuilt the iPhone 3GS UI as a React library, and here is the CSS recipe
published: false
description: The iOS 3 gel look is one gradient recipe with a hard highlight split at 50 percent. How it works, how tokens make it themeable, and how it ended up re-rendering arbitrary websites.
tags: react, css, webdev, design
cover_image: https://design-system-3gs.vercel.app/og.png
---

I wanted to know how much of the old iOS look was actual method and how much was just taste. So I
rebuilt it: 23 React components in the iPhone 3GS style, from the nav bar down to the on-screen
keyboard.

Turns out it is almost entirely method. One gradient recipe explains nearly every control on that
device. Here it is, then the parts that took me longer than expected.

## The gel is four layers

Buttons, the nav bar, the ON/OFF switch, the tab bar. All the same four things, different colours:

```css
.button {
  /* 1. the shine, kept as its own layer so any body colour can wear it */
  background:
    linear-gradient(to bottom,
      rgba(255,255,255,.30) 0%,
      rgba(255,255,255,.12) 50%,
      rgba(255,255,255,0)  50.5%,   /* the hard stop, this is what matters */
      rgba(255,255,255,0)  100%),
  /* 2. the body, split at the same point */
    linear-gradient(to bottom, #8fb8f5 0%, #4d8ae4 49%, #2a6bd2 50%, #1d55b5 100%);

  /* 3. hard outline plus a light inner rim */
  border: 1px solid rgba(0,0,0,.9);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22),  /* the lit top edge */
    0 1px 0 rgba(0,0,0,.75);              /* it sits on something */

  /* 4. type stamped into the surface, not floating above it */
  text-shadow: 0 -1px 0 rgba(0,0,0,.7);
}
```

The discontinuity at 50 percent is what your eye reads as glass. Smooth that gradient out and you get
flat design with a shadow on it. Keep the hard edge and the surface looks wet.

The text shadow is the other half. Light comes from above, so the label is debossed with a dark
shadow pointing up, never down. I had this backwards for an hour and could not work out why
everything looked slightly wrong.

Pressed state is the same thing without the shine, plus an inset:

```css
.button:active {
  background: linear-gradient(to bottom, #17427f 0%, #1f56a8 50%, #2b66bf 100%);
  box-shadow: inset 0 2px 4px rgba(0,0,0,.6);
}
```

## Tokens turn a costume into a system

If every component hard-codes those gradients, you have a costume. So each value is a CSS custom
property and components just compose them:

```css
.gs-button {
  --gs-button-gel: var(--gs-gradient-neutral);
  --gs-button-text: var(--gs-text-on-neutral);

  background: var(--gs-gloss), var(--gs-button-gel);
  border: var(--gs-border);
  box-shadow: var(--gs-emboss);
  color: var(--gs-button-text);
  text-shadow: var(--gs-text-shadow-on-neutral);
}
```

That pays off with the second theme. iOS 3 had two chromes, the black glass one and the original
blue-grey, and the light theme here is one file of token overrides:

```css
.gs-root[data-theme="light"] {
  --gs-gradient-bar: linear-gradient(to bottom,
    #b0bccd 0%, #8a9bb4 49%, #6d84a2 50%, #5b7397 100%);
  --gs-bar-border: #2d3642;
  --gs-bar-rim: rgba(255,255,255,.45);
  --gs-text-emboss: 0 1px 0 rgba(255,255,255,.75);  /* shadow flips downward */
  /* about 36 more */
}
```

### The mistake

My first attempt remapped the raw tokens. In light mode `--gs-gradient-dark` became a light gradient.
Everything went pale, including things that were black on the real device in both appearances: the
tab bar, and the saturated app icon tiles in list rows.

The fix was a semantic layer. Raw tokens keep their literal meaning in every theme, so
`--gs-gradient-dark` is always dark. Components read intent instead:

* `--gs-gradient-neutral` for a default control surface
* `--gs-gradient-barbutton` for a button inside a bar
* `--gs-text-on-bar` and `--gs-text-emboss` for text on those surfaces

Themes only redefine the semantic ones. Anything that has to stay constant simply does not use them.
Adding a third theme is now one file, and no component changes.

## The components that were actually hard

The switch is not a toggle with a knob on top. It is a strip twice the track width, holding the blue
ON half and the grey OFF half, sliding underneath a fixed silver knob with `overflow: hidden` on the
track. That is how the original behaves, and it is why the label looks pushed out of view rather than
faded out.

The picker, meaning the spinning wheel, is `scroll-snap-type: y mandatory` with 44px rows, spacer
elements at both ends so the first and last option can reach the centre, and two absolutely
positioned shading overlays to fake the cylinder. The annoying part is that selection and scroll
position drive each other. Committing a value scrolls the drum, and scrolling commits a value. You
need a guard, in my case a 150ms window after a programmatic scroll where scroll events are ignored,
or it loops forever.

The keyboard has three layers, shift with caps lock, delete auto-repeat and the enlarged key popup.
The non-obvious bit: every key has to call `preventDefault()` on pointerdown, otherwise tapping it
blurs the field you are typing into.

## Then it got out of hand

A component gallery is a dull way to show a design system, so the docs site got a text field. Paste a
URL and it rebuilds that site as a 2009 iPhone app.

A serverless function fetches the page and pulls out structure: title, icons, nav links, headings,
body copy, prices, FAQ pairs, forms. That gets mapped to a spec object which the client renders with
the components. The result is navigable rather than a screenshot. Tabs open real pages, rows push
screens with a back button, search runs the site's own search, and forms are editable.

Two things were harder than I expected.

**Feed pages.** Hacker News is a table layout from 2007 with no `article` element anywhere, and my
prose-oriented extractor found nothing at all. Special-casing it would have been useless, so the
detection is structural: group every candidate link by a signature made of its own tag plus three
ancestors, ignore generated class names like `css-1x2y3z`, then take the dominant repeated pattern.
HN's `A < SPAN.titleline < TD.title < TR.athing` and a modern blog's `A < H2 < ARTICLE` both fall out
of the same rule. Lobsters, GitHub Trending and changelogs came along for free.

**Accepting arbitrary URLs is an SSRF machine.** The fetcher re-resolves DNS on every redirect hop
and refuses loopback, private ranges, link-local including `169.254.169.254`, CGNAT, and the
IPv4-mapped IPv6 versions of all of those. Then a read cap that truncates instead of failing, an
8 second timeout, and rate limiting per IP. If you ever build something that fetches a user-supplied
URL, validate after each redirect rather than once at the start. That is the hole most
implementations leave open.

## What it does not do

Client-rendered pages come back thin, because there is nothing in the HTML to read. Some hosts block
the fetcher. And it is a caricature, not a port, so please do not ship your SaaS dashboard in 2009
gel.

It is about 22kB of JS and 27kB of CSS gzipped, one dependency (lucide, for icons), MIT licensed.

* Try it on your own site: [design-system-3gs.vercel.app](https://design-system-3gs.vercel.app)
* Hacker News as a 2009 news app: [/p/news.ycombinator.com](https://design-system-3gs.vercel.app/p/news.ycombinator.com)
* Source: [github.com/TimonBozzApps/design-system-3gs](https://github.com/TimonBozzApps/design-system-3gs)
* `npm i @3gs/ui`
