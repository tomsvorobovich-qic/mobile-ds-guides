---
layout: default
title: Scroll, nav bar and surface patterns
---

# Scroll, nav bar and surface patterns

<p class="lede">Two independent axes decide how a screen behaves under scroll: which
<strong>surface level</strong> each layer sits on, and how the <strong>header</strong> reacts. Pick one from each
axis — never one from a merged list.</p>

[Open the interactive stand →](../stands/scroll-patterns.html)

---

## 1. Why two axes

Most write-ups of this problem describe one axis and smuggle the other in as
examples. That is where handoffs break: two screens get filed under the same
pattern name while their nav bars work by entirely different mechanics.

Keep them separate:

- **Axis 1 — surfaces.** Which token fills the page, the scrolling container,
  and the content blocks inside it.
- **Axis 2 — header behaviour.** What leaves, what stays, and whether the nav
  bar's fill ever changes.

A screen spec is one value from each. "Accent page + surface overflow" and
"tertiary page + surface overflow" are the same behaviour on different surfaces
— not two patterns.

---

## 2. Axis 1 — surface levels

Three roles, filled by tokens:

| Role | What it is | Typical token |
|---|---|---|
| `page` | The screen behind everything. Visible around and behind the scrolling content, including the nav bar band. | `surface.tertiary` or `surface.accent` |
| `scroll` | The scrolling container itself. | `surface.primary` or `surface.secondary` |
| `block` | Content blocks inside the scroll — cards, rows, feed items. | `surface.primary` |

Three stacks cover everything we have shipped:

| Stack | page → scroll → block | Where |
|---|---|---|
| **Plain** | tertiary → primary → primary | Simple pages: one flat scrolling sheet. |
| **Feed** | tertiary → secondary → primary | Lists where blocks must read as separate objects against a recessed field. |
| **Accent** | accent → primary → primary | Promo and section landings. The page level carries brand colour and optional graphics. |

Rule: **`block` is never lower than `scroll`, and `scroll` is never lower than
`page`.** Levels only go up as you go forward. An inversion means a component
is on the wrong level, not that the rule needs an exception.

---

## 3. Axis 2 — header behaviour

The nav bar is **opaque in every pattern**. What differs is which token fills
it, and whether that fill ever changes.

### A — Collapsing header

Nav bar is filled with the `scroll` level from the start. Below it, a page
header (large title, hero card) sits in normal flow and simply scrolls away. A
functional sub-header — search, tabs, quick actions — pins under the nav bar
and stays.

- Nav bar fill: `scroll`, constant.
- Content container: no top radius.
- **Needs no scroll listener at all.** The title is an ordinary element; the
  sub-header is `sticky` against a scrollport that already starts below the nav
  bar. If you find yourself writing scroll maths for pattern A, the layout is
  wrong.
- The pinned sub-header keeps its state (selected tab, typed query). It is not
  a component that gets recreated on pin.

### B1 — Nav bar paints

A photo hero bleeds under the chrome. The nav bar has a **real fill of its
own**. The hero does not leave: it is **pinned to the top and shrinks** inside a
fixed-height slot, so the content below scrolls at normal speed.

- Nav bar fill: `transparent → scroll`, and **not interpolated per pixel**. The
  shipped implementation flips a boolean at a threshold (`(scrollY - 130) / 50`
  crossing 0.5, i.e. ~155) and lets a 0.2s ease-in-out crossfade do the rest.
  Copying this as a scroll-linked interpolation is a common misreading.
- Content container: **no top radius**, and the scroll viewport is full-bleed —
  the photo has to reach under the status bar.
- The title, a 0.5pt hairline at `black 8%`, and the loss of the icon scrim
  (`black 50%`) all land on that same flip, together with the status bar style.
- This is the only pattern where the nav bar owns a fill at all.

### B3 — Hero fades to the page

Same skeleton as B1 — hero pinned, content layering over it — but the nav bar
**never gets a fill**. Instead the hero itself lightens toward the page level as
the content rides up, so by the end of the travel the nav band already reads as
the page background.

- Nav bar fill: none, ever.
- Content container: top radius; the scroll viewport is inset below the chrome
  and carries the same radius.
- The hero is a layer *outside* the scroll container. It does not move.
- Title and chrome ink switch at the midpoint of the fade, otherwise light
  glyphs end up on a light field.

### B2 — Surface overflow

The page level shows through the nav bar band, so the band reads as part of the
background and **never animates**. The scrolling content is a container with a
**top radius** that climbs over whatever sits above it (a chip row, an accent
hero) and slides under the chrome.

- Nav bar fill: `page`, constant.
- Content container: top radius.
- The row above is *held* for the first `overlap` px while the container keeps
  scrolling — that is what produces the overflow. Set `overlap` equal to the
  held row's height for full coverage.
- Do **not** implement this with a negative offset at rest: the row must be
  fully visible at `scrollTop 0`.

---

## 4. The question that decides the header pattern

Not "is the hero a photo?" — an accent field with graphics behaves exactly like
one. The deciding question is narrower:

> **What covers the nav band by the end of the scroll?**

- **The content container** → B2. It rides up and its own surface fills the
  band. The nav bar is filled with the page token and never animates. Radius on
  both the viewport and the surface.
- **The nav bar's own fill** → B1. The hero has to stay legible under the chrome
  to the very last pixel, so the bar paints itself. No radius, full-bleed
  viewport.
- **The hero, by becoming the page colour** → B3. The bar stays unfilled and the
  hero fades out under it. Radius, inset viewport.

B1 and B3 are the same mechanic — pinned hero, content layering over it — and
they diverge on this one decision. Filing them under different "patterns"
because one has a photo and one has a promo image hides the fact that only the
nav-band treatment differs.

---

## 5. What is actually built

Before treating any of this as a spec, check which half of it exists. The four
cases written up in the original header-transition doc do not map one-to-one
onto the app:

| Case as documented | In the app |
|---|---|
| Collapsing title on the market feed, sticky search + `Fresh / New / Used` tabs | **No.** There is no collapsing title and no such tabs — the string `Fresh` does not exist in the codebase. What is built is a **pinned filter-chip row** (68pt) with the feed surface riding over it. |
| Object card / My cars: title + photo + 360 badge collapse, sticky `Get help / Car care` | **No sticky block.** Those two are rows inside a menu sheet. The garage hero is pinned and shrinks with a fade. |
| Promo / section landing (Travel) | **Design only** — the Figma flow exists, the screen does not. |
| Listing card | **Yes** — this is the one case shipped as documented. |

Anything marked "no" is design intent, not a described implementation. Handing
it over as-is sends a developer looking for controls that were never built.

## 6. Legal combinations

| | B2 — overflow | B1 — nav paints | B3 — hero fades |
|---|---|---|---|
| Plain (tertiary → primary) | ✅ | ✅ | ✅ |
| Feed (tertiary → secondary) | ✅ | ⚠️ only with a photo hero; secondary under a painted bar reads as a mistake | ⚠️ the fade has to land exactly on the page token, or the seam shows |
| Accent (accent → primary) | ✅ the intended use | ❌ an accent hero needs no scrim | ✅ |

---

## 7. Tokens

| Token | Note |
|---|---|
| `navbar.height` | 56. A token, never a literal in a screen. |
| `statusbar.height` | Read from the safe-area inset. Never hardcode; it varies per device. |
| `surface.page` / `surface.primary` / `surface.secondary` / `surface.tertiary` / `surface.accent` | Axis 1. In B2 the page token *is* the nav bar colour — no separate `navbar.background.solid` is needed. |
| `content.radius.top` | Top radius of the overflowing container. It must be applied in **two** places: on the scroll viewport (so content sliding under the nav bar keeps a rounded corner instead of a straight seam) and on the surface itself (so its own top rides over whatever is above it). Applying it only to the surface is the single most common mistake — the rounding then disappears the moment scrolling starts. |
| `scroll.overlap` | How far the container climbs over the row above it (B2). Equal to that row's height. |
| `scroll.stickyOffset` | = `navbar.height`. Anchor for pinned sub-headers (A). |
| `navbar.paint.start` / `navbar.paint.distance` | The fill window (B1). Derived per screen from the hero height — parameterised, never a literal. |

Reference values measured on the iOS implementation: `overlap 68`
(= 44 chip + 2×12), paint window `start 130 / distance 50`, hero `300`,
promo hero `480`, home indicator `134×5 r2.5`.

**Unresolved:** the radius token reads `32` in the design file
(`radius/xl` on `Content`), while the shipped code uses `20` in the feed and the
listing card and `24` in the garage. Three values for one rule — either the app
is stale or the rule is. Note also that at board level the variable dump reports
`xl = 24`, which is the *spacing* collection; the radius `xl` is `32`. One name,
two values, and a handoff that picks the wrong one.

---

## 8. What the stand cannot tell you

The stand is honest about surfaces, thresholds, vocabulary and the B1/B2 split.
Four things do not transfer from a browser and must be decided on device:

1. **Gesture arbitration.** A horizontally scrolling pinned row inside a
   vertical scroll needs an explicit contract, or pull-to-refresh attaches to
   the wrong recogniser and dies.
2. **Rubber-banding / overscroll.** Whether the hero stretches on overscroll is
   a per-pattern decision and looks nothing like a browser's.
3. **Pull-to-refresh** placement relative to an overflowing container.
4. **Momentum and interruptibility.** Every threshold must survive a fast
   flick, and reverse symmetrically.

---

## 9. QA checklist

- [ ] Nav bar does not jump on a fast flick — thresholds are interpolated, not
      switched.
- [ ] Every transition is reversible: scrolling back up retraces it exactly.
- [ ] Status bar style flips with the fill (B1) or with the container covering
      the hero (B2) — not on a timer.
- [ ] At `scrollTop 0` in B2, the held row is fully visible.
- [ ] The container's top radius is not clipped oddly by the notch as it slides
      under the chrome.
- [ ] Pinned sub-header does not teleport into place (A).
- [ ] Pinned sub-header keeps its state across pinning (A).
- [ ] The radius survives scrolling — it is on the viewport, not only on the
      surface. A straight seam under the nav bar the moment you scroll means it
      was applied in one place instead of two.
- [ ] The surface clips its own children: the first content block must not paint
      over the rounded top.
- [ ] Overscroll never exposes a foreign surface level at either end.
- [ ] The nav bar has no border and does not cut the page background — graphics
      on the page level run behind the status bar.
- [ ] Short content — less than one viewport — leaves the header in a valid end
      state, not half-animated.
- [ ] Last row clears the home indicator.
- [ ] Pinned elements do not break the VoiceOver / TalkBack focus order.
- [ ] Icon contrast passes WCAG AA in *both* chrome states.

---

## 10. Open questions

- Does the hero stretch on pull-down (the listing card grows its photo; nothing
  else does), and should that be system-wide?
- Does the pinned sub-header get a shadow or a hairline, and does it appear at
  `scrollTop > 0` or on pin?
- Scroll-driven with no easing, or a short eased settle after the gesture ends?
