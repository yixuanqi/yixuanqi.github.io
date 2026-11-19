# Homepage visual baseline

## Source of truth

- Primary reference for the homepage rocket, black hole and warp: `references/rocket-blackhole-warp-3d-q.html` (the user-provided `3d_q.html`).
- Production scene: `assets/rocket-warp.html`, embedded by `index.html` as the same-origin `#rocket-warp-frame` iframe.
- Keep the uploaded reference unchanged. Make production adaptations in `assets/rocket-warp.html` and update this document when the choreography or composition changes.
- The earlier `references/galaxy-warp-v5.html` remains a historical V5 reference; it is no longer the primary source for the rocket/black-hole scene.

## Visual and rendering baseline

- Use the reference's Three.js 0.160.0 scene and custom GLSL pipeline, not a CSS/SVG imitation.
- The rocket is a procedural 3D Q-style model built by `buildChibiRocket3D`, with a rounded head, porthole, body, fins, animated exhaust flames, 3D puff particles and starlight sparkles.
- The black hole is rendered by `LENSING_BLACKHOLE_FRAG`: opaque event horizon, photon ring, lensed halo arcs, rotating FBM accretion disk, Einstein-ring deflection and breakthrough/arrival ripples.
- Preserve the velvet-dark nebula, three continuous analytical capsule-star layers, jewel-tone stars, subtle spacetime veil, dynamic camera/FOV, HDR bloom, tonemapping and selective FXAA.
- Keep the 7-stage render pipeline and hardware MSAA detection/fallback from the reference.
- Keep the rocket/black-hole canvas isolated in a same-origin iframe. This confines pointer raycasting and touch/hold gestures to the hero, so project cards and page scrolling remain usable.
- Hide the reference's tuning HUD and phase badges on the portal. The only idle hero copy is the single label `星海漫游`; show the fine progress line only while the warp is active.
- Desktop keeps the full reference star budget. Mobile reduces DPR and particle counts while retaining the same model, shaders and choreography.

## Warp choreography and navigation

The production choreography follows the reference's five asymmetric stages:

| Stage | Duration | Effect |
|---|---:|---|
| `ROCKET_DIVE` | 2.15 s | 3D rocket anticipation, ignition, curved flight and gravitational capture |
| `SINGULARITY_CHARGE` | 0.75 s | Event-horizon pulse, lens strengthening and FOV contraction |
| `BREAKTHROUGH` | 1.25 s | Black-hole dissolution, spacetime ripple and exponential acceleration |
| `CRUISE` | 4.50 s | Three star layers stretch into luminous streams with a translucent spacetime veil |
| `ARRIVE_RETURN` | 2.85 s | Star deceleration, exit ripple and 3D portal return |

Total scene choreography: 11.50 seconds, followed by a 0.78-second blackout/handoff.

- The only launch gesture is clicking/tapping the 3D rocket (Space remains an accessible keyboard shortcut).
- At launch, fade the outer portal header. Keep the user in the same tab throughout.
- At completion, set a one-time `sessionStorage` token `cosmos-to-galaxy-v2` with `version: 2`, the current origin and a millisecond `time`, then navigate the top-level window to `/PhotoGallery/galaxy/`.
- The Galaxy page consumes the token and performs its existing radial black-hole exit reveal. Direct visits must not show the arrival mask.
- Never use `target="_blank"`, `window.open`, or an intermediate popup for this CTA.
- The smoke harness may set `window.__ROCKET_WARP_TEST_MODE__` to lower render load and scale every time-based stage threshold consistently. Production stage timings must remain unchanged.

## Regression rules

- Keep exactly one `#rocket-warp-frame` in the portal and one `#cosmos-canvas` inside that frame.
- Keep exactly one visible hero label, `星海漫游`; no extra hero paragraphs, marketing copy, phase badge or settings panel.
- Confirm the rocket is a real 3D mesh and the black hole is shader-rendered; do not reintroduce SVG rocket artwork or CSS accretion-disk approximations.
- Validate desktop/mobile WebGL initialization, iframe sizing, no horizontal overflow, the actual rocket raycast, the five-stage transition, same-tab navigation and the Galaxy arrival token.
- Preserve catalog loading, search and category filtering.

## Full-screen launch coverage

- While idle, the embedded 3D scene already begins at the top of the viewport (y=0) and fills the entire first screen. The site header is absolutely positioned above the starfield, with fully transparent background and no border. The brand and navigation remain accessible without a separate dark band.
- As soon as `rocket-launching` is set, the **existing hero and iframe** switch to `position:fixed; inset:0`, maintaining 100% viewport coverage. No new iframe or WebGL context is created.
- The disappearing header must never leave a 94px desktop / 72px mobile black stripe during star-warp playback.
- Desktop and mobile browser regression checks verify that idle and launched frames both begin at the viewport's top edge, that the transparent header overlays the idle stars, and that WebGL remains initialized. The real warp path checks full-screen coverage as well.
