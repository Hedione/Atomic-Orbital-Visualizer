# Stark and Zeeman shifts: physics reference and prototype specification

Prepared 2026-11-14. This document was written from the sources below before implementing the field-shift module. It defines the prototype's equations, state labels, and limits.

## 1. What changes an atomic energy level?

A field adds an interaction to the atom's Hamiltonian. States with the same energy at zero field can acquire different interaction energies, lifting their degeneracy. Splitting an energy level is distinct from predicting the intensities of optical spectral lines: those also require transition matrix elements and populations.

For this hydrogen visualizer, the reference is the infinitely heavy proton, nonrelativistic Coulomb energy

\[
E_n=-\frac{13.605693122994\ \mathrm{eV}}{n^2}.
\]

The new module plots corrections relative to this reference. It does not reinterpret the existing field-free probability clouds as field-dressed wavefunctions.

## 2. Quantum numbers and their roles

| Label | Meaning | Response to an electric field along z | Response to a magnetic field along z |
| --- | --- | --- | --- |
| n | Principal quantum number | Determines the shell and scale of Stark response | Determines the Coulomb reference; no explicit n in the leading orbital/spin Zeeman term |
| ℓ | Orbital angular momentum | Different ℓ values mix; generally not a good Stark-state label | Remains a useful label when the quadratic magnetic interaction is neglected |
| mℓ | Orbital z projection, −ℓ through +ℓ | Conserved by the z-directed electric interaction; constrains the available Stark states | Directly determines the uncoupled orbital Zeeman shift |
| s = ½, mₛ = ±½ | Electron spin and its projection | The electrostatic interaction does not act directly on spin | The spin magnetic moment splits the two projections |
| j, mⱼ | Total electronic angular momentum and projection | Not the labels of the spin-free Stark model | Appropriate for weak-field Zeeman shifts when spin–orbit coupling dominates |
| n₁, n₂, k | Parabolic labels, k = n₁ − n₂ | k sets the leading linear Stark slope | For parallel fields, mℓ and mₛ determine the additional uncoupled magnetic shift |

The basis distinction matters. A Stark state can have a definite mℓ while being a superposition of several ℓ values. A spin–orbit coupled state can have definite j and mⱼ without definite mℓ or mₛ. [C. D. Lin, Kansas State, hydrogen in parabolic coordinates](https://www.phys.ksu.edu/personal/cdlin/class/class04a/amo-1-fall04Full.pdf), [NIST, Zeeman effect](https://www.nist.gov/pml/atomic-spectroscopy-compendium-basic-ideas-notation-data-and-formulas/atomic-spectroscopy-zeeman).

## 3. Zeeman effect: magnetic coupling

For an electron, with e the positive elementary charge,

\[
H_B=\frac{\mu_B B}{\hbar}(L_z+g_s S_z).
\]

In the uncoupled basis this gives

\[
\Delta E_Z=\mu_B B(m_\ell+g_s m_s).
\]

The prototype uses gₛ = 2. Spin OFF means an orbital-only comparison, not a physical spin-zero hydrogen electron. With spin ON, the two projections differ in energy by 2μB B for the same orbital. An s orbital has no orbital contribution but still has this spin splitting. Reversing B reverses these shifts. [Baez, U. C. Riverside, magnetic moments](https://math.ucr.edu/home/baez/spin/node11.html).

For real hydrogen in weak magnetic fields, spin–orbit coupling instead selects j = ℓ ± ½, with only j = ½ for ℓ = 0. The leading shift is

\[
\Delta E_Z=g_j\mu_B Bm_j,\qquad
g_j=1+\frac{j(j+1)+s(s+1)-\ell(\ell+1)}{2j(j+1)}
\]

when gₛ = 2. Thus j sets the Landé factor and mⱼ sets the slope. This weak-field formula must not be confused with the uncoupled formula. [NIST, Zeeman effect](https://www.nist.gov/pml/atomic-spectroscopy-compendium-basic-ideas-notation-data-and-formulas/atomic-spectroscopy-zeeman).

The uncoupled formula is the spin–orbit-free model, or the leading Paschen–Back description when magnetic coupling dominates spin–orbit coupling while diamagnetic terms remain small. This prototype does not calculate the crossover. [Baez, Paschen–Back limit](https://math.ucr.edu/home/baez/spin/node12.html).

## 4. Stark effect: electric coupling

For a uniform electric field F along z,

\[
H_F=eFz.
\]

Its diagonal expectation vanishes in a field-free state of definite parity. This does not imply that excited hydrogen has no first-order shift: states with different ℓ are degenerate in the Coulomb model, and the perturbation must be diagonalized within that degenerate shell. Nonzero z matrix elements require Δℓ = ±1 and Δmℓ = 0; spin is unchanged. These are matrix-element constraints, not a claim that adjusting a static field drives an optical transition. [Fitzpatrick, U. T. Austin, linear Stark effect](https://farside.ph.utexas.edu/teaching/qm/lectures/node64.html).

Use nonnegative parabolic integers satisfying

\[
n_1+n_2+|m_\ell|+1=n,\qquad k=n_1-n_2.
\]

With the prototype's convention for k,

\[
\Delta E_S^{(1)}=\frac32 nkea_0F.
\]

References sometimes interchange n₁ and n₂, reversing k's name. The physical set of energies is unchanged. Summing all allowed labels yields n² orbital states. [Inglis and Teller, *Astrophysical Journal* 90, 439 (1939), equation 6](https://www.afs.enea.it/project/protosphera/Proto-Sphera_Full_Documents/Tesina_JacopoLombardo/Inglis-Teller%5B1939ApJ%5D.pdf), [Lin, parabolic-state basis](https://www.phys.ksu.edu/personal/cdlin/class/class04a/amo-1-fall04Full.pdf).

For n = 2, the four orbital states give shifts −3ea₀F, 0, 0, +3ea₀F. The shifted pair mixes 2s and 2p with mℓ = 0. The mℓ = ±1 states retain zero first-order shift. Adding spin duplicates these electric energies without splitting the spin pair. [U. C. San Diego, n = 2 Stark effect](https://quantummechanics.ucsd.edu/ph130a/130_notes/node338.html).

### Ground-state exception

The 1s state has no linear Stark shift. Its leading correction is quadratic:

\[
\Delta E_{1s}=-\frac94 E_h\left(\frac{F}{F_a}\right)^2.
\]

This corresponds to polarizability 9/2 in atomic units. It is negative for either field direction and shifts both spin projections equally. The prototype includes this term for n = 1; it omits excited-state quadratic corrections. A zero first-order slope at n > 1 therefore means zero within the retained approximation. [David Tong, Cambridge, *Applications of Quantum Mechanics*, section 8.1.2](https://www.damtp.cam.ac.uk/user/tong/aqm/aqm.pdf).

## 5. Parallel electric and magnetic fields

Within the spin–orbit-free, fixed-n perturbative model, z commutes with Lz and Sz. Consequently the Stark eigenstates also diagonalize the retained magnetic interaction when both fields point along z:

\[
\Delta E=\Delta E_S+\mu_BB(m_\ell+2m_s).
\]

This addition is a model deduction from the operators above, not a general crossed-field solution. It does not apply to arbitrary field angles or to a weak-field Landé basis with unresolved Stark mixing. Nuclear spin, hyperfine/Lamb/fine structure, diamagnetic B² terms, inter-shell mixing, ionization, and populations are outside the prototype.

## 6. Numerical units

Use a₀ = 5.29177210544 × 10⁻¹¹ m, μB = 5.7883817982 × 10⁻⁵ eV/T, Eₕ = 27.211386245981 eV, and Fₐ = 5.14220675112 × 10¹¹ V/m. Divide energy in eV by h = 4.135667696… × 10⁻¹⁵ eV·s for its frequency equivalent. μeV and MHz readouts describe energy differences, not an optical line calculation. [NIST, 2022 CODATA constants](https://physics.nist.gov/cuu/Constants/Table/allascii.txt).

## 7. Decisions for this working prototype

- Replace the fourth mode with **Stark / Zeeman**. Keep its settings independent of the three existing orbital modes.
- Offer Zeeman, Stark, and parallel-field views. Zeeman selects one n, ℓ multiplet; electric-field views include the entire n shell because ℓ mixes.
- Cover n = 1–6, B = −5 to +5 T, and F = −50 to +50 kV/m. These are exploration bounds, not a guarantee of agreement with measured spectra at every setting.
- Allow both electron spin projections or one selected projection, plus an explicitly labelled orbital-only comparison.
- Show a field-ramp fan, selectable individual states, degeneracy counts, and separate electric/magnetic contributions. Preserve degeneracy: coincident lines must not be given artificial energy offsets.
- Label the approximation in the module. The plot may fit its energy axis to the current fields; show units and zero-field reference explicitly.
- Check zero fields, field reversal, state counts, the n = 2 Stark quartet, the 1s quadratic shift, spin splitting, and additive parallel-field shifts before handing over the prototype.
