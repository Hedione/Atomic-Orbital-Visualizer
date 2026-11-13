export type SceneKind = 'wavefunction' | 'ensemble' | 'classical' | 'field'
export type SurfaceQuantity = 'magnitude' | 'probability' | 'real' | 'imaginary'
export type Polarization = 'pi' | 'sigmaPlus' | 'sigmaMinus'
export type OrbitalBasis = 'complex' | 'real'
export type ElectronPalette = 'mint' | 'rose' | 'lilac' | 'azure' | 'gold' | 'custom'
export const surfaceColorMode = (quantity: SurfaceQuantity) => quantity === 'magnitude' ? 'phase' : quantity === 'real' || quantity === 'imaginary' ? 'sign' : 'density'
export interface Orbital { n: number; l: number; m: number }
export interface Settings extends Orbital {
  orbitalBasis: OrbitalBasis;
  highN: boolean; n2: number; l2: number; m2: number;
  superposition: boolean; timeEvolution: boolean; quantumPlayback: number;
  coherentTransition: boolean; polarization: Polarization; rabiFrequency: number; drivePhase: number;
  transitionPlaying: boolean; transitionLoop: boolean; transitionProgress: number; transitionRun: number; transitionPlayback: number;
  count: number; frequency: number; histogramFrequency: number; electronOpacity: number; electronSize: number;
  electronPalette: ElectronPalette; customElectronColor: string;
  seed: number; ensemblePaused: boolean; regenerate: number; resetStats: number;
  playback: number; surfaceQuantity: SurfaceQuantity; volumeBrightness: number; cameraReset: number;
}
export const defaultSettings: Settings = {
  n: 2, l: 1, m: 0, highN: false, n2: 3, l2: 2, m2: 1,
  orbitalBasis: 'real',
  superposition: false, timeEvolution: true, quantumPlayback: 1,
  coherentTransition: false, polarization: 'pi', rabiFrequency: 1.55, drivePhase: 0,
  transitionPlaying: false, transitionLoop: false, transitionProgress: 0, transitionRun: 0, transitionPlayback: 1,
  count: 5000, frequency: 15, histogramFrequency: 10, electronOpacity: 0.25, electronSize: 4,
  electronPalette: 'mint', customElectronColor: '#72ddc8',
  seed: 42, ensemblePaused: false, regenerate: 0, resetStats: 0,
  playback: 1, surfaceQuantity: 'magnitude', volumeBrightness: 1, cameraReset: 0,
}
