/* Homepage starfield and warp transition. Visual baseline: references/galaxy-warp-v5.html */

    import * as THREE from 'three';

    // ============================================================================
    // 1. FOUR CURATED STAR REALMS & DEFAULT PARAMETERS
    // ============================================================================
    const REALMS = [
      {
        zh: '苍穹蓝海',
        en: 'SAPPHIRE ABYSS',
        cssAccent: '#6cb8ff',
        cssSoft: 'rgba(108, 184, 255, 0.44)',
        cssFaint: 'rgba(108, 184, 255, 0.15)',
        skyDeep: new THREE.Color('#02040b'),
        skyMid: new THREE.Color('#051029'),
        nebulaA: new THREE.Color('#0d2660'),
        nebulaB: new THREE.Color('#1a174d'),
        veilA: new THREE.Color('#1848a8'),
        veilB: new THREE.Color('#47b5ff'),
        vpGlow: new THREE.Color('#0d2864'),
        // Rich jewel-tone streak tail colors (sapphire, ice cyan, royal cobalt, champagne gold)
        star0: new THREE.Color('#4496ff'),
        star1: new THREE.Color('#6de2ff'),
        star2: new THREE.Color('#808cff'),
        star3: new THREE.Color('#ffd085'),
        headTint: new THREE.Color('#f4f9ff'),
      },
      {
        zh: '暮色琥珀',
        en: 'AMBER DUSK',
        cssAccent: '#f5c282',
        cssSoft: 'rgba(245, 194, 130, 0.44)',
        cssFaint: 'rgba(245, 194, 130, 0.15)',
        skyDeep: new THREE.Color('#04030b'),
        skyMid: new THREE.Color('#130b22'),
        nebulaA: new THREE.Color('#2c1742'),
        nebulaB: new THREE.Color('#47212c'),
        veilA: new THREE.Color('#5a306e'),
        veilB: new THREE.Color('#e8a264'),
        vpGlow: new THREE.Color('#281642'),
        star0: new THREE.Color('#ffc170'),
        star1: new THREE.Color('#f596b0'),
        star2: new THREE.Color('#9ca8ff'),
        star3: new THREE.Color('#ffe2b0'),
        headTint: new THREE.Color('#fff8ef'),
      },
      {
        zh: '紫微星河',
        en: 'INDIGO VIOLET',
        cssAccent: '#bb91ff',
        cssSoft: 'rgba(187, 145, 255, 0.44)',
        cssFaint: 'rgba(187, 145, 255, 0.15)',
        skyDeep: new THREE.Color('#03020d'),
        skyMid: new THREE.Color('#0c092a'),
        nebulaA: new THREE.Color('#24145c'),
        nebulaB: new THREE.Color('#3b155e'),
        veilA: new THREE.Color('#4c30b5'),
        veilB: new THREE.Color('#b082ff'),
        vpGlow: new THREE.Color('#22135a'),
        star0: new THREE.Color('#a870ff'),
        star1: new THREE.Color('#d6b0ff'),
        star2: new THREE.Color('#75c8ff'),
        star3: new THREE.Color('#f7bdd8'),
        headTint: new THREE.Color('#f7f4ff'),
      },
      {
        zh: '极光寒穹',
        en: 'AURORA BOREALIS',
        cssAccent: '#63ebd0',
        cssSoft: 'rgba(99, 235, 208, 0.44)',
        cssFaint: 'rgba(99, 235, 208, 0.15)',
        skyDeep: new THREE.Color('#01060b'),
        skyMid: new THREE.Color('#041b24'),
        nebulaA: new THREE.Color('#083842'),
        nebulaB: new THREE.Color('#0f234a'),
        veilA: new THREE.Color('#106975'),
        veilB: new THREE.Color('#47e8c2'),
        vpGlow: new THREE.Color('#093444'),
        star0: new THREE.Color('#40e8bf'),
        star1: new THREE.Color('#63caff'),
        star2: new THREE.Color('#96f7e0'),
        star3: new THREE.Color('#ffe2a6'),
        headTint: new THREE.Color('#f2feff'),
      },
    ];

    const DEFAULTS = {
      realmIndex: 0,
      autoSwitchRealm: true,
      streakLength: 1.05,
      streamDensity: 1.00,
      maxFov: 110,
      bgStarFlow: 0.24,
      bloomGlow: 0.72,
      spacetimeVeil: 0.14,
      rippleStrength: 1.00,
    };

    const params = { ...DEFAULTS };

    // Smoothly interpolated live palette uniforms shared across all shaders
    const liveColors = {
      skyDeep: REALMS[0].skyDeep.clone(),
      skyMid: REALMS[0].skyMid.clone(),
      nebulaA: REALMS[0].nebulaA.clone(),
      nebulaB: REALMS[0].nebulaB.clone(),
      veilA: REALMS[0].veilA.clone(),
      veilB: REALMS[0].veilB.clone(),
      vpGlow: REALMS[0].vpGlow.clone(),
      star0: REALMS[0].star0.clone(),
      star1: REALMS[0].star1.clone(),
      star2: REALMS[0].star2.clone(),
      star3: REALMS[0].star3.clone(),
      headTint: REALMS[0].headTint.clone(),
    };

    // ============================================================================
    // 2. GLSL SHADERS (VERIFIED RIGHT-HANDED WINDING, ZERO NaN, ZERO ALIASING)
    // ============================================================================

    const FULLSCREEN_VERT = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // ----------------------------------------------------------------------------
    // 2A. Deep Velvet Nebula Sky Dome + Translucent Spacetime Silk Veil +
    //     Subtle Deep-Sapphire Vanishing Point Atmospheric Glow
    // ----------------------------------------------------------------------------
    const COSMOS_BACKDROP_FRAG = /* glsl */ `
      precision highp float;

      uniform float uTime;
      uniform float uDrift;
      uniform float uFlow;
      uniform float uWarp;
      uniform float uVeilOpacity;
      uniform float uAspect;
      uniform float uTanHalfFov;
      uniform vec2  uVanishingOffset;
      uniform vec3  uCamRight;
      uniform vec3  uCamUp;
      uniform vec3  uCamForward;

      uniform vec3  uSkyDeep;
      uniform vec3  uSkyMid;
      uniform vec3  uNebulaA;
      uniform vec3  uNebulaB;
      uniform vec3  uVeilA;
      uniform vec3  uVeilB;
      uniform vec3  uVpGlow;

      varying vec2 vUv;

      // Ashima 3D Simplex Noise
      vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 1.0 / 7.0;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      float fbm4(vec3 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          val += amp * (snoise(p) * 0.5 + 0.5);
          p = p * 2.03 + vec3(11.3, -6.7, 3.9);
          amp *= 0.5;
        }
        return val;
      }

      float fbm3(vec3 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 3; i++) {
          val += amp * (snoise(p) * 0.5 + 0.5);
          p = p * 2.05 + vec3(7.1, -4.9, 2.3);
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 ndc = vUv * 2.0 - 1.0;
        vec3 ray = uCamForward
          + uCamRight * (ndc.x * uAspect * uTanHalfFov)
          + uCamUp * (ndc.y * uTanHalfFov);
        ray /= max(length(ray), 0.0001);

        // Aspect-corrected polar coordinates centered on projected vanishing point
        vec2 pVP = (vUv - 0.5) * vec2(uAspect, 1.0) - uVanishingOffset;
        float rVP = length(pVP);
        float angleVP = atan(pVP.y, pVP.x);

        // Deep velvet cosmos base (#02040b)
        float zenith = smoothstep(-0.85, 0.85, ray.y);
        vec3 col = mix(uSkyMid * 0.65, uSkyDeep, zenith);

        // Subtle tilted galactic plane with domain-warped FBM nebula wisps
        float plane = dot(ray, normalize(vec3(0.36, 0.89, 0.28)));
        float galacticBand = exp(-plane * plane * 4.6);

        vec3 stretchRay = vec3(ray.xy * (1.0 - uWarp * 0.18), ray.z * (1.0 + uWarp * 0.30));
        vec3 pNeb = stretchRay * 2.1 + vec3(0.0, uTime * 0.004, -uDrift * 0.15);
        float n1 = fbm4(pNeb);
        vec3 warpOff = vec3((n1 - 0.5) * 1.15, (0.5 - n1) * 0.95, -uDrift * 0.06);
        float n2 = fbm4(pNeb * 1.48 + warpOff);

        float wispA = smoothstep(0.34, 0.86, n1 * 0.52 + n2 * 0.56) * (0.42 + 0.65 * galacticBand);
        float wispB = pow(max(smoothstep(0.38, 0.90, n2), 0.0001), 2.2) * (0.36 + 0.70 * galacticBand);

        // Restrained luminance so background stays pure midnight velvet
        vec3 nebula = uNebulaA * wispA * 0.24 + uNebulaB * wispB * 0.20;
        col += clamp(nebula, vec3(0.0), vec3(0.105));

        // Ultra-delicate Translucent Spacetime Silk Veil (12–16% opacity during cruise)
        if (uVeilOpacity > 0.001) {
          float zDepth = 1.25 / (rVP + 0.12);
          float swirl1 = angleVP + zDepth * 0.18 - uTime * 0.11;
          vec3 cyl1 = vec3(cos(swirl1) * 1.5, sin(swirl1) * 1.5, zDepth * 0.28 - uFlow * 0.80);
          float silkBroad = fbm3(cyl1);

          float swirl2 = angleVP - zDepth * 0.14 + uTime * 0.09;
          vec3 cyl2 = vec3(cos(swirl2) * 2.9, sin(swirl2) * 2.9, zDepth * 0.15 - uFlow * 1.60);
          float silkStream = fbm3(cyl2 + vec3((silkBroad - 0.5) * 1.05, (0.5 - silkBroad) * 0.90, 0.0));

          float curtain = smoothstep(0.32, 0.86, silkBroad) * 0.48;
          float currents = pow(max(smoothstep(0.45, 0.91, silkStream), 0.0001), 2.3) * 0.88;

          // Smoothly fades out toward vanishing point so center stays clean and deep
          float radialVeilMask = smoothstep(0.07, 0.48, rVP) * (0.78 + 0.30 * smoothstep(0.35, 1.05, rVP));
          vec3 veilCol = (uVeilA * curtain + uVeilB * currents) * radialVeilMask * uVeilOpacity;
          col += clamp(veilCol, vec3(0.0), vec3(0.16));
        }

        // Subtle deep sapphire atmospheric depth glow at vanishing point (never white!)
        float vpInner = exp(-rVP * rVP * 24.0);
        float vpOuter = exp(-rVP * rVP * 4.8);
        col += uVpGlow * (vpInner * 0.38 + vpOuter * 0.52) * (0.12 + uWarp * 0.28);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    // ----------------------------------------------------------------------------
    // 2B. Analytical 2D Capsule SDF in Exact Screen Pixel Space
    //     Shared across ALL 3 Dynamic Star Layers (ZERO static stars, ZERO bokeh):
    //       - Layer 1: Deep-Field Dynamic Starfield (3,600 stars)
    //       - Layer 2: Main Luminous Starlight Streams (2,800 stars)
    //       - Layer 3: Peripheral High-Speed Flyby Threads (320 stars)
    //
    //     GUARANTEES:
    //       - Right-handed basis (dirPx along position.x, perpPx along position.y) + DoubleSide
    //       - Strict Three.js view-space near-plane clipping (nearZ = -0.35) BEFORE projection
    //       - Quad half-width >= 2.4 * uPixelRatio ALWAYS (4.8+ physical px -> ZERO dashed aliasing)
    //       - gl_Position.w = 1.0 for 100% linear exact-pixel interpolation
    //       - Razor-sharp pinpoint stars & screen-aligned 4-point diffraction spikes when idle
    // ----------------------------------------------------------------------------
    const CAPSULE_STAR_VERT = /* glsl */ `
      attribute vec3 aCylPos;       // (radius, angle, initialZ in [0, span])
      attribute vec4 aMeta;         // (idleCoreCssPx, speedMult, tailScale, phase)
      attribute vec4 aFlags;        // (hasSpike, densityRank, magBrightness, radialFadeSeed)
      attribute vec4 aColorWeights; // 4-way active realm jewel color weights

      uniform float uTime;
      uniform float uTravelDist;
      uniform float uZMin;          // Far wrap Z (negative, e.g. -420 or -280)
      uniform float uZMax;          // Near wrap Z (negative or 0, e.g. -10 or 0)
      uniform float uStretchWorld;  // Decoupled world-unit streak length
      uniform float uWarpMix;       // 0 = idle crisp star, 1 = full warp filament
      uniform float uCharge;        // 0..1 Stage 1 subtle brightening
      uniform float uDensityCutoff; // Smooth density gate for Main Streams
      uniform float uLayerMode;     // 0 = Deep-Field, 1 = Main Streams, 2 = Peripheral Flyby
      uniform float uSwirlRate;     // Subtle celestial drift rotation
      uniform float uPixelRatio;
      uniform vec2  uResolution;    // Physical framebuffer resolution (width*dpr, height*dpr)
      uniform vec2  uVanishingUv;   // Projected vanishing point in UV (0..1)
      uniform float uAspect;

      uniform vec3  uStar0;
      uniform vec3  uStar1;
      uniform vec3  uStar2;
      uniform vec3  uStar3;

      varying float vAlongPx;
      varying float vAcrossPx;
      varying float vSegLenPx;
      varying float vCoreRadiusPx;
      varying vec3  vColor;
      varying float vAlpha;
      varying float vTwinkle;
      varying float vHasSpike;
      varying float vWarpMix;
      varying float vHeadClipped;
      varying vec2  vDirPx;

      void main() {
        // Density gate for Layer 2 (smooth fade without popping)
        float densityVis = 1.0;
        if (uLayerMode > 0.5 && uLayerMode < 1.5) {
          densityVis = smoothstep(uDensityCutoff, uDensityCutoff - 0.10, aFlags.y);
        }
        if (densityVis < 0.002) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }

        // a. Compute world-space star head (zHead) and trailing tail (zTail = zHead - streakLen)
        //    In Three.js camera looks down -Z; stars move from far -Z (uZMin) toward camera +Z (uZMax).
        float zSpan = max(uZMax - uZMin, 1.0);
        float zHead = uZMin + mod(aCylPos.z + uTravelDist * aMeta.y, zSpan);
        float streakWorldLen = uStretchWorld * aMeta.z;
        float zTail = zHead - streakWorldLen;

        float radius = aCylPos.x;
        float angle = aCylPos.y + uTime * uSwirlRate * (0.45 + 0.55 * aMeta.y);
        float cx = cos(angle) * radius;
        float cy = sin(angle) * radius;

        vec3 worldHead = vec3(cx, cy, zHead);
        vec3 worldTail = vec3(cx, cy, zTail);

        // b. Transform both endpoints into Three.js right-handed view space
        vec3 vHead = (modelViewMatrix * vec4(worldHead, 1.0)).xyz;
        vec3 vTail = (modelViewMatrix * vec4(worldTail, 1.0)).xyz;

        // c. STRICT near-plane clipping in view space (nearZ = -0.35, NEGATIVE!)
        const float nearZ = -0.35;
        if (vHead.z > nearZ && vTail.z > nearZ) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }

        float headClipped = 0.0;
        if (vHead.z > nearZ && vTail.z <= nearZ) {
          float t = clamp((nearZ - vTail.z) / max(vHead.z - vTail.z, 0.0001), 0.0, 1.0);
          vHead = mix(vTail, vHead, t);
          headClipped = 1.0;
        } else if (vTail.z > nearZ && vHead.z <= nearZ) {
          float t = clamp((nearZ - vHead.z) / max(vTail.z - vHead.z, 0.0001), 0.0, 1.0);
          vTail = mix(vHead, vTail, t);
        }

        // d. Project clipped endpoints (both cHead.w > 0 and cTail.w > 0 guaranteed)
        vec4 cHead = projectionMatrix * vec4(vHead, 1.0);
        vec4 cTail = projectionMatrix * vec4(vTail, 1.0);

        vec2 ndcHead = cHead.xy / max(cHead.w, 0.0001);
        vec2 ndcTail = cTail.xy / max(cTail.w, 0.0001);

        // Cull only if both endpoints lie well outside the same screen edge
        if ((ndcHead.x < -1.55 && ndcTail.x < -1.55) || (ndcHead.x > 1.55 && ndcTail.x > 1.55) ||
            (ndcHead.y < -1.55 && ndcTail.y < -1.55) || (ndcHead.y > 1.55 && ndcTail.y > 1.55)) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }

        // e. Convert to centered screen pixel space ([-W/2..W/2], [-H/2..H/2])
        vec2 pxHead = ndcHead * 0.5 * uResolution;
        vec2 pxTail = ndcTail * 0.5 * uResolution;

        // f. Compute segment direction & perpendicular safely (ZERO NaN)
        vec2 deltaPx = pxHead - pxTail;
        float segLenPx = length(deltaPx);
        vec2 dirPx = segLenPx > 0.001 ? (deltaPx / segLenPx) : vec2(1.0, 0.0);
        vec2 perpPx = vec2(-dirPx.y, dirPx.x);

        // g. Visual core radius (physical pixels) & guaranteed AA quad padding
        float depth = max(-vHead.z, 1.0);
        float depthBoost = clamp(95.0 / (depth + 55.0), 0.72, 1.28);

        // Crisp 0.65..1.8 CSS px when idle, narrowing subtly to 0.55..1.15 CSS px when streaking
        float idleCorePx = clamp(aMeta.x * depthBoost, 0.65, 1.80) * uPixelRatio;
        float streakCorePx = clamp(aMeta.x * 0.72 * depthBoost, 0.55, 1.15) * uPixelRatio;
        float streakWeight = smoothstep(0.5 * uPixelRatio, 8.0 * uPixelRatio, segLenPx);
        float coreRadiusPx = mix(idleCorePx, streakCorePx, max(uWarpMix * 0.75, streakWeight));

        // Generous quad padding for diffraction spikes when idle, minimum >= 2.4 * uPixelRatio when streaking
        float idlePad = aFlags.x > 0.5
          ? max(coreRadiusPx * 9.5, 13.5 * uPixelRatio)
          : max(coreRadiusPx * 4.5, 2.6 * uPixelRatio);
        float streakPad = max(coreRadiusPx * 3.2, 2.4 * uPixelRatio);
        float quadPadPx = mix(idlePad, streakPad, streakWeight);

        // Right-handed quad expansion: position.x along dirPx, position.y along perpPx
        float alongPx = mix(-quadPadPx, segLenPx + quadPadPx, position.x + 0.5);
        float acrossPx = position.y * 2.0 * quadPadPx;
        vec2 finalPx = pxTail + dirPx * alongPx + perpPx * acrossPx;

        // Linear screen-space clip position (w = 1.0) for exact pixel interpolation
        gl_Position = vec4(finalPx / (0.5 * uResolution), 0.0, 1.0);

        // Smooth far/near Z wrap fades
        float farFade = smoothstep(uZMin, uZMin + zSpan * 0.24, zHead);
        float nearFade = uLayerMode < 0.5
          ? (1.0 - smoothstep(uZMax - 36.0, uZMax - 2.0, zHead))
          : (1.0 - smoothstep(uZMax - 18.0, uZMax - 1.2, zHead));

        // Gentle radial emergence near vanishing point during warp ONLY (NO idle center hole!)
        float radialEmerge = smoothstep(0.35, 3.8, radius);
        vec2 midUv = mix(ndcTail, ndcHead, 0.65) * 0.5 + 0.5;
        float distVP = length((midUv - uVanishingUv) * vec2(uAspect, 1.0));
        float vpSoft = smoothstep(0.012 + aFlags.w * 0.025, 0.16 + aFlags.w * 0.07, distVP);
        float vpCrowd = 0.45 + 0.55 * smoothstep(0.06, 0.44, distVP);

        float emergenceGate = mix(1.0, radialEmerge * vpSoft * vpCrowd, streakWeight * (uLayerMode < 0.5 ? 0.55 : 0.95));

        // Asynchronous astronomical scintillation + Stage 1 Charge gentle brightening
        float tw1 = sin(uTime * (1.35 + aMeta.y * 1.25) + aMeta.w * 6.2831);
        float tw2 = sin(uTime * (2.75 + aMeta.z * 1.45) + aMeta.w * 15.3);
        float twinkle = 0.72 + 0.28 * (tw1 * 0.65 + tw2 * 0.35);
        float chargeLift = 1.0 + uCharge * (uLayerMode < 0.5 ? 0.30 : 0.42);

        vAlongPx = alongPx;
        vAcrossPx = acrossPx;
        vSegLenPx = segLenPx;
        vCoreRadiusPx = coreRadiusPx;
        vColor = uStar0 * aColorWeights.x
               + uStar1 * aColorWeights.y
               + uStar2 * aColorWeights.z
               + uStar3 * aColorWeights.w;
        vAlpha = farFade * nearFade * emergenceGate * aFlags.z * densityVis * chargeLift;
        vTwinkle = mix(twinkle, 0.92 + 0.08 * tw1, streakWeight);
        vHasSpike = aFlags.x;
        vWarpMix = max(uWarpMix, streakWeight);
        vHeadClipped = headClipped;
        vDirPx = dirPx;
      }
    `;

    const CAPSULE_STAR_FRAG = /* glsl */ `
      precision highp float;

      uniform float uPixelRatio;
      uniform vec3  uHeadTint;

      varying float vAlongPx;
      varying float vAcrossPx;
      varying float vSegLenPx;
      varying float vCoreRadiusPx;
      varying vec3  vColor;
      varying float vAlpha;
      varying float vTwinkle;
      varying float vHasSpike;
      varying float vWarpMix;
      varying float vHeadClipped;
      varying vec2  vDirPx;

      void main() {
        if (vAlpha < 0.002) discard;

        // a. Analytical 2D Capsule SDF distance in exact physical pixels
        float clampedAlong = clamp(vAlongPx, 0.0, vSegLenPx);
        float distPx = length(vec2(vAlongPx - clampedAlong, vAcrossPx));
        // tAlong = 1.0 at leading star head, 0.0 at trailing tail tip
        float tAlong = vSegLenPx > 0.05 ? clamp(clampedAlong / vSegLenPx, 0.0, 1.0) : 1.0;

        // b. Width taper along tail during warp (1.0 at head -> 0.45 at tail)
        float taper = mix(1.0, mix(0.45, 1.0, pow(max(tAlong, 0.0001), 0.60)), vWarpMix);
        float localCore = vCoreRadiusPx * taper;

        // Analytical subpixel AA guarantee: keeps razor-thin streaks silky smooth at any angle
        float effCore = max(localCore, 0.58);
        float aaConservation = clamp(localCore / effCore, 0.48, 1.0);

        // c. Razor-sharp core + tight silk glow
        float core = exp(-pow(distPx / effCore, 2.0)) * aaConservation;
        float halo = 0.22 * exp(-distPx / max(effCore * 2.6, 0.95)) * aaConservation;

        // d. Crisp delicate 4-point astronomical diffraction spikes for bright stars when idle/low-streak
        float spikes = 0.0;
        float spikeMask = 1.0 - smoothstep(0.6 * uPixelRatio, 6.0 * uPixelRatio, vSegLenPx);
        if (vHasSpike > 0.5 && spikeMask > 0.005) {
          vec2 localFromHead = vec2(vAlongPx - vSegLenPx, vAcrossPx);
          // Rotate back to exact screen-aligned axes so spikes never spin
          vec2 screenFromHead = vec2(
            vDirPx.x * localFromHead.x - vDirPx.y * localFromHead.y,
            vDirPx.y * localFromHead.x + vDirPx.x * localFromHead.y
          );
          vec2 cssDelta = screenFromHead / max(uPixelRatio, 1.0);
          // Subtle 12° astrophotography cross orientation
          vec2 rp = mat2(0.978, -0.208, 0.208, 0.978) * cssDelta;
          float spikeSpan = clamp((vCoreRadiusPx / max(uPixelRatio, 1.0)) * 5.2, 4.2, 9.5);
          float spH = exp(-abs(rp.y) * 3.6) * exp(-abs(rp.x) / (spikeSpan * 0.42)) * smoothstep(spikeSpan * 1.25, 0.0, abs(rp.x));
          float spV = exp(-abs(rp.x) * 3.6) * exp(-abs(rp.y) / (spikeSpan * 0.42)) * smoothstep(spikeSpan * 1.25, 0.0, abs(rp.y));
          spikes = (spH + spV) * 0.42 * spikeMask;
        }

        // e. Longitudinal brightness & crisp leading star-head highlight during warp
        float longitudinal = mix(1.0, pow(max(tAlong, 0.0001), 0.85), vWarpMix);
        float distHeadPx = length(vec2(vAlongPx - vSegLenPx, vAcrossPx));
        float headPinpoint = exp(-pow(distHeadPx / max(vCoreRadiusPx * 1.08, 0.72), 2.0))
                           * 0.52 * vWarpMix * (1.0 - vHeadClipped);

        // f. Energy conservation: gently attenuate peak opacity as screen streak length grows
        float lengthAtten = 1.0 / pow(1.0 + vSegLenPx / max(48.0 * uPixelRatio, 1.0), 0.30);

        float shape = ((core + halo) * longitudinal + headPinpoint) * lengthAtten + spikes;
        if (shape < 0.003) discard;

        // Jewel-tone color gradient:
        //   Head gleams crisp ice-white/starlight; trailing filament radiates rich saturated jewel hue
        float headWhiteness = mix(
          clamp(core * 0.58 + spikes * 0.35, 0.0, 0.72),
          clamp(headPinpoint * 0.95 + core * pow(max(tAlong, 0.0001), 2.6) * 0.38, 0.0, 0.75),
          vWarpMix
        );
        vec3 saturatedBody = vColor * mix(1.08, 1.22, vWarpMix);
        vec3 finalColor = mix(saturatedBody, uHeadTint, headWhiteness);

        float gain = mix(1.18, 1.08, vWarpMix);
        gl_FragColor = vec4(finalColor * shape * vAlpha * vTwinkle * gain, 1.0);
      }
    `;

    // ----------------------------------------------------------------------------
    // 2C. Post-Processing Pass 1: High-Threshold Soft-Knee Bright Extract
    //     Keeps idle pinpoint stars 100% razor-sharp!
    // ----------------------------------------------------------------------------
    const BRIGHT_EXTRACT_FRAG = /* glsl */ `
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform float uThreshold;
      uniform float uSoftKnee;
      varying vec2 vUv;

      void main() {
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        float peak = max(col.r, max(col.g, col.b));

        float knee = uThreshold * uSoftKnee + 0.0001;
        float soft = clamp(peak - uThreshold + knee, 0.0, 2.0 * knee);
        soft = (soft * soft) / max(4.0 * knee, 0.0001);
        float contrib = max(soft, peak - uThreshold) / max(peak, 0.0001);

        vec3 extracted = col * clamp(contrib, 0.0, 1.10);
        float exPeak = max(extracted.r, max(extracted.g, extracted.b));
        if (exPeak > 1.35) {
          extracted *= (1.35 + log(1.0 + (exPeak - 1.35)) * 0.42) / exPeak;
        }
        gl_FragColor = vec4(extracted, 1.0);
      }
    `;

    // ----------------------------------------------------------------------------
    // 2D. Post-Processing Pass 2 & 3: Separable 9-Tap Gaussian Blur
    // ----------------------------------------------------------------------------
    const BLUR_FRAG = /* glsl */ `
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform vec2 uDirection;
      uniform vec2 uTexelSize;
      varying vec2 vUv;

      void main() {
        vec2 stepUv = uDirection * uTexelSize;
        vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.22702703;
        sum += texture2D(tDiffuse, clamp(vUv + stepUv * 1.38461538, 0.001, 0.999)).rgb * 0.31621622;
        sum += texture2D(tDiffuse, clamp(vUv - stepUv * 1.38461538, 0.001, 0.999)).rgb * 0.31621622;
        sum += texture2D(tDiffuse, clamp(vUv + stepUv * 3.23076923, 0.001, 0.999)).rgb * 0.07027027;
        sum += texture2D(tDiffuse, clamp(vUv - stepUv * 3.23076923, 0.001, 0.999)).rgb * 0.07027027;
        gl_FragColor = vec4(sum, 1.0);
      }
    `;

    // ----------------------------------------------------------------------------
    // 2E. Crisp-Preserving Final Composite Shader:
    //     - Transparent Gravitational-Lens Radial Distortion Ripples (Breakthrough & Exit)
    //     - ZERO Chromatic Aberration When Idle! Strictly proportional to warp + ripples
    //     - Restrained Dual-Scale Bloom (Tight Star Halo + Gentle Atmospheric Glow)
    //     - Hue-Preserving Soft-Knee Highlight Compression + ACES Filmic Tone Mapping
    //     - Subtle 1/255 Animated Hash Dithering
    // ----------------------------------------------------------------------------
    const COMPOSITE_FRAG = /* glsl */ `
      precision highp float;

      uniform sampler2D tScene;
      uniform sampler2D tBloomTight;
      uniform sampler2D tBloomWide;

      uniform vec2  uCenter;
      uniform float uAspect;
      uniform float uWarp;
      uniform float uFovNorm;
      uniform float uBloomStrength;
      uniform float uRippleScale;
      uniform vec2  uRipple1; // (progress 0..1, strength)
      uniform vec2  uRipple2; // (progress 0..1, strength)
      uniform vec3  uAccentColor;
      uniform float uTime;
      uniform vec2 uHoleCenter;
      uniform float uHoleRadius;
      uniform float uHoleOpacity;

      varying vec2 vUv;

      void evalRipple(
        vec2 ripple,
        float dist,
        vec2 radialUvDir,
        inout vec2 refractUv,
        inout vec2 chromaUv,
        inout float crestSheen
      ) {
        float prog = ripple.x;
        float str  = ripple.y * uRippleScale;
        if (str < 0.001 || prog <= 0.001 || prog >= 0.999) return;

        float ringR = prog * 1.48;
        float width = 0.044 + prog * 0.056;
        float d = dist - ringR;
        float normD = d / max(width, 0.001);

        float fadeIn  = smoothstep(0.0, 0.08, prog);
        float fadeOut = 1.0 - smoothstep(0.65, 1.0, prog);
        float gauss   = exp(-normD * normD);
        float env     = gauss * fadeIn * fadeOut * str;

        // Subtle transparent gravitational refraction wave
        refractUv  += -radialUvDir * (normD * env * 0.025);
        chromaUv   += radialUvDir * (env * 0.0105);
        crestSheen += gauss * gauss * fadeIn * fadeOut * str * 0.038;
      }

      // Hue-preserving soft-knee highlight compression prevents dense streak overlap from turning flat white
      vec3 softKneeCompress(vec3 col, float knee, float ceiling) {
        float peak = max(col.r, max(col.g, col.b));
        if (peak <= knee) return col;
        float excess = peak - knee;
        float range = max(ceiling - knee, 0.001);
        float compressed = knee + range * (1.0 - exp(-excess / range));
        return col * (compressed / max(peak, 0.0001));
      }

      vec3 acesPerChannel(vec3 x) {
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        return clamp((x * (a * x + b)) / max(x * (c * x + d) + e, vec3(0.0001)), 0.0, 1.0);
      }

      vec3 acesHuePreserve(vec3 col) {
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float mappedLuma = (luma * (2.51 * luma + 0.03)) / max(luma * (2.43 * luma + 0.59) + 0.14, 0.0001);
        vec3 hueCol  = clamp(col * (mappedLuma / max(luma, 0.0001)), 0.0, 1.0);
        vec3 filmCol = acesPerChannel(col);
        return clamp(mix(filmCol, hueCol, 0.68), 0.0, 1.0);
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec2 uvOffset = vUv - uCenter;
        vec2 aspectVec = uvOffset * vec2(uAspect, 1.0);
        float dist = length(aspectVec);

        vec2 radialAspect = dist > 0.0001 ? (aspectVec / dist) : vec2(0.0);
        vec2 radialUvDir  = vec2(radialAspect.x / max(uAspect, 0.001), radialAspect.y);

        // 1) Gentle peripheral lens curvature synced strictly to wide warp FOV (ZERO when idle)
        float lensPull = uFovNorm * 0.032 * smoothstep(0.16, 0.96, dist);
        vec2 baseUv = uCenter + uvOffset * (1.0 - lensPull * dist * dist);

        // 2) Transparent Gravitational-Lens Refraction Ripples
        vec2 refractUv = vec2(0.0);
        vec2 rippleChroma = vec2(0.0);
        float crestSheen = 0.0;

        evalRipple(uRipple1, dist, radialUvDir, refractUv, rippleChroma, crestSheen);
        evalRipple(uRipple2, dist, radialUvDir, refractUv, rippleChroma, crestSheen);

        vec2 sampleUv = baseUv + refractUv;

        // Gravitational lensing: bend light from the V5 starfield around a localized event horizon.
        vec2 h = (vUv - uHoleCenter) * vec2(uAspect, 1.0);
        float hd = length(h);
        float hr = max(uHoleRadius, 0.001);
        float lensBand = exp(-pow((hd - hr * 1.15) / (hr * 0.47), 2.0));
        vec2 hdir = hd > 0.00001 ? h / hd : vec2(0.0);
        sampleUv += vec2(hdir.x / max(uAspect, 0.001), hdir.y)
                  * hr * 0.20 * lensBand * uHoleOpacity;

        // 3) Radial RGB Chromatic Aberration STRICTLY proportional to warp & ripples (0.0 when idle!)
        float edgeMask = smoothstep(0.28, 0.98, dist);
        vec2 warpChroma = radialUvDir * (edgeMask * edgeMask * 0.0038 * uWarp);
        vec2 totalChroma = warpChroma + rippleChroma;

        vec3 sceneCol;
        if (dot(totalChroma, totalChroma) > 1e-10) {
          sceneCol.r = texture2D(tScene, clamp(sampleUv + totalChroma, 0.001, 0.999)).r;
          sceneCol.g = texture2D(tScene, clamp(sampleUv, 0.001, 0.999)).g;
          sceneCol.b = texture2D(tScene, clamp(sampleUv - totalChroma, 0.001, 0.999)).b;
        } else {
          // Exact 1:1 pixel tap when idle -> 100% razor-sharp astrophotography
          sceneCol = texture2D(tScene, (uHoleOpacity > 0.001 && hd < hr * 3.0)
            ? clamp(sampleUv, 0.001, 0.999) : vUv).rgb;
        }

        // Preserve rich jewel tones when multiple bright streams overlap
        sceneCol = softKneeCompress(sceneCol, 0.96, 2.25);

        // 4) Restrained Dual-Scale Bloom (tight crisp star halo + subtle wide glow)
        vec2 bloomUv = clamp(baseUv + refractUv * 0.65, 0.001, 0.999);
        vec3 bloomTight = texture2D(tBloomTight, bloomUv).rgb;
        vec3 bloomWide  = texture2D(tBloomWide, bloomUv).rgb;
        float bloomScale = uBloomStrength * mix(0.62, 1.0, uWarp);
        vec3 hdrCol = sceneCol + (bloomTight * 0.56 + bloomWide * 0.36) * bloomScale;

        hdrCol += mix(uAccentColor, vec3(0.95, 0.98, 1.0), 0.30) * crestSheen;

        // 5) Subtle dark cinematic vignette
        float vignette = 1.0 - smoothstep(0.52, 1.46, dist * 0.94);
        hdrCol *= mix(0.78, 1.0, vignette);

        // 6) Hue-preserving ACES Filmic Tone Mapping + Gamma
        vec3 mapped = acesHuePreserve(hdrCol * 1.02);
        mapped = pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.2));

        // 7) Subtle 1/255 animated dithering eliminates dark-sky color banding
        float dither = (hash12(gl_FragCoord.xy + fract(uTime * 1.618) * 257.0) - 0.5) / 255.0 * 1.6;
        mapped = clamp(mapped + dither, 0.0, 1.0);

        // Physical silhouette, photon ring and warm/cool Doppler-inspired accretion glow.
        float horizon = 1.0 - smoothstep(hr * .73, hr * .91, hd);
        float photon = exp(-pow((hd - hr * 1.035) / (hr * .105), 2.0));
        float disk = exp(-pow((hd - hr * 1.30) / (hr * .18), 2.0));
        float angle = atan(h.y, h.x);
        vec3 photonColor = mix(vec3(.42,.72,1.0), vec3(1.0,.75,.45), smoothstep(-.8,1.3,sin(angle+1.2)));
        mapped *= 1.0 - horizon * .995 * uHoleOpacity;
        mapped += (photonColor * photon * .23 + vec3(.16,.38,.64) * disk * .08)
               * uHoleOpacity;
        gl_FragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
      }
    `;

    // ============================================================================
    // 3. GEOMETRY & SPECTRAL DISTRIBUTION HELPERS
    // ============================================================================
    function writeSpectralWeights(arr, idx, bias = [0.36, 0.34, 0.19, 0.11]) {
      const r = Math.random();
      let primary = 0;
      if (r < bias[0]) primary = 0;
      else if (r < bias[0] + bias[1]) primary = 1;
      else if (r < bias[0] + bias[1] + bias[2]) primary = 2;
      else primary = 3;

      const secondary = (primary + (Math.random() < 0.5 ? 1 : 3)) % 4;
      const blend = 0.76 + Math.random() * 0.24;

      const w = [0, 0, 0, 0];
      w[primary] = blend;
      w[secondary] = 1.0 - blend;

      arr[idx * 4 + 0] = w[0];
      arr[idx * 4 + 1] = w[1];
      arr[idx * 4 + 2] = w[2];
      arr[idx * 4 + 3] = w[3];
    }

    // Build clean standalone unit quad InstancedBufferGeometry (position.x/y in [-0.5, 0.5])
    function createCleanInstancedQuadGeometry(instanceCount) {
      const geo = new THREE.InstancedBufferGeometry();
      const positions = new Float32Array([
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0,
        -0.5,  0.5, 0.0,
      ]);
      const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.instanceCount = instanceCount;
      return geo;
    }

    // ============================================================================
    // 4. APPLICATION BOOTSTRAP & THREE-LAYER DYNAMIC ENGINE
    // ============================================================================
    function showError(msg) {
      window.__COSMOS_ERROR__ = msg || 'WebGL initialization failed';
      document.body.classList.add('cosmos-fallback');
      const fallbackGate = document.getElementById('warp-trigger-btn');
      if (fallbackGate) fallbackGate.addEventListener('click', () => window.location.assign('/PhotoGallery/galaxy/'), { once: true });
      console.error('[Cosmos Home] WebGL initialization failed:', window.__COSMOS_ERROR__);
    }

    function initApp() {
      const canvas = document.getElementById('cosmos-canvas');
      let renderer;

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: false,
        });
      } catch (err) {
        showError('WebGL 上下文创建失败：' + (err?.message || '未知错误'));
        return;
      }

      const testMode = window.__COSMOS_TEST_MODE__ === true;
      const getDPR = () => Math.min(window.devicePixelRatio || 1, testMode ? 1 : (window.innerWidth < 700 ? 1.5 : 2));
      renderer.setPixelRatio(getDPR());
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

      // Safe HalfFloat render target detection with automatic 8-bit fallback
      const isWebGL2 = renderer.capabilities.isWebGL2;
      const supportsHalfFloat = isWebGL2
        ? Boolean(renderer.extensions.get('EXT_color_buffer_float') || renderer.extensions.get('EXT_color_buffer_half_float'))
        : Boolean(renderer.extensions.get('EXT_color_buffer_half_float'));
      const rtType = supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;

      function createRT(w, h) {
        return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
          type: rtType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          wrapS: THREE.ClampToEdgeWrapping,
          wrapT: THREE.ClampToEdgeWrapping,
          depthBuffer: false,
          stencilBuffer: false,
        });
      }

      const initW = Math.max(1, Math.floor(window.innerWidth * getDPR()));
      const initH = Math.max(1, Math.floor(window.innerHeight * getDPR()));
      const rtScene = createRT(initW, initH);
      const rtBloomHalfA = createRT(Math.floor(initW * 0.5), Math.floor(initH * 0.5));
      const rtBloomHalfB = createRT(Math.floor(initW * 0.5), Math.floor(initH * 0.5));
      const rtBloomQuarterA = createRT(Math.floor(initW * 0.25), Math.floor(initH * 0.25));
      const rtBloomQuarterB = createRT(Math.floor(initW * 0.25), Math.floor(initH * 0.25));

      const disposables = [rtScene, rtBloomHalfA, rtBloomHalfB, rtBloomQuarterA, rtBloomQuarterB];

      // --------------------------------------------------------------------------
      // Main 3D Scene & Perspective Camera (Centered at Origin Looking Down -Z)
      // --------------------------------------------------------------------------
      const BASE_FOV = 54;
      const CHARGE_FOV = 46;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 1000);
      camera.position.set(0, 0, 0);

      const resolutionVec = new THREE.Vector2(initW, initH);
      const vanishingUvVec = new THREE.Vector2(0.5, 0.5);
      const starBudget = testMode ? 0.22 : (window.innerWidth < 700 ? 0.62 : 1.0);

      // --------------------------------------------------------------------------
      // Backdrop: Deep Velvet Nebula Sky Dome + Translucent Spacetime Silk Veil
      // --------------------------------------------------------------------------
      const backdropUniforms = {
        uTime: { value: 0 },
        uDrift: { value: 0 },
        uFlow: { value: 0 },
        uWarp: { value: 0 },
        uVeilOpacity: { value: 0 },
        uAspect: { value: window.innerWidth / Math.max(window.innerHeight, 1) },
        uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(BASE_FOV * 0.5)) },
        uVanishingOffset: { value: new THREE.Vector2(0, 0) },
        uCamRight: { value: new THREE.Vector3(1, 0, 0) },
        uCamUp: { value: new THREE.Vector3(0, 1, 0) },
        uCamForward: { value: new THREE.Vector3(0, 0, -1) },
        uSkyDeep: { value: liveColors.skyDeep },
        uSkyMid: { value: liveColors.skyMid },
        uNebulaA: { value: liveColors.nebulaA },
        uNebulaB: { value: liveColors.nebulaB },
        uVeilA: { value: liveColors.veilA },
        uVeilB: { value: liveColors.veilB },
        uVpGlow: { value: liveColors.vpGlow },
      };

      const backdropGeo = new THREE.PlaneGeometry(2, 2);
      const backdropMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: COSMOS_BACKDROP_FRAG,
        uniforms: backdropUniforms,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
      backdropMesh.frustumCulled = false;
      backdropMesh.renderOrder = -100;
      scene.add(backdropMesh);
      disposables.push(backdropGeo, backdropMat);

      // --------------------------------------------------------------------------
      // Factory for Analytical 2D Capsule SDF Star/Streak Layers
      // --------------------------------------------------------------------------
      function createCapsuleStarLayer({
        count,
        zMin,
        zMax,
        layerMode,
        swirlRate,
        renderOrder,
        populate,
      }) {
        const geo = createCleanInstancedQuadGeometry(count);
        const cylPos = new Float32Array(count * 3);
        const meta = new Float32Array(count * 4);
        const flags = new Float32Array(count * 4);
        const weights = new Float32Array(count * 4);

        const zSpan = zMax - zMin;
        populate(cylPos, meta, flags, weights, count, zSpan);

        geo.setAttribute('aCylPos', new THREE.InstancedBufferAttribute(cylPos, 3));
        geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 4));
        geo.setAttribute('aFlags', new THREE.InstancedBufferAttribute(flags, 4));
        geo.setAttribute('aColorWeights', new THREE.InstancedBufferAttribute(weights, 4));

        const uniforms = {
          uTime: { value: 0 },
          uTravelDist: { value: 0 },
          uZMin: { value: zMin },
          uZMax: { value: zMax },
          uStretchWorld: { value: 0 },
          uWarpMix: { value: 0 },
          uCharge: { value: 0 },
          uDensityCutoff: { value: 1.0 },
          uLayerMode: { value: layerMode },
          uSwirlRate: { value: swirlRate },
          uPixelRatio: { value: getDPR() },
          uResolution: { value: resolutionVec },
          uVanishingUv: { value: vanishingUvVec },
          uAspect: { value: window.innerWidth / Math.max(window.innerHeight, 1) },
          uStar0: { value: liveColors.star0 },
          uStar1: { value: liveColors.star1 },
          uStar2: { value: liveColors.star2 },
          uStar3: { value: liveColors.star3 },
          uHeadTint: { value: liveColors.headTint },
        };

        const mat = new THREE.ShaderMaterial({
          vertexShader: CAPSULE_STAR_VERT,
          fragmentShader: CAPSULE_STAR_FRAG,
          uniforms,
          side: THREE.DoubleSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = renderOrder;
        scene.add(mesh);
        disposables.push(geo, mat);

        return { mesh, uniforms };
      }

      // --------------------------------------------------------------------------
      // LAYER 1: Deep-Field Dynamic Starfield (3,600 stars, Z in [-420, -10])
      //          Covers full 115° FOV; continuously streams forward at ~0.24x speed
      //          and stretches into ultra-fine distant light threads throughout warp!
      // --------------------------------------------------------------------------
      const layer1Deep = createCapsuleStarLayer({
        count: Math.round(3600 * starBudget),
        zMin: -420,
        zMax: -10,
        layerMode: 0.0,
        swirlRate: 0.0022,
        renderOrder: -30,
        populate(cylPos, meta, flags, weights, count, zSpan) {
          for (let i = 0; i < count; i++) {
            // Stratified radial spread guarantees crisp dense starfield across both 46° and 115° FOV
            const zone = Math.random();
            let radius;
            if (zone < 0.28) {
              radius = 0.8 + Math.pow(Math.random(), 0.72) * 58.0;
            } else if (zone < 0.68) {
              radius = 58.0 + Math.pow(Math.random(), 0.85) * 195.0;
            } else {
              radius = 253.0 + Math.pow(Math.random(), 0.90) * 340.0;
            }

            const angle = Math.random() * Math.PI * 2.0;
            const zInit = Math.random() * zSpan;

            cylPos[i * 3 + 0] = radius;
            cylPos[i * 3 + 1] = angle;
            cylPos[i * 3 + 2] = zInit;

            // Brightest ~7% get crisp delicate 4-point diffraction spikes when idle
            const hasSpike = Math.random() < 0.07 ? 1.0 : 0.0;
            const idleCoreCssPx = hasSpike > 0.5
              ? (1.15 + Math.pow(Math.random(), 1.8) * 0.60)
              : (0.65 + Math.pow(Math.random(), 2.5) * 0.58);
            const speedMult = 0.78 + Math.random() * 0.48;
            const tailScale = 0.55 + Math.random() * 0.85;
            const phase = Math.random();

            meta[i * 4 + 0] = idleCoreCssPx;
            meta[i * 4 + 1] = speedMult;
            meta[i * 4 + 2] = tailScale;
            meta[i * 4 + 3] = phase;

            const magBrightness = hasSpike > 0.5
              ? (0.78 + Math.random() * 0.34)
              : (0.28 + Math.pow(Math.random(), 1.7) * 0.56);

            flags[i * 4 + 0] = hasSpike;
            flags[i * 4 + 1] = Math.random();
            flags[i * 4 + 2] = magBrightness;
            flags[i * 4 + 3] = Math.random();

            writeSpectralWeights(weights, i, [0.35, 0.34, 0.19, 0.12]);
          }
        },
      });

      // --------------------------------------------------------------------------
      // LAYER 2: Main Luminous Starlight Streams (2,800 stars, Z in [-280, 0])
      //          Individual speed multipliers 0.72..1.55; NO hard circular cutout!
      // --------------------------------------------------------------------------
      const layer2Main = createCapsuleStarLayer({
        count: Math.round(2800 * starBudget),
        zMin: -280,
        zMax: 0,
        layerMode: 1.0,
        swirlRate: 0.0045,
        renderOrder: 10,
        populate(cylPos, meta, flags, weights, count, zSpan) {
          for (let i = 0; i < count; i++) {
            // Smooth distribution all the way toward center (no ugly black hole cutout!)
            const u = Math.random();
            const radius = 0.25 + Math.pow(u, 0.76) * 96.0;
            const angle = Math.random() * Math.PI * 2.0;
            const zInit = Math.random() * zSpan;

            cylPos[i * 3 + 0] = radius;
            cylPos[i * 3 + 1] = angle;
            cylPos[i * 3 + 2] = zInit;

            const hasSpike = Math.random() < 0.085 ? 1.0 : 0.0;
            const idleCoreCssPx = hasSpike > 0.5
              ? (1.28 + Math.pow(Math.random(), 1.7) * 0.52)
              : (0.72 + Math.pow(Math.random(), 2.1) * 0.72);
            const speedMult = 0.72 + Math.random() * 0.83; // 0.72 to 1.55
            const tailScale = 0.62 + Math.random() * 0.90;
            const phase = Math.random();

            meta[i * 4 + 0] = idleCoreCssPx;
            meta[i * 4 + 1] = speedMult;
            meta[i * 4 + 2] = tailScale;
            meta[i * 4 + 3] = phase;

            const magBrightness = hasSpike > 0.5
              ? (0.86 + Math.random() * 0.30)
              : (0.42 + Math.pow(Math.random(), 1.5) * 0.55);

            flags[i * 4 + 0] = hasSpike;
            flags[i * 4 + 1] = i / count; // Uniform rank for smooth density slider
            flags[i * 4 + 2] = magBrightness;
            flags[i * 4 + 3] = Math.random();

            writeSpectralWeights(weights, i, [0.38, 0.33, 0.18, 0.11]);
          }
        },
      });

      // --------------------------------------------------------------------------
      // LAYER 3: Peripheral High-Speed Flyby Threads (320 stars, radius 14..58)
      //          Crisp pinpoint stars when idle; sweeping 2.1x peripheral streaks at warp!
      // --------------------------------------------------------------------------
      const layer3Flyby = createCapsuleStarLayer({
        count: Math.round(320 * starBudget),
        zMin: -240,
        zMax: 0,
        layerMode: 2.0,
        swirlRate: 0.0065,
        renderOrder: 20,
        populate(cylPos, meta, flags, weights, count, zSpan) {
          for (let i = 0; i < count; i++) {
            const radius = 14.0 + Math.pow(Math.random(), 0.85) * 44.0;
            const angle = Math.random() * Math.PI * 2.0;
            const zInit = Math.random() * zSpan;

            cylPos[i * 3 + 0] = radius;
            cylPos[i * 3 + 1] = angle;
            cylPos[i * 3 + 2] = zInit;

            const hasSpike = Math.random() < 0.06 ? 1.0 : 0.0;
            const idleCoreCssPx = 0.92 + Math.random() * 0.62;
            const speedMult = 1.85 + Math.random() * 0.50; // ~2.1x main speed
            const tailScale = 0.88 + Math.random() * 0.82;
            const phase = Math.random();

            meta[i * 4 + 0] = idleCoreCssPx;
            meta[i * 4 + 1] = speedMult;
            meta[i * 4 + 2] = tailScale;
            meta[i * 4 + 3] = phase;

            flags[i * 4 + 0] = hasSpike;
            flags[i * 4 + 1] = Math.random();
            flags[i * 4 + 2] = 0.62 + Math.random() * 0.40;
            flags[i * 4 + 3] = Math.random();

            writeSpectralWeights(weights, i, [0.40, 0.32, 0.16, 0.12]);
          }
        },
      });

      // --------------------------------------------------------------------------
      // Crisp-Preserving Native HDR Post-Processing Pipeline (Zero External Addons)
      // --------------------------------------------------------------------------
      const postScene = new THREE.Scene();
      const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const postGeo = new THREE.PlaneGeometry(2, 2);

      const brightMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: BRIGHT_EXTRACT_FRAG,
        uniforms: {
          tDiffuse: { value: rtScene.texture },
          uThreshold: { value: supportsHalfFloat ? 0.90 : 0.72 },
          uSoftKnee: { value: 0.42 },
        },
        depthTest: false,
        depthWrite: false,
      });

      const blurUniforms = {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uTexelSize: { value: new THREE.Vector2(1 / rtBloomHalfA.width, 1 / rtBloomHalfA.height) },
      };

      const blurMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: BLUR_FRAG,
        uniforms: blurUniforms,
        depthTest: false,
        depthWrite: false,
      });

      const compositeUniforms = {
        tScene: { value: rtScene.texture },
        tBloomTight: { value: rtBloomHalfA.texture },
        tBloomWide: { value: rtBloomQuarterA.texture },
        uCenter: { value: vanishingUvVec },
        uAspect: { value: window.innerWidth / Math.max(window.innerHeight, 1) },
        uWarp: { value: 0 },
        uFovNorm: { value: 0 },
        uBloomStrength: { value: params.bloomGlow },
        uRippleScale: { value: params.rippleStrength },
        uRipple1: { value: new THREE.Vector2(0, 0) },
        uRipple2: { value: new THREE.Vector2(0, 0) },
        uAccentColor: { value: liveColors.veilB },
        uTime: { value: 0 },
        uHoleCenter: { value: new THREE.Vector2(.65, .58) },
        uHoleRadius: { value: .065 },
        uHoleOpacity: { value: 0 },
      };

      const compositeMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: COMPOSITE_FRAG,
        uniforms: compositeUniforms,
        depthTest: false,
        depthWrite: false,
      });

      const postQuad = new THREE.Mesh(postGeo, brightMat);
      postScene.add(postQuad);
      disposables.push(postGeo, brightMat, blurMat, compositeMat);

      // ==========================================================================
      // 5. ASYMMETRIC 4-STAGE WARP RHYTHM (10.5s AUTO + MANUAL HOLD SPACE/CANVAS)
      // ==========================================================================
      // Test-only acceleration is enabled exclusively by the browser smoke harness.
      const warpTimeScale = testMode ? 0.02 : 1.0;
      const STAGE_DUR = {
        CHARGE: 1.5 * warpTimeScale,       // Production: 1.5s
        BREAKTHROUGH: 1.3 * warpTimeScale, // Production: 1.3s
        CRUISE: 4.6 * warpTimeScale,       // Production: 4.6s
        DECEL: 3.1 * warpTimeScale,        // Production: 3.1s
      };
      const TOTAL_AUTO_DUR = STAGE_DUR.CHARGE + STAGE_DUR.BREAKTHROUGH + STAGE_DUR.CRUISE + STAGE_DUR.DECEL;

      const clamp01 = (x) => Math.min(1, Math.max(0, x));
      const smoothQuint = (x) => {
        const t = clamp01(x);
        return t * t * t * (t * (t * 6 - 15) + 10);
      };
      const easeOutExpo = (x) => {
        const t = clamp01(x);
        return t >= 1 ? 1 : 1 - Math.pow(2, -9 * t);
      };
      const easeInOutCubic = (x) => {
        const t = clamp01(x);
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const ripples = [
        { active: false, progress: 0, strength: 0, speed: 0.72 },
        { active: false, progress: 0, strength: 0, speed: 0.64 },
      ];

      function triggerRipple(slot, strength = 1.0, speed = 0.72) {
        const r = ripples[slot];
        r.active = true;
        r.progress = 0.002;
        r.strength = strength;
        r.speed = speed;
      }

      const warp = {
        stage: 'IDLE', // 'IDLE' | 'CHARGE' | 'BREAKTHROUGH' | 'CRUISE' | 'DECEL'
        mode: 'NONE',  // 'NONE' | 'AUTO' | 'MANUAL'
        stageTime: 0,
        totalAutoTime: 0,

        firedEntryRipple: false,
        firedExitRipple: false,
        switchedRealmThisJump: false,
        pendingRealmIndex: 0,

        decelStartWarp: 1,
        decelStartStretch: 1,
        decelStartFov: DEFAULTS.maxFov,
        decelStartVeil: 1,

        spaceHeld: false,
        pointerHeld: false,

        warpIntensity: 0,
        chargeIntensity: 0,
        streakNorm: 0,
        veilEnv: 0,
        fov: BASE_FOV,

        // Continuous forward travel accumulators for all 3 dynamic star layers
        deepTravel: 0,
        mainTravel: 0,
        flybyTravel: 0,
        veilFlow: 0,
        nebulaDrift: 0,

        // Smooth pointer parallax with inertia
        pointerTarget: new THREE.Vector2(0, 0),
        pointerSmooth: new THREE.Vector2(0, 0),
      };

      // ==========================================================================
      // 6. MINIMAL CHINESE HUD & INTERACTION BINDINGS
      // ==========================================================================
      const elTopLeftStatus = document.getElementById('top-left-status');
      const elPhaseDot = document.getElementById('phase-dot');
      const elPhaseIndicator = document.getElementById('phase-indicator');
      const elRealmBadgeInner = document.getElementById('realm-badge-inner');
      const elRealmZh = document.getElementById('realm-name-zh');
      const elRealmEn = document.getElementById('realm-name-en');

      const elWarpBtn = document.getElementById('warp-trigger-btn');
      const elPillDot = document.getElementById('pill-dot');
      const elPillLabel = document.getElementById('pill-label');
      const elProgressBar = document.getElementById('warp-progress-bar');
      const elBlackHole = document.getElementById('blackhole-gate');
      const elRocket = document.querySelector('.rocket-float');
      let launchStart = 0;
      const launchDurationMs = testMode ? 170 : 1700;

      const elHideUiBtn = document.getElementById('hide-ui-btn');
      const elRestoreUiBtn = document.getElementById('restore-ui-btn');
      const elToggleParamsBtn = document.getElementById('toggle-params-btn');
      const elParamsDrawer = document.getElementById('params-drawer');
      const elResetBtn = document.getElementById('reset-params-btn');
      const elAutoRealmBtn = document.getElementById('auto-realm-toggle');
      const elAutoRealmTrack = document.getElementById('auto-realm-track');
      const realmChips = document.querySelectorAll('.realm-chip');

      let badgeTimer = null;
      let redirectAfterWarp = false;
      window.__COSMOS_READY__ = false;
      window.__COSMOS_WARP_STARTED__ = false;

      function applyRealmUI(index, animateBadge = true) {
        const r = REALMS[index];
        if (!r) return;

        document.documentElement.style.setProperty('--accent', r.cssAccent);
        document.documentElement.style.setProperty('--accent-soft', r.cssSoft);
        document.documentElement.style.setProperty('--accent-faint', r.cssFaint);

        elPhaseDot.style.backgroundColor = r.cssAccent;
        elPhaseDot.style.boxShadow = `0 0 8px ${r.cssAccent}`;
        elPillDot.style.backgroundColor = r.cssAccent;
        elPillDot.style.boxShadow = `0 0 10px ${r.cssAccent}`;

        realmChips.forEach((chip) => {
          chip.classList.toggle('active', Number(chip.dataset.realm) === index);
        });

        if (animateBadge) {
          elRealmBadgeInner.classList.add('is-switching');
          clearTimeout(badgeTimer);
          badgeTimer = setTimeout(() => {
            elRealmZh.textContent = r.zh;
            elRealmEn.textContent = r.en;
            elRealmBadgeInner.classList.remove('is-switching');
          }, 280);
        } else {
          elRealmZh.textContent = r.zh;
          elRealmEn.textContent = r.en;
        }
      }

      function selectRealm(index, immediateBadge = true) {
        params.realmIndex = ((index % REALMS.length) + REALMS.length) % REALMS.length;
        if (immediateBadge) {
          applyRealmUI(params.realmIndex, true);
        } else {
          realmChips.forEach((chip) => {
            chip.classList.toggle('active', Number(chip.dataset.realm) === params.realmIndex);
          });
        }
      }

      function beginWarp(mode) {
        warp.mode = mode;
        warp.stage = 'CHARGE';
        warp.stageTime = 0;
        warp.totalAutoTime = 0;
        warp.firedEntryRipple = false;
        warp.firedExitRipple = false;
        warp.switchedRealmThisJump = false;
        warp.pendingRealmIndex = (params.realmIndex + 1) % REALMS.length;
      }

      function enterDecel() {
        if (warp.stage === 'DECEL' || warp.stage === 'IDLE') return;
        if (params.autoSwitchRealm && !warp.switchedRealmThisJump && warp.warpIntensity > 0.35) {
          warp.switchedRealmThisJump = true;
          selectRealm(warp.pendingRealmIndex, false);
        }
        warp.stage = 'DECEL';
        warp.stageTime = 0;
        warp.firedExitRipple = false;
        warp.decelStartWarp = Math.max(warp.warpIntensity, 0.25);
        warp.decelStartStretch = Math.max(warp.streakNorm, 0.25);
        warp.decelStartFov = warp.fov;
        warp.decelStartVeil = warp.veilEnv;
      }

      elWarpBtn.addEventListener('click', () => {
        if (warp.stage !== 'IDLE' || redirectAfterWarp) return;
        redirectAfterWarp = true;
        window.__COSMOS_WARP_STARTED__ = true;
        elWarpBtn.disabled = true;
        elWarpBtn.setAttribute('aria-busy', 'true');

        // A curved rocket approach is staged before the V5 star-warp tunnel.
        const rocketRect = elRocket.getBoundingClientRect();
        const holeRect = elBlackHole.getBoundingClientRect();
        const rocketCx = rocketRect.left + rocketRect.width * .5;
        const rocketCy = rocketRect.top + rocketRect.height * .48;
        const holeCx = holeRect.left + holeRect.width * .5;
        const holeCy = holeRect.top + holeRect.height * .5;
        elWarpBtn.style.setProperty('--flight-x', (holeCx - rocketCx) + 'px');
        elWarpBtn.style.setProperty('--flight-y', (holeCy - rocketCy) + 'px');
        document.body.style.setProperty('--launch-duration', launchDurationMs + 'ms');
        launchStart = performance.now();
        document.body.classList.add('rocket-launching');
        window.setTimeout(() => {
          document.body.classList.add('rocket-in-warp');
          beginWarp('AUTO');
        }, launchDurationMs);
      });

      function toggleUi() {
        document.body.classList.toggle('ui-hidden');
      }
      elHideUiBtn.addEventListener('click', toggleUi);
      elRestoreUiBtn.addEventListener('click', toggleUi);

      elToggleParamsBtn.addEventListener('click', () => {
        const collapsed = elParamsDrawer.classList.toggle('is-collapsed');
        elToggleParamsBtn.setAttribute('aria-expanded', String(!collapsed));
      });

      realmChips.forEach((chip) => {
        chip.addEventListener('click', () => selectRealm(Number(chip.dataset.realm), true));
      });

      elAutoRealmBtn.addEventListener('click', () => {
        params.autoSwitchRealm = !params.autoSwitchRealm;
        elAutoRealmBtn.setAttribute('aria-checked', String(params.autoSwitchRealm));
        elAutoRealmTrack.dataset.on = String(params.autoSwitchRealm);
      });

      const sliderBindings = [
        { key: 'streakLength', id: 'slider-streak', valId: 'val-streak', fmt: (v) => v.toFixed(2) },
        { key: 'streamDensity', id: 'slider-density', valId: 'val-density', fmt: (v) => v.toFixed(2) },
        { key: 'maxFov', id: 'slider-maxfov', valId: 'val-maxfov', fmt: (v) => `${Math.round(v)}°` },
        { key: 'bgStarFlow', id: 'slider-bgflow', valId: 'val-bgflow', fmt: (v) => `${v.toFixed(2)}x` },
        { key: 'bloomGlow', id: 'slider-bloom', valId: 'val-bloom', fmt: (v) => v.toFixed(2) },
        { key: 'spacetimeVeil', id: 'slider-veil', valId: 'val-veil', fmt: (v) => v.toFixed(2) },
        { key: 'rippleStrength', id: 'slider-ripple', valId: 'val-ripple', fmt: (v) => v.toFixed(2) },
      ];

      sliderBindings.forEach((item) => {
        const slider = document.getElementById(item.id);
        const readout = document.getElementById(item.valId);
        slider.addEventListener('input', () => {
          const val = parseFloat(slider.value);
          params[item.key] = val;
          readout.textContent = item.fmt(val);
        });
      });

      elResetBtn.addEventListener('click', () => {
        Object.assign(params, DEFAULTS);
        applyRealmUI(params.realmIndex, true);
        elAutoRealmBtn.setAttribute('aria-checked', 'true');
        elAutoRealmTrack.dataset.on = 'true';
        sliderBindings.forEach((item) => {
          const slider = document.getElementById(item.id);
          const readout = document.getElementById(item.valId);
          slider.value = String(params[item.key]);
          readout.textContent = item.fmt(params[item.key]);
        });
      });

      // Pointer parallax only. The floating portal is the sole warp trigger.
      function updatePointer(clientX, clientY) {
        const nx = (clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
        const ny = -(clientY / Math.max(window.innerHeight, 1)) * 2 + 1;
        warp.pointerTarget.set(
          THREE.MathUtils.clamp(nx, -1, 1),
          THREE.MathUtils.clamp(ny, -1, 1)
        );
      }

      const onPointerMove = (e) => updatePointer(e.clientX, e.clientY);
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      // 7. RESPONSIVE HiDPI RESIZE & CLEAN RESOURCE DISPOSAL
      // ==========================================================================
      function onResize() {
        const w = window.innerWidth;
        const h = Math.max(window.innerHeight, 1);
        const dpr = getDPR();

        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);

        const rw = Math.max(1, Math.floor(w * dpr));
        const rh = Math.max(1, Math.floor(h * dpr));
        const hw = Math.max(1, Math.floor(rw * 0.5));
        const hh = Math.max(1, Math.floor(rh * 0.5));
        const qw = Math.max(1, Math.floor(rw * 0.25));
        const qh = Math.max(1, Math.floor(rh * 0.25));

        rtScene.setSize(rw, rh);
        rtBloomHalfA.setSize(hw, hh);
        rtBloomHalfB.setSize(hw, hh);
        rtBloomQuarterA.setSize(qw, qh);
        rtBloomQuarterB.setSize(qw, qh);

        resolutionVec.set(rw, rh);
        const aspect = w / h;

        backdropUniforms.uAspect.value = aspect;
        compositeUniforms.uAspect.value = aspect;

        [layer1Deep, layer2Main, layer3Flyby].forEach(({ uniforms }) => {
          uniforms.uAspect.value = aspect;
          uniforms.uPixelRatio.value = dpr;
        });
      }

      window.addEventListener('resize', onResize);

      let rafId = 0;
      const cleanup = () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
        disposables.forEach((d) => d.dispose && d.dispose());
        renderer.dispose();
      };
      window.addEventListener('beforeunload', cleanup);

      // ==========================================================================
      // 8. MAIN 60FPS RENDER LOOP
      // ==========================================================================
      const camRight = new THREE.Vector3();
      const camUp = new THREE.Vector3();
      const camForward = new THREE.Vector3();
      const vanishingWorld = new THREE.Vector3(0, 0, -1200);
      const vanishingNDC = new THREE.Vector3();

      let lastNow = performance.now();
      let elapsed = 0;

      function updateStatusUI(phaseText, pillText, isWarping, progressPct) {
        if (elPhaseIndicator.textContent !== phaseText) elPhaseIndicator.textContent = phaseText;
        // The single visible label remains 星海漫游 throughout the warp.
        const transitionActive = isWarping || redirectAfterWarp;
        elWarpBtn.classList.toggle('is-warping', transitionActive);
        document.body.classList.toggle('is-warping', transitionActive);
        elTopLeftStatus.classList.toggle('is-dimmed', transitionActive);
        elProgressBar.style.width = `${clamp01(progressPct / 100) * 100}%`;
      }

      function animate(now) {
        rafId = requestAnimationFrame(animate);

        const dt = Math.min((now - lastNow) * 0.001, 0.05);
        lastNow = now;
        elapsed += dt;

        // 1) Smooth Star Realm Palette Cross-Fade
        const targetRealm = REALMS[params.realmIndex];
        const colorRate = 1.0 - Math.exp(-dt * 1.4);
        liveColors.skyDeep.lerp(targetRealm.skyDeep, colorRate);
        liveColors.skyMid.lerp(targetRealm.skyMid, colorRate);
        liveColors.nebulaA.lerp(targetRealm.nebulaA, colorRate);
        liveColors.nebulaB.lerp(targetRealm.nebulaB, colorRate);
        liveColors.veilA.lerp(targetRealm.veilA, colorRate);
        liveColors.veilB.lerp(targetRealm.veilB, colorRate);
        liveColors.vpGlow.lerp(targetRealm.vpGlow, colorRate);
        liveColors.star0.lerp(targetRealm.star0, colorRate);
        liveColors.star1.lerp(targetRealm.star1, colorRate);
        liveColors.star2.lerp(targetRealm.star2, colorRate);
        liveColors.star3.lerp(targetRealm.star3, colorRate);
        liveColors.headTint.lerp(targetRealm.headTint, colorRate);

        // 2) Step Asymmetric 4-Stage Warp Rhythm
        let targetWarp = 0;
        let targetCharge = 0;
        let targetStretch = 0;
        let targetVeil = 0;
        let targetFov = BASE_FOV;
        let mainSpeed = 2.8; // Tranquil cosmic drift when idle
        let phaseText = '静谧星海';
        let pillText = '开启空间跃迁';
        let progressPct = 0;

        const heldNow = warp.spaceHeld || warp.pointerHeld;

        if (warp.stage === 'IDLE') {
          targetFov = BASE_FOV;
          mainSpeed = 2.8;
        } else if (warp.stage === 'CHARGE') {
          warp.stageTime += dt;
          if (warp.mode === 'AUTO') warp.totalAutoTime += dt;

          const p = clamp01(warp.stageTime / STAGE_DUR.CHARGE);
          const e = smoothQuint(p);

          targetCharge = e;
          targetWarp = 0.0;
          targetStretch = Math.pow(p, 3.6) * 0.025;
          targetVeil = 0.0;
          targetFov = BASE_FOV - (BASE_FOV - CHARGE_FOV) * e;
          mainSpeed = THREE.MathUtils.lerp(2.8, 0.25, e);

          phaseText = '蓄力收束';
          pillText = '蓄力收束';
          progressPct = warp.mode === 'AUTO' ? (warp.totalAutoTime / TOTAL_AUTO_DUR) * 100 : p * 20;

          if (warp.stageTime >= STAGE_DUR.CHARGE) {
            warp.stage = 'BREAKTHROUGH';
            warp.stageTime = 0;
          }
        } else if (warp.stage === 'BREAKTHROUGH') {
          warp.stageTime += dt;
          if (warp.mode === 'AUTO') warp.totalAutoTime += dt;

          const p = clamp01(warp.stageTime / STAGE_DUR.BREAKTHROUGH);

          if (!warp.firedEntryRipple && warp.stageTime >= 0.04) {
            warp.firedEntryRipple = true;
            triggerRipple(0, 1.0, 0.72);
          }

          const ignite = easeOutExpo(p);
          const fovSweep = easeInOutCubic(p);

          targetCharge = Math.max(0, 1.0 - p * 4.0);
          targetWarp = ignite;
          targetStretch = Math.pow(ignite, 0.90);
          targetVeil = smoothQuint(clamp01((p - 0.12) / 0.88));
          targetFov = CHARGE_FOV + (params.maxFov - CHARGE_FOV) * fovSweep;
          mainSpeed = 0.5 + Math.pow(ignite, 1.32) * 172.0;

          phaseText = '破壁跃迁';
          pillText = '破壁跃迁';
          progressPct = warp.mode === 'AUTO' ? (warp.totalAutoTime / TOTAL_AUTO_DUR) * 100 : 20 + p * 26;

          if (warp.stageTime >= STAGE_DUR.BREAKTHROUGH) {
            warp.stage = 'CRUISE';
            warp.stageTime = 0;
          }
        } else if (warp.stage === 'CRUISE') {
          warp.stageTime += dt;
          if (warp.mode === 'AUTO') warp.totalAutoTime += dt;

          targetCharge = 0.0;
          targetWarp = 1.0;
          targetStretch = 1.0;
          targetVeil = 1.0;
          targetFov = params.maxFov;
          mainSpeed = 172.5;

          const switchMark = warp.mode === 'AUTO' ? (STAGE_DUR.CRUISE * 0.45) : 1.75;
          if (params.autoSwitchRealm && !warp.switchedRealmThisJump && warp.stageTime >= switchMark) {
            warp.switchedRealmThisJump = true;
            selectRealm(warp.pendingRealmIndex, false);
          }

          phaseText = '极速巡航';
          if (warp.mode === 'AUTO') {
            pillText = '极速巡航';
            progressPct = (warp.totalAutoTime / TOTAL_AUTO_DUR) * 100;
            if (warp.stageTime >= STAGE_DUR.CRUISE) {
              enterDecel();
            }
          } else {
            pillText = '持续巡航';
            progressPct = 46 + Math.min(30, warp.stageTime * 4.2);
            if (!heldNow) {
              enterDecel();
            }
          }
        } else if (warp.stage === 'DECEL') {
          warp.stageTime += dt;
          if (warp.mode === 'AUTO') warp.totalAutoTime += dt;

          const p = clamp01(warp.stageTime / STAGE_DUR.DECEL);

          if (!warp.firedExitRipple && warp.stageTime >= 0.08) {
            warp.firedExitRipple = true;
            triggerRipple(1, 0.78, 0.64);
          }

          // Decoupled head deceleration vs tail collapse:
          // Heads stop quickly while tails visibly catch up and collapse into crisp pinpoint stars!
          const headDecel = Math.pow(1.0 - p, 3.15);
          const tailRetract = 1.0 - smoothQuint(clamp01(p / 0.84));

          targetCharge = 0.0;
          targetWarp = warp.decelStartWarp * Math.pow(1.0 - p, 2.05);
          targetStretch = warp.decelStartStretch * tailRetract;
          targetVeil = warp.decelStartVeil * (1.0 - smoothQuint(clamp01(p / 0.58)));

          // Gentle damped elastic FOV settle back to 54°
          const elastic = Math.exp(-p * 4.35) * Math.cos(p * Math.PI * 1.15);
          targetFov = BASE_FOV + (warp.decelStartFov - BASE_FOV) * elastic;

          mainSpeed = 2.8 + (169.5 * warp.decelStartWarp) * headDecel;

          phaseText = '收点抵达';
          pillText = '收点抵达';
          progressPct = warp.mode === 'AUTO' ? clamp01(warp.totalAutoTime / TOTAL_AUTO_DUR) * 100 : 76 + p * 24;

          if (warp.stageTime >= STAGE_DUR.DECEL) {
            warp.stage = 'IDLE';
            warp.mode = 'NONE';
            warp.stageTime = 0;
            if (warp.switchedRealmThisJump) {
              applyRealmUI(params.realmIndex, true);
              warp.switchedRealmThisJump = false;
            }
            if (redirectAfterWarp) {
              redirectAfterWarp = false;
              document.body.classList.add('warp-navigation-pending');
              window.setTimeout(() => {
                try {
                  sessionStorage.setItem('cosmos-to-galaxy-v2', JSON.stringify({
                    version: 2, origin: location.origin, time: Date.now()
                  }));
                } catch (error) { /* Storage may be unavailable; direct navigation still works. */ }
                window.location.assign('/PhotoGallery/galaxy/');
              }, testMode ? 100 : 780);
            }
          }
        }

        // Smooth inertial filtering
        const fastEase = 1.0 - Math.exp(-dt * 10.5);
        const fovEase = 1.0 - Math.exp(-dt * 8.8);
        warp.warpIntensity += (targetWarp - warp.warpIntensity) * fastEase;
        warp.chargeIntensity += (targetCharge - warp.chargeIntensity) * fastEase;
        warp.streakNorm += (targetStretch - warp.streakNorm) * (1.0 - Math.exp(-dt * 11.8));
        warp.veilEnv += (targetVeil - warp.veilEnv) * (1.0 - Math.exp(-dt * 7.2));
        warp.fov += (targetFov - warp.fov) * fovEase;

        // Clean snap to exact 0 when truly idle so idle stars have ZERO stretch & ZERO chromatic aberration
        const cleanWarp = warp.warpIntensity < 0.0008 && warp.stage === 'IDLE' ? 0.0 : warp.warpIntensity;
        const cleanStretch = warp.streakNorm < 0.0005 && warp.stage === 'IDLE' ? 0.0 : warp.streakNorm;

        updateStatusUI(phaseText, pillText, warp.stage !== 'IDLE', progressPct);

        // 3) Advance Gravitational-Lens Ripples
        for (let i = 0; i < 2; i++) {
          const r = ripples[i];
          if (r.active) {
            r.progress += dt * r.speed;
            if (r.progress >= 1.0) {
              r.active = false;
              r.progress = 0;
              r.strength = 0;
            }
          }
        }

        // 4) Advance All 3 Dynamic Star Layers Continuously (ZERO Frozen Background Stars!)
        const deepSpeed = 0.75 + Math.max(0, mainSpeed - 2.8) * params.bgStarFlow;
        warp.deepTravel += deepSpeed * dt;
        warp.mainTravel += mainSpeed * dt;
        warp.flybyTravel += mainSpeed * dt; // Layer 3 per-star speedMult is ~2.1x
        warp.veilFlow += (0.35 + cleanWarp * 5.4) * dt;
        warp.nebulaDrift += (0.05 + cleanWarp * 0.90) * dt;

        // 5) Camera Dynamic FOV & Gentle Smooth Parallax (ZERO Camera Shake!)
        camera.fov = warp.fov;
        camera.updateProjectionMatrix();

        const ptrDamp = 1.0 - Math.exp(-dt * 3.2);
        warp.pointerSmooth.lerp(warp.pointerTarget, ptrDamp);

        const sereneBank = Math.sin(elapsed * 0.32) * 0.018 * cleanWarp;
        const maxLookRad = THREE.MathUtils.degToRad(4.5);

        camera.position.x = warp.pointerSmooth.x * 0.85;
        camera.position.y = warp.pointerSmooth.y * 0.65;
        camera.position.z = 0;
        camera.rotation.order = 'YXZ';
        camera.rotation.y = -warp.pointerSmooth.x * maxLookRad;
        camera.rotation.x = warp.pointerSmooth.y * (maxLookRad * 0.82);
        camera.rotation.z = -warp.pointerSmooth.x * 0.022 + sereneBank;
        camera.updateMatrixWorld();

        camera.matrixWorld.extractBasis(camRight, camUp, camForward);
        camForward.negate();

        // Project true 3D vanishing point into UV & aspect-offset coordinates
        vanishingNDC.copy(vanishingWorld).project(camera);
        const aspect = camera.aspect;
        vanishingUvVec.set(
          THREE.MathUtils.clamp(vanishingNDC.x * 0.5 + 0.5, 0.14, 0.86),
          THREE.MathUtils.clamp(vanishingNDC.y * 0.5 + 0.5, 0.14, 0.86)
        );
        backdropUniforms.uVanishingOffset.value.set(
          (vanishingUvVec.x - 0.5) * aspect,
          vanishingUvVec.y - 0.5
        );

        const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(warp.fov * 0.5));

        // 6) Update Shader Uniforms Across Backdrop & All 3 Dynamic Star Layers
        backdropUniforms.uTime.value = elapsed;
        backdropUniforms.uDrift.value = warp.nebulaDrift;
        backdropUniforms.uFlow.value = warp.veilFlow;
        backdropUniforms.uWarp.value = cleanWarp;
        backdropUniforms.uVeilOpacity.value = warp.veilEnv * params.spacetimeVeil;
        backdropUniforms.uTanHalfFov.value = tanHalfFov;
        backdropUniforms.uCamRight.value.copy(camRight);
        backdropUniforms.uCamUp.value.copy(camUp);
        backdropUniforms.uCamForward.value.copy(camForward);

        // Layer 1: Deep-Field Dynamic Starfield (streams & stretches into ultra-fine distant threads)
        layer1Deep.uniforms.uTime.value = elapsed;
        layer1Deep.uniforms.uTravelDist.value = warp.deepTravel;
        layer1Deep.uniforms.uStretchWorld.value = cleanStretch * 38.0 * params.streakLength * (0.65 + params.bgStarFlow * 1.45);
        layer1Deep.uniforms.uWarpMix.value = cleanWarp;
        layer1Deep.uniforms.uCharge.value = warp.chargeIntensity;

        // Layer 2: Main Luminous Starlight Streams
        layer2Main.uniforms.uTime.value = elapsed;
        layer2Main.uniforms.uTravelDist.value = warp.mainTravel;
        layer2Main.uniforms.uStretchWorld.value = cleanStretch * 96.0 * params.streakLength;
        layer2Main.uniforms.uWarpMix.value = cleanWarp;
        layer2Main.uniforms.uCharge.value = warp.chargeIntensity;
        layer2Main.uniforms.uDensityCutoff.value = params.streamDensity;

        // Layer 3: Peripheral High-Speed Flyby Threads
        layer3Flyby.uniforms.uTime.value = elapsed;
        layer3Flyby.uniforms.uTravelDist.value = warp.flybyTravel;
        layer3Flyby.uniforms.uStretchWorld.value = cleanStretch * 132.0 * params.streakLength;
        layer3Flyby.uniforms.uWarpMix.value = cleanWarp;
        layer3Flyby.uniforms.uCharge.value = warp.chargeIntensity;

        // Final Post-Processing Uniforms
        const fovNorm = clamp01((warp.fov - BASE_FOV) / Math.max(params.maxFov - BASE_FOV, 1));
        compositeUniforms.uWarp.value = cleanWarp;
        compositeUniforms.uFovNorm.value = fovNorm;
        compositeUniforms.uBloomStrength.value = params.bloomGlow;
        compositeUniforms.uRippleScale.value = params.rippleStrength;
        compositeUniforms.uRipple1.value.set(ripples[0].progress, ripples[0].strength);
        compositeUniforms.uRipple2.value.set(ripples[1].progress, ripples[1].strength);
        compositeUniforms.uTime.value = elapsed;
        // Screen-space refraction tracks the actual DOM gate in any viewport.
        const holeBox = elBlackHole.getBoundingClientRect();
        const holeVisible = holeBox.top < innerHeight && holeBox.bottom > 0;
        const approach = launchStart ? smoothQuint(clamp01((now - launchStart) / launchDurationMs)) : 0;
        const warpFade = warp.stage !== 'IDLE'
          ? 1 - smoothQuint(clamp01(warp.totalAutoTime / (STAGE_DUR.CHARGE + .4 * STAGE_DUR.BREAKTHROUGH)))
          : 1;
        compositeUniforms.uHoleCenter.value.set(
          (holeBox.left + holeBox.width * .5) / Math.max(innerWidth, 1),
          1 - (holeBox.top + holeBox.height * .5) / Math.max(innerHeight, 1)
        );
        compositeUniforms.uHoleRadius.value = holeBox.width * (.25 + approach * .13) / Math.max(innerHeight, 1);
        compositeUniforms.uHoleOpacity.value = holeVisible ? warpFade : 0;

        // 7) Execute Multi-Pass Crisp-Preserving HDR Post-Processing Pipeline
        // Pass 1: Render Backdrop + 3 Dynamic Capsule Star Layers -> rtScene
        renderer.setRenderTarget(rtScene);
        renderer.clear();
        renderer.render(scene, camera);

        // Pass 2: High-threshold soft-knee bright extract -> rtBloomHalfA (1/2 res)
        postQuad.material = brightMat;
        renderer.setRenderTarget(rtBloomHalfA);
        renderer.render(postScene, postCamera);

        // Pass 3A: Compact tight star halo Gaussian blur (1/2 res)
        postQuad.material = blurMat;
        blurUniforms.uTexelSize.value.set(1 / rtBloomHalfA.width, 1 / rtBloomHalfA.height);

        blurUniforms.tDiffuse.value = rtBloomHalfA.texture;
        blurUniforms.uDirection.value.set(1.10, 0.0);
        renderer.setRenderTarget(rtBloomHalfB);
        renderer.render(postScene, postCamera);

        blurUniforms.tDiffuse.value = rtBloomHalfB.texture;
        blurUniforms.uDirection.value.set(0.0, 1.10);
        renderer.setRenderTarget(rtBloomHalfA);
        renderer.render(postScene, postCamera);

        // Pass 3B: Gentle wide atmospheric glow blur (1/4 res, 2 iterations)
        blurUniforms.uTexelSize.value.set(1 / rtBloomQuarterA.width, 1 / rtBloomQuarterA.height);

        blurUniforms.tDiffuse.value = rtBloomHalfA.texture;
        blurUniforms.uDirection.value.set(1.60, 0.0);
        renderer.setRenderTarget(rtBloomQuarterB);
        renderer.render(postScene, postCamera);

        blurUniforms.tDiffuse.value = rtBloomQuarterB.texture;
        blurUniforms.uDirection.value.set(0.0, 1.60);
        renderer.setRenderTarget(rtBloomQuarterA);
        renderer.render(postScene, postCamera);

        blurUniforms.tDiffuse.value = rtBloomQuarterA.texture;
        blurUniforms.uDirection.value.set(2.40, 0.0);
        renderer.setRenderTarget(rtBloomQuarterB);
        renderer.render(postScene, postCamera);

        blurUniforms.tDiffuse.value = rtBloomQuarterB.texture;
        blurUniforms.uDirection.value.set(0.0, 2.40);
        renderer.setRenderTarget(rtBloomQuarterA);
        renderer.render(postScene, postCamera);

        // Pass 4: Final Composite to Screen
        postQuad.material = compositeMat;
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCamera);
        if (!window.__COSMOS_READY__) window.__COSMOS_READY__ = true;
      }

      // Initialize UI accent & start animation loop
      applyRealmUI(params.realmIndex, false);
      rafId = requestAnimationFrame(animate);
    }

    if (document.readyState === 'complete') {
      initApp();
    } else {
      window.addEventListener('load', initApp, { once: true });
    }
  