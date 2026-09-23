# Launch assets — 3GS UI

Everything here was captured from the live site (`https://design-system-3gs.vercel.app`) with
headless Chrome over CDP at a 2× device pixel ratio. The GIFs are 10 fps, quantised to a single
255-colour FASTOCTREE palette (no dithering — it measured cleaner than Floyd–Steinberg on the gel
gradients) and delta-encoded, so static pixels cost nothing. Both loop forever.

## Animations

| File | Size | Dimensions | Length | What it shows | Post it |
|---|---|---|---|---|---|
| `demo-3gsify.gif` | 473 KB | 720 × 700 | 13.3 s, loops | The money shot. `stripe.com` typed into the “Try it on your site” field character by character → the 3GS-ify gel button is pressed → the loading HUD spins → the phone fills with Stripe as a 2009 iPhone app → the **Pricing** tab is tapped and the screen changes → the list is flicked → a row is tapped and a new screen pushes with a **Back** button → Back returns to Pricing (so the loop lands on a full screen). | Lead image of the X / Reddit launch post, the Show HN top comment, top of the README |
| `demo-hn.gif` | 1.07 MB | 480 × 824 | 6.8 s, loops | The share page `/p/news.ycombinator.com`: the Hacker News front page inside the phone, flicked down through the story list and back, then the **new** scope tapped → HUD → the list becomes *New Links*. | Second image in an X thread, Slack / Discord, r/webdev |

Notes on the two GIFs:

- Frames are captured on a 100 ms timer with a fixed clip rect (identical geometry every frame, so
  there is no jitter) and resampled to an exact 10 fps by timestamp.
- The network is throttled during capture (`Network.emulateNetworkConditions`) so the loading HUD
  reads as a beat rather than a blink — ~1.5 s on the docs demo, ~0.7 s of 3G-ish latency on the HN
  one. Nothing else is faked; every tap is a real mouse event and every screen is a real fetch.
- `demo-3gsify.gif` is cropped to the input UI plus the phone — no browser chrome, no sidebar. The
  docs page is stripped to that composition with an injected stylesheet before capture.
- **Deviation from the brief:** on the HN share page every story row is an *external* anchor
  (`target="_blank"` → the real story), so tapping one cannot change the phone. The equivalent
  in-phone tap — the `new` scope segment, which reloads the list — is used instead.

## Stills

All PNGs are 2× DPR, so the CSS size is half the pixel size. Cropped to the subject, no browser UI.

| File | Size | Dimensions | What it shows | Post it |
|---|---|---|---|---|
| `still-hero.png` | 278 KB | 2320 × 1404 (1160 × 702 @2×) | The docs hero: “The 2009 glass, back in *dark mode*.”, the install snippet, and the App Store “Categories” phone. | `og:image`, blog header, README top, link unfurls |
| `still-themes.png` | 298 KB | 1912 × 1600 (956 × 800 @2×) | The same App Store screen dark **and** light, side by side on the share-poster backdrop — the “it’s both themes” proof. | The “one line re-themes it” beat of an X thread; docs README |
| `still-hn.png` | 355 KB | 1152 × 1952 (576 × 976 @2×) | Poster-style: the Hacker News front page in the phone, phone only, from `/p/news.ycombinator.com`. | Single-image X post, Reddit, the HN thread itself |
| `still-keyboard.png` | 254 KB | 2320 × 1404 (1160 × 702 @2×) | The `#keyboard` section with the **T** key held down and the enlarged popup bubble floating above the keyboard. | Component deep-dive post, thread image, docs |
| `still-tokens.png` | 228 KB | 2224 × 1880 (1112 × 940 @2×) | The `#tokens` gallery — the gel gradients (bar / barbutton / neutral / dark / blue / red / gloss with their pressed twins) and the rims & shadows that lift them. | The “it’s all CSS custom properties” post; docs |

`still-themes.png` is the one composed shot: two clones of the live hero phone, one with
`data-theme="dark"` and one with `data-theme="light"`, rendered together on the share page’s own
radial backdrop and captured in one screenshot — not a Photoshop paste-up.
