# Hedione's Atomic Orbital Visualizer

**[Open the interactive visualizer in your browser →](https://hedione.github.io/Atomic-Orbital-Visualizer/)**

An interactive laboratory for hydrogen atomic orbitals, built with React, TypeScript, Three.js, and Vite.

Choose the principal quantum number **n**, orbital angular momentum **ℓ**, and a real orbital orientation. Turn **Real orbital combinations** off to select magnetic quantum number **mℓ** instead. Explore individual orbitals, coherent two-state superpositions, free time evolution, and ideal resonant atomic transitions.

## Simulation modes

The left panel starts in **Static mode**. Click the orange **Simulation mode** button to expand an animated box containing four equally sized buttons: **Static mode**, **Superposition mode**, **Transition mode**, and **Stark / Zeeman**. The selected choice has a cyan fill, border, underline, and checkmark; hovering adds a slight glow. Controls appear directly below the picker without a duplicate mode title or section number. Escape or clicking outside closes the box. Reduced-motion preferences disable the reveal animation.

Each mode has its own controls and remembered selections. Superposition includes the second state and amplitude mix; Transition includes selection rules and pulse controls. **Stark / Zeeman** replaces the orbital workspace with an energy-splitting prototype. **RESET SIMULATION** returns to Static and clears remembered entries. Cloud controls use **Samples** and **Sampling rate** labels.

## Stark / Zeeman prototype

The fourth mode offers magnetic Zeeman shifts, electric Stark shifts, and parallel electric/magnetic fields along z. Choose n = 1–6; Zeeman also selects one ℓ multiplet. Adjust signed magnetic fields from −5 to +5 T and electric fields from −50 to +50 kV/m. Include both spin projections, select one projection, or turn spin off for an orbital-only comparison. The fan diagram, state inspector, and scrollable table show energy corrections in μeV or their frequency equivalents in MHz. Coincident states share their physical energy; the plot fits its energy axis to the selected fields. Example presets, Zero fields, and Reset module support exploration.

The model uses an uncoupled, spin–orbit-free Zeeman formula with gₛ = 2, the full parabolic Stark shell for n > 1, and the quadratic Stark shift for 1s. Electric shifts mix ℓ and do not directly split spin. Parallel-field terms add within this approximation. Fine/hyperfine structure, weak-field Landé splitting, diamagnetic terms, inter-shell mixing, ionization, and field-dressed orbital clouds are omitted. This is a perturbative energy-level prototype, not a prediction of optical line intensities. The literature review, responding quantum numbers, equations, and implementation decisions are in [STARK_ZEEMAN_PHYSICS.md](STARK_ZEEMAN_PHYSICS.md).

## Three views

- **Comparison view:** Static mode shows **Bohr orbit** circles. Superposition offers **Bohr orbit / Bloch sphere** tabs; Transition offers **Field & dipole / Bloch sphere** tabs. Bloch is unavailable in Static mode. Bohr circles have radius n²a₀, depend only on n, and are not quantum electron trajectories.
- **Electron probability cloud:** Independent possible positions of one electron, sampled from the full spatial probability |ψ|² r² sin θ dr dθ dφ. The number of points controls samples, not the number of electrons in the atom.
- **Wavefunction & probability:** A volume of the full radial and angular wavefunction. The 2×2 quantity grid offers wavefunction, probability density, real component, and imaginary component. Adjust **Volume brightness**; radial nodes and coherent interference are included.

Drag any view to orbit, scroll to zoom, and use the camera reset or fullscreen controls. The cloud, wavefunction, Bohr, and field/dipole cameras share orbit, pan, and zoom. Only the Bloch sphere camera is independent; switching comparison tabs keeps its separate view. Camera reset restores all views. Spatial views include a physical scale bar that follows each camera's zoom; it measures distances in the screen plane through the view center. The Bohr comparison and probability cloud share the same physical scale per pixel through linked zoom and resizing. The Bohr readout shows the actual n²a₀ orbit radius.

Pausing sampling stops continuous drawing in the cloud, wavefunction, Bloch, and field/dipole views. Camera moves, control changes, and Regenerate once redraw them immediately. The Bohr comparison retains its separate playback clock.

The header’s information button opens a brief introduction, the GitHub repository link, and the keyboard shortcuts. In the orbital modes, **Space** pauses/resumes sampling, **R** randomizes quantum numbers, and **W** cycles the four wavefunction views. **/** switches Field & dipole / Bloch sphere in Transition, or Bohr orbit / Bloch sphere in Superposition. Shortcuts ignore text/number editors, select menus, and open dialogs; they remain active on sliders. Space takes priority over focused buttons; **Enter** activates them. Holding Space toggles sampling only once.

The Bloch sphere represents the selected pair of distinct orbitals: the north pole |1⟩ is the initial/first orbital and the south pole |2⟩ is the final/second orbital. It shows populations and relative phase from the same laboratory-frame amplitudes as the cloud and wavefunction. With normalized coefficients c₁ and c₂, X = 2 Re(c₁* c₂), Y = 2 Im(c₁* c₂), and Z = |c₁|² − |c₂|². It is dimensionless and does not depict electron position or spin. Relative phase is undefined at the poles; duplicate orbital selections cannot define a two-state sphere. Switching tabs preserves simulation time and pulse progress. Arrow keys, Home, and End also switch tabs.

## Hydrogen model

The orbital is ψₙℓₘ(r,θ,φ) = Rₙℓ(r)Yℓᵐ(θ,φ). The radial function uses normalized associated Laguerre polynomials and the angular function uses normalized complex spherical harmonics with the Condon–Shortley phase.

Allowed quantum numbers are:

- n = 1, 2, …
- ℓ = 0, …, n − 1
- mℓ = −ℓ, …, +ℓ

Standard controls cover n ≤ 6. **Explore high n** extends the controls to 20; turning it off restores the saved lower-n selections. **Randomize**, Previous, and Next retain valid quantum numbers. The initial state is real 2p<sub>z</sub>.

**Real orbital combinations** starts enabled and switches between complex Lz eigenfunctions and normalized real combinations of the ±mℓ orbitals. The orbital slider and its −/+ buttons cycle through p<sub>x</sub>, p<sub>y</sub>, p<sub>z</sub>, and named real d/f/g orientations. The seven f names are f<sub>z³</sub>, f<sub>x(x²−3y²)</sub>, f<sub>y(3x²−y²)</sub>, f<sub>xyz</sub>, f<sub>z(x²−y²)</sub>, f<sub>xz²</sub>, and f<sub>yz²</sub>. The g labels follow [sisl's documented Cartesian shorthand](https://sisl.readthedocs.io/en/stable/_modules/sisl/_core/orbital.html), including g<sub>z⁴</sub> and g<sub>xyz²</sub>. h and higher angular momenta retain real cosine/sine labels. The basis applies to both superposition components, the cloud, the wavefunction, the charts, and the observables. These real orbitals remain energy eigenstates; nonaxial combinations generally have no definite Lz.

Orbital names appear in the selector fields; detached orbital-name and real-combination formula captions are removed. In Superposition mode, the second-state editor follows the Randomize / Explore high n navigation row, before the mix, phase, and evolution controls. Selector fields keep the same dimensions as ℓ changes; long orientation names stay on one line.

**Evolve in time** multiplies each component by exp(−iEₙt/ℏ). At nominal 1×, one display second advances quantum, Bohr, and transition time by 2 fs. Eigenstate density stays fixed while its complex phase changes. **Superposition mode** combines two amplitudes; **State mix** adjusts their relative probabilities from 100% first state to 100% second state, with a 50/50 default. **Phase offset** sets the second state's phase relative to the first at t = 0, from −180° to +180° with a 0° default. The normalized coefficients are c₁ = √(1−P₂) and c₂ = √P₂ exp(iδ). Interference can change spatial probabilities. Mix and phase edits preserve evolution time and update the cloud, volume, Bloch sphere, distributions, and observables, including while paused. Identical selections normalize to one eigenstate and disable relative phase. Static, Superposition, and Transition modes remember their selected states and orbital bases independently until **RESET SIMULATION** or a page reload. Mix and phase belong to Superposition mode and survive switching quantum modes. Transition polarization, Rabi frequency, playback speed, and loop setting survive mode switches; the pulse returns paused at its start.

The radial, polar, and azimuthal charts compare sampled positions with integrated theory. Polar probability can be displayed versus cos θ or versus θ with the solid-angle factor included. Charts support current batches, cumulative samples, selectable bin resolution, recording frequency, and statistics reset. Observables show energy, orbital angular momentum, z projection, mean radius, and node counts. The energy ladder uses Eₙ = −13.605693/n² eV and approaches the ionization limit at 0 eV.

## Atomic transitions

The first transition entry starts with **2p<sub>z</sub> → 3d<sub>z²</sub>** in the real basis, or **2p → 3d, mℓ = 0** in the complex basis, with linear z polarization. Later entries restore the previous transition selection. Six buttons select final n = 1–6; high-n mode stays unavailable. Choose Δℓ, then a final real orbital or a complex-basis Δmℓ. Real-orbital choices retain three columns through f/g/h. Equal initial and final n disables the remaining transition selections and playback controls and explains the degeneracy; choose a different n to resume. Electric-dipole selection rules require **Δℓ = ±1**; Δn is unrestricted, with a nonzero energy gap. Complex-basis transitions require **Δmℓ = 0, ±1**, with matching π/σ polarization. Real-basis buttons use the full Cartesian dipole matrix element and automatically select linear x, y, or z polarization; uncoupled orbital pairs are unavailable. Real-orbital indices are orientation labels, not definite magnetic quantum numbers.

The transition dipole includes both radial and angular matrix elements. Photon frequency and wavelength follow the hydrogen energy gap. Play or scrub an ideal resonant π pulse, inspect initial/final populations, or loop the Rabi cycle. The field/dipole view follows the same quantum clock as the electron cloud and wavefunction. Its diagram is reduced to half size to fit its pane at the default camera zoom. Orthographic projection keeps circular polarization circular when viewed along its propagation axis. Coupling rates are adjustable and exaggerated for visibility.

The three orbital modes use a nonrelativistic Coulomb model with an infinitely massive proton. They omit spin, reduced-mass corrections, fine structure, the Lamb shift, spontaneous emission, and coupling to other levels. Their field-free same-n states are degenerate and cannot produce a finite-frequency resonant photon in the transition model. The separate Stark / Zeeman prototype adds the field corrections described above.

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
- [IBM Quantum: amplitudes, relative phase, and Bloch coordinates](https://quantum.cloud.ibm.com/learning/en/courses/general-formulation-of-quantum-information/density-matrices/bloch-sphere)

Code is distributed under [PolyForm Noncommercial License 1.0.0](LICENSE.md). Font licenses are included in public/font-licenses.
