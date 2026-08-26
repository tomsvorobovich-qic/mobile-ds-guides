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
own**, interpolated from transparent to `scroll` over a scroll window, with the
screen title fading in on the same window. The icon scrim fades out, inverted.

- Nav bar fill: animated, `transparent → scroll`.
- Content container: **no top radius.**
- This is the *only* pattern where animating the nav bar background is correct.
- Chrome ink flips (light-on-photo → normal) at the midpoint of the window,
  together with the status bar style.

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

## 4. The question that decides B1 vs B2

> **Must the hero stay readable right up to the top edge?**

- **Yes** → B1. The hero survives under the chrome, so the nav bar needs its
  own fill to keep icons and title legible. No radius.
- **No** → B2. The content container covers the hero itself, so the nav bar
  needs no fill of its own. Radius.

It is *not* "is the hero a photo?". An accent field with graphics is still B2
— see the fourth frame on the stand.

---

## 5. Legal combinations

| | A — collapsing | B1 — nav paints | B2 — overflow |
|---|---|---|---|
| Plain (tertiary → primary) | ✅ | ✅ | ✅ |
| Feed (tertiary → secondary) | ✅ | ⚠️ only if the hero is a photo; secondary under a painted bar reads as a mistake | ✅ |
| Accent (accent → primary) | ❌ accent behind an opaque same-level bar has nothing to show | ❌ accent hero needs no scrim | ✅ the intended use |

---

## 6. Tokens

| Token | Note |
|---|---|
| `navbar.height` | 56. A token, never a literal in a screen. |
| `statusbar.height` | Read from the safe-area inset. Never hardcode; it varies per device. |
| `surface.page` / `surface.primary` / `surface.secondary` / `surface.tertiary` / `surface.accent` | Axis 1. In B2 the page token *is* the nav bar colour — no separate `navbar.background.solid` is needed. |
| `content.radius.top` | Top radius of the overflowing container (B2). |
| `scroll.overlap` | How far the container climbs over the row above it (B2). Equal to that row's height. |
| `scroll.stickyOffset` | = `navbar.height`. Anchor for pinned sub-headers (A). |
| `navbar.paint.start` / `navbar.paint.distance` | The fill window (B1). Derived per screen from the hero height — parameterised, never a literal. |

Reference values measured on the iOS implementation: `overlap 68`,
`radius 20`, paint window `start 130 / distance 50`. Treat them as
starting points to re-measure, not as constants.

---

## 7. What the stand cannot tell you

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

## 8. QA checklist

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
- [ ] Short content — less than one viewport — leaves the header in a valid end
      state, not half-animated.
- [ ] Last row clears the home indicator.
- [ ] Pinned elements do not break the VoiceOver / TalkBack focus order.
- [ ] Icon contrast passes WCAG AA in *both* chrome states.

---

## 9. Open questions

- Does the hero compress before the container covers it (B1), or does it just
  leave at constant height?
- Does the pinned sub-header get a shadow or a hairline, and does it appear at
  `scrollTop > 0` or on pin?
- Scroll-driven with no easing, or a short eased settle after the gesture ends?
