import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Settings } from '../types'
import type { QuantumTimeline } from '../physics/evolution'
import { createVolumeMaterial, createVolumeResources, updateVolumeMaterial } from './volume-material'

/** Ray-march the full 3D orbital. Factorized lookup tables retain radial nodes and live interference. */
export function OrbitalVolume({ settings: s, timeline, radius }: { settings: Settings; timeline: QuantumTimeline; radius: number }) {
  const resources = useMemo(() => createVolumeResources(s, radius), [s.n, s.l, s.m, s.n2, s.l2, s.m2, s.orbitalBasis, s.superposition, s.coherentTransition, radius])
  // Keep the shader program warm when orbital textures change.
  const material = useMemo(() => createVolumeMaterial(resources, radius, s), [])
  useEffect(() => () => { resources.radial.dispose(); resources.polar.dispose() }, [resources])
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => updateVolumeMaterial(material, resources, s, radius, timeline.frame.coefficients))
  return <mesh material={material} frustumCulled={false}><boxGeometry args={[4.8, 4.8, 4.8]} /></mesh>
}
