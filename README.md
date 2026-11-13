# Hedione's Atomic Orbital Visualizer

**[Open the interactive visualizer in your browser →](https://hedione.github.io/Atomic-Orbital-Visualizer/)**

An interactive laboratory for hydrogen atomic orbitals, built with React, TypeScript, Three.js, and Vite.

Choose the principal quantum number **n**, orbital angular momentum **ℓ**, and a real orbital orientation. Turn **Real orbital combinations** off to select magnetic quantum number **mℓ** instead. Explore individual orbitals, coherent two-state superpositions, free time evolution, and ideal resonant atomic transitions.

## Three linked views

- **Bohr comparison:** Historical circular orbits with radius n²a₀. These depend only on n and are not quantum electron trajectories.
- **Electron probability cloud:** Independent possible positions of one electron, sampled from the full spatial probability |ψ|² r² sin θ dr dθ dφ. The number of points controls samples, not the number of electrons in the atom.
- **Wavefunction & probability:** A volume of the full radial and angular wavefunction. The 2×2 quantity grid offers wavefunction, probability density, real component, and imaginary component. Adjust **Volume brightness**; radial nodes and coherent interference are included.

Drag any view to orbit, scroll to zoom, and use the camera reset or fullscreen controls. Cameras stay synchronized and allow close inspection inside the orbital volume. Spatial views include a physical scale bar that follows zoom; it measures distances in the screen plane through the view center. The Bohr comparison and probability cloud share the same physical scale per pixel, including after resizing. The Bohr readout shows the actual n²a₀ orbit radius.

## Hydrogen model

The orbital is ψₙℓₘ(r,θ,φ) = Rₙℓ(r)Yℓᵐ(θ,φ). The radial function uses normalized associated Laguerre polynomials and the angular function uses normalized complex spherical harmonics with the Condon–Shortley phase.

Allowed quantum numbers are:

- n = 1, 2, …
- ℓ = 0, …, n − 1
- mℓ = −ℓ, …, +ℓ

Normal mode covers n ≤ 6. **Explore high n** extends the controls to 20; turning it off restores the saved lower-n selections. **Randomize**, Previous, and Next retain valid quantum numbers. The initial state is real 2p<sub>z</sub>.

**Real orbital combinations** starts enabled and switches between complex Lz eigenfunctions and normalized real combinations of the ±mℓ orbitals. The orbital slider and its −/+ buttons cycle through p<sub>x</sub>, p<sub>y</sub>, p<sub>z</sub>, and named real d/f/g orientations. The seven f names are f<sub>z³</sub>, f<sub>x(x²−3y²)</sub>, f<sub>y(3x²−y²)</sub>, f<sub>xyz</sub>, f<sub>z(x²−y²)</sub>, f<sub>xz²</sub>, and f<sub>yz²</sub>. The g labels follow [sisl's documented Cartesian shorthand](https://sisl.readthedocs.io/en/stable/_modules/sisl/_core/orbital.html), including g<sub>z⁴</sub> and g<sub>xyz²</sub>. h and higher angular momenta retain real cosine/sine labels. The basis applies to both superposition components, the cloud, the wavefunction, the charts, and the observables. These real orbitals remain energy eigenstates; nonaxial combinations generally have no definite Lz.

The orbital name and its complex-eigenfunction combination share a centered row in real mode, wrapping into centered rows when needed without scrolling. Complex mode shows a larger centered orbital label. Selector fields keep the same dimensions as ℓ changes; long orientation names stay on one line.

**Evolve in time** multiplies each component by exp(−iEₙt/ℏ). At nominal 1×, one display second advances quantum, Bohr, and transition time by 2 fs. Eigenstate density stays fixed while its complex phase changes. **Superposition mode** combines two amplitudes with equal weights; interference can change spatial probabilities. Identical selections normalize to one eigenstate. Static and Transition modes remember their selected states and orbital bases independently until **RESET SIMULATION** or a page reload. Transition polarization, Rabi frequency, playback speed, and loop setting survive mode switches; the pulse returns paused at its start.

The radial, polar, and azimuthal charts compare sampled positions with integrated theory. Polar probability can be displayed versus cos θ or versus θ with the solid-angle factor included. Charts support current batches, cumulative samples, selectable bin resolution, recording frequency, and statistics reset. Observables show energy, orbital angular momentum, z projection, mean radius, and node counts. The energy ladder uses Eₙ = −13.605693/n² eV and approaches the ionization limit at 0 eV.

## Atomic transitions

The first transition entry starts with **2p<sub>z</sub> → 3d<sub>z²</sub>** in the real basis, or **2p → 3d, mℓ = 0** in the complex basis, with linear z polarization. Later entries restore the previous transition selection. Six buttons select final n = 1–6; high-n mode stays unavailable. Choose Δℓ, then a final real orbital or a complex-basis Δmℓ. Real-orbital choices retain three columns through f/g/h. Equal initial and final n disables the remaining transition selections and playback controls and explains the degeneracy; choose a different n to resume. Electric-dipole selection rules require **Δℓ = ±1**; Δn is unrestricted, with a nonzero energy gap. Complex-basis transitions require **Δmℓ = 0, ±1**, with matching π/σ polarization. Real-basis buttons use the full Cartesian dipole matrix element and automatically select linear x, y, or z polarization; uncoupled orbital pairs are unavailable. Real-orbital indices are orientation labels, not definite magnetic quantum numbers.

The transition dipole includes both radial and angular matrix elements. Photon frequency and wavelength follow the hydrogen energy gap. Play or scrub an ideal resonant π pulse, inspect initial/final populations, or loop the Rabi cycle. The field/dipole view follows the same quantum clock as the electron cloud and wavefunction. Its diagram is reduced to half size to fit alongside the cloud at a shared camera zoom. Orthographic projection keeps circular polarization circular when viewed along its propagation axis. Coupling rates are adjustable and exaggerated for visibility.

This is a nonrelativistic Coulomb model with an infinitely massive proton. It omits spin, reduced-mass corrections, fine structure, the Lamb shift, spontaneous emission, and coupling to other levels. Same-n states are degenerate here and cannot produce a finite-frequency resonant photon in this model.

Volume brightness is normalized for visibility, with a 0.1×–10× range and nominal 1× default. Physical probabilities retain their normalization. The fitted volume covers the larger 99.9% radial extent of the basis states; sampled positions retain the radial tails. The Bohr comparison uses the cloud's physical length calibration. The transition field view uses normalized field/dipole amplitudes, so it has no spatial scale bar. Electron cloud presets span Mint, Rose, muted Lilac, saturated Azure, and Gold; Custom allows exact RGB colors.

## Run locally

Requires a current Node.js version supported by Vite.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run test:e2e
```

The browser suite uses installed Google Chrome. Build output goes to dist/. Pushes to main run unit tests, build the app, and deploy it to GitHub Pages through the repository's Pages workflow.

## References

- [MIT hydrogen-atom notes: radial functions, quantum numbers, and observables](https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2007/c2078ff25c61c136e67ceb6fd8eb9b34_lecture21to22.pdf)
- [NIST electric-dipole selection rules](https://physics.nist.gov/Pubs/AtSpec/node17.html)

Code is distributed under [PolyForm Noncommercial License 1.0.0](LICENSE.md). Font licenses are included in public/font-licenses.
