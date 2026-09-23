# Newsletter submissions

Researched 2026-09-23. **None of these newsletters has a public submission form any more** — they all take
email (or a DM). So "submitting" means sending these short emails. Keep them factual: curators skim dozens
a day and delete anything that reads like marketing.

**Links to include** · site https://design-system-3gs.vercel.app · repo https://github.com/TimonBozzApps/design-system-3gs · npm https://www.npmjs.com/package/@3gs/ui

---

## 1. Cooperpress → React Status, JavaScript Weekly, Frontend Focus

One email covers all three; they share an editorial desk. This is the highest-value submission on the list
(React Status alone is ~40k subscribers, and a retro component library is exactly their kind of item).

**To:** editor@cooperpress.com
**Subject:** `3GS UI — the iPhone 3GS interface as a React component library`

```
Hi,

I built 3GS UI: 23 React components that recreate the iPhone 3GS / iOS 3 glossy
interface — nav bars, grouped tables, the ON/OFF switch, the spinning picker,
the on-screen keyboard, HUDs, action sheets. Design tokens for every gradient
and rim, a dark theme plus the original blue-grey light theme, RTL, and a
provider for localised strings. MIT, 22 kB gzipped, one dependency (lucide).

The docs site has a toy that might suit Frontend Focus in particular: paste any
URL and it re-renders that website as a 2009 iPhone app — navigable, using the
site's own content, search and forms.

https://design-system-3gs.vercel.app
https://github.com/TimonBozzApps/design-system-3gs

Thanks for considering it — and for 15 years of JavaScript Weekly.

Timon
```

## 2. Console.dev

Weekly devtools newsletter, ~30k subscribers, publishes Thursdays. They review tools, so lead with what it
does rather than how it looks.

**To:** hello@console.dev
**Subject:** `Tool submission: 3GS UI (React components + a website-to-2009-iPhone renderer)`

```
Hi,

Submitting 3GS UI for consideration.

It's two things: a React component library that recreates the iPhone 3GS / iOS 3
interface (23 components, design tokens, two themes, RTL, i18n, MIT), and a tool
on its docs site that re-renders any website you paste into it as a 2009 iPhone
app — fetching the page server-side, extracting structure and copy, and mapping
it onto the components. The result is navigable: tabs open real pages, search
runs the site's own search, forms are editable.

https://design-system-3gs.vercel.app
https://github.com/TimonBozzApps/design-system-3gs

Timon
```

## 3. This Week In React (Sébastien Lorber)

No public form; he takes suggestions on X/Bluesky and via the newsletter's contact. Best done as a short
DM/mention rather than a cold email — and he's more likely to pick it up after it has some traction, so
send this *after* the HN post.

```
Hi Sébastien — built a React component library that recreates the iPhone 3GS /
iOS 3 interface (tokens, two themes, RTL, i18n), plus a toy that re-renders any
website you paste as a 2009 iPhone app. Might fit TWIR's "fun" slot.
https://design-system-3gs.vercel.app
```

## 4. Not worth chasing (checked)

- **Bytes.dev** — no public submission address; their items come from the authors' own reading. Skip, or
  mention it on X where the Bytes folks are active.
- **TLDR Web Dev** — submissions go through their sponsor/contact form; the free editorial slots aren't
  open to cold submissions.
- **Awesome React (GitHub list)** — a PR is possible, but the list is curated conservatively and new
  libraries without stars are usually declined. Worth doing *after* the launch, when the repo has traction.
- **lucide showcase** — no documented submission path on the site; their repo takes it as a PR/issue once
  the project is public and used. Fine to raise an issue linking the site: you genuinely build on lucide.

---

## Sequencing

Send Cooperpress and Console **after** the HN post, not before — curators check whether a thing has any
signal, and "it was on the HN front page on Tuesday" is the single best line you can add to these emails.
If HN goes well, add one sentence: *"It was #N on Hacker News on <date> if that's a useful signal."*
