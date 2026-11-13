# Orbital rendering performance

The volume fragment shader was the main bottleneck, including for simple 1s/2p states. The electron cloud uses point sprites and CPU probability sampling; it does not use the volume shader. Solid-lobe rendering was removed at the user's request and is no longer an optimization target.

## Evidence and implemented changes

The original volume marched 112 midpoints across each covered cube ray. It read two RGBA float textures, evaluated angular phases, and accumulated opacity even for simple eigenstates. CPU draw submission for 2p was about 0.12 ms while GPU rendering averaged 18.59 ms. Separate Node sampling measurements for 5,000 points were 0.90 ms median for 2p and 7.46 ms for a coherent pair; those CPU measurements are not browser frame times.

Changes in [volume-material.ts](src/rendering/volume-material.ts):

- Use R32F lookup textures for one basis state and RG32F for two. Keep 4,096 samples and float32 precision. Two eigenstate textures occupy 32 KiB instead of 128 KiB; paired textures use 64 KiB.
- Intersect a conservative support sphere and skip unused indices on the original 112-midpoint lattice. Do not change useful sample spacing or remove faint samples using a density cutoff.
- Replace per-sample angular trigonometry with integer Cartesian complex powers. Skip inactive second-basis work and hoist invariant normalization/opacity factors.
- Retain coherent amplitude addition before computing probability, original phase/sign palettes, and step-length-aware opacity accumulation.
- Keep early ray termination at configurable accumulated alpha 0.985. Internal `reference` quality retains the whole original cube lattice; `optimized` enables conservative clipping.

[OrbitalVolume.tsx](src/rendering/OrbitalVolume.tsx) keeps materials alive across state changes to avoid shader recompilation. No occupancy grid, reduced render resolution, lower texture precision, state-dependent coarser sampling, or new renderer was introduced. The simpler changes produced measurable gains without those costs.

## Recorded measurements

Recorded on Intel UHD Graphics through Chrome/ANGLE D3D11, at an identical 850 × 362 volume drawing buffer. GPU means use 30 valid timer-query samples per case; disjoint queries were checked. Whole-app measurements use two 3.5-second windows at a 1100 × 900 viewport. These are local measurements, not a cross-device FPS guarantee.

| Case | Volume GPU mean, before → after | Whole-app FPS, before → after |
| --- | --- | --- |
| 1s | 20.18 → 4.79 ms | 37.6–38.1 → 140.6–142.3 |
| 2p | 18.59 → 4.97 ms | 36.9–38.0 → 129.2–134.6 |
| 4f | 19.75 → 5.51 ms | 36.5–36.7 → 126.6–126.9 |
| Static coherent pair | 20.09 → 11.00 ms | 35.7–36.6 → 73.9–74.7 |
| Animated coherent pair | 19.91 → 11.00 ms | 35.9–36.1 → 73.7–74.2 |
| Electron cloud control | Separate point renderer | 97.8–144.0 → 143.2–143.5 |

For 2p, GPU median fell from 18.56 to 4.85 ms. Instrumented loop coverage fell from 14.24 million to 5.02 million iterations per frame; surviving rays averaged 75.09 iterations instead of 112. Counts depend on camera and early termination, so sample count alone does not explain the timing difference.

Raw measurements and repeatable runners live in ignored `playwright-report/performance/`: `volume-profile-final.json`, `optimization-app-before.json`, `optimization-app-after.json`, `cpu-audit.json`, `volume-profile.mjs`, and `optimization-app.mjs`. Run benchmarks separately from tests and each other.

These measurements precede the later playback/control/calibration changes, revised electron presets, and smaller orthographic field diagram. Those changes have not been rebenchmarked; the table does not claim their current FPS.

## Particle edge smoothing, 2026-11-13

[electron-sprite.ts](src/rendering/electron-sprite.ts) bakes a radial edge fade into the existing 32×32 texture once per mount. The point shader, texture lookup count, draw-call count, sampling cadence, and geometry remain unchanged. Scaling the alpha-test threshold by material opacity fixes disappearing points below 5%: the threshold now tests near-zero sprite coverage instead of imposing a minimum material opacity. No postprocessing, extra draw passes, or per-frame CPU smoothing was added.

Native Chrome/ANGLE on Intel UHD/D3D11 measured isolated point rendering in a 512×512 buffer at 25% opacity. Each before/after case uses 40 valid, interleaved GPU timer queries with no disjoint samples. The baseline uses the previous hard circular sprite and fixed 0.05 alpha test. Both variants share one shader program and issue one draw call.

| Point size / count | Before GPU mean | After GPU mean |
| --- | --- | --- |
| 4px / 5,000 | 0.271 ms | 0.313 ms |
| 4px / 10,000 | 0.613 ms | 0.710 ms |
| 16px / 10,000 | 1.254 ms | 1.328 ms |
| 40px / 10,000 | 6.618 ms | 6.741 ms |

The measured increase was 0.041–0.123 ms per point-rendering frame. These are isolated GPU timings, not whole-app FPS or a guarantee for other hardware. Pixel probes separately confirmed visible dots at 1%, 2%, and 4%, where the baseline discarded all pixels. At 25% and 100%, a 32px dot has four intermediate edge levels along its horizontal radius instead of one. The Chrome application regression confirms sampling and visible color changes at 1% opacity. Raw data, before/after edge images, and the repeatable runner are under ignored `playwright-report/performance/electron-sprite-profile*` and `electron-edge-*.png`.

## Accuracy and remaining options

Native before/after images differed by at most one RGB level in the recorded cases. Automated WebGL comparisons use the frozen original shader in [volume-reference.ts](e2e/fixtures/volume-reference.ts), covering nodes, high n, complex/real harmonics, coherent cancellation, the four retained volume quantities, camera rotation, brightness, and the reference fallback. Spherical-coordinate volume density was subsequently removed at the user's request. Float-field probes also compare with analytic hydrogen functions. The optimizations retain existing discretization and radial-bound approximations; no new intended visual or physical compromise was introduced.

Coherent volumes still cost about 11 ms on this GPU. Probability sampling, three WebGL contexts, chart updates, and larger drawing buffers can then matter. First workarounds: use a smaller viewport for GPU pressure, or lower sample count/sampling frequency and pause sampling for CPU pressure. Brightness is a visual control; lowering it can delay early termination and is not a reliable speed fix. Reprofile the current build before further changes. Consider on-demand rendering for paused views or a sampling worker only if measurements identify those costs. Add occupancy acceleration or coarser marching only with evidence and image/field validation. Other GPUs, browser engines, physical mobile devices, and visible-window presentation remain unbenchmarked.
