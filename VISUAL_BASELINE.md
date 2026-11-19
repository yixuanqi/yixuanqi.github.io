# Homepage visual baseline

## Source of truth

- Original reference: `references/galaxy-warp-v5.html` (the user-provided V5 HTML).
- Homepage renderer: `assets/cosmos-home.js`, derived from the reference.
- Keep this document and the reference HTML as the baseline for future homepage and star-sea changes.

## Homepage composition

- The hero contains one centrally floating **small rocket** with a discreet **星海漫游** label. A visually separate black hole with an event horizon, a photon ring and animated accretion disk is positioned ahead of it.
- Remove marketing headlines, explanatory paragraphs, archive labels, secondary hero actions, duplicate portal buttons, and decorative copy from the hero.
- The existing site brand and project/about navigation may remain in the header.
- The CTA is the visual focus; the starfield remains visible behind it.

## Cosmic rendering baseline

- Use Three.js 0.168.0 and the original V5 GLSL shader architecture.
- Preserve the deep velvet nebula backdrop, domain-warped FBM wisps, sapphire palette, cyan/ice highlights, champagne-gold accents, and restrained HDR bloom.
- Preserve the three analytical capsule-star layers: deep-field, main luminous streams, and peripheral flyby threads.
- Preserve subtle camera parallax and continuous idle star drift. Do not replace this with a static planet illustration or generic 2D particle canvas.
- Mobile may lower pixel ratio and star count for performance while preserving the same visual character.

## Warp interaction baseline

The floating rocket (`#warp-trigger-btn`) is the only trigger. Clicking first launches the rocket toward the black-hole center (1.7 seconds), then the V5 four-stage warp begins. The black-hole's screen-space GLSL refraction is composited over the existing V5 stars.

| Stage | Duration | Effect |
|---|---:|---|
| CHARGE | 1.5 s | Gentle brightening and FOV contraction |
| BREAKTHROUGH | 1.3 s | Exponential acceleration, entry ripple, FOV expansion |
| CRUISE | 4.6 s | Three-layer star streaks and translucent spacetime veil |
| DECEL | 3.1 s | Head deceleration, tail collapse, exit ripple, FOV settle |

Production transition: **1.7 seconds of rocket approach + 10.5 seconds of V5 warp + 0.78 seconds of blackout/handoff**. The test harness may accelerate these timings.

Before same-tab navigation to `/PhotoGallery/galaxy/`, cover the full screen in black and store a one-time `sessionStorage` token (`cosmos-to-galaxy-v2`). The destination consumes the token and unveils its first rendered scene through a radial black-hole exit; direct visits must not show the arrival mask. Never use `target="_blank"`, `window.open`, or an intermediate popup for this CTA.

## Regression rules

- Keep visible hero copy at zero except the single CTA label.
- Keep exactly one `#warp-trigger-btn`.
- Do not alter V5 shaders or stage timings without updating this baseline and browser tests.
- Validate desktop/mobile WebGL initialization, CTA visibility, horizontal overflow, catalog loading/search/filtering, and same-tab navigation.
- CI smoke tests must enable WebGL and verify the destination without a popup.
- The smoke harness may set `window.__COSMOS_TEST_MODE__` to reduce render load and warp durations; production timings remain unchanged.
