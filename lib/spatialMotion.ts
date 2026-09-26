import { SpatialCoordinates, SpatialMotionConfig, SpatialMotionPattern } from './audioTypes';

export interface MotionPresetDefinition {
  id: SpatialMotionPattern;
  name: string;
  badge: string;
  description: string;
  defaultConfig: SpatialMotionConfig;
}

export const MOTION_PRESETS: MotionPresetDefinition[] = [
  {
    id: 'singer-motion',
    name: 'Singer Stage Walk (3D)',
    badge: '3D VOCAL',
    description: 'Natural singer moving smoothly front-to-back, left-to-right, and up-to-down around the listener.',
    defaultConfig: {
      pattern: 'singer-motion',
      speedHz: 0.07, // ~14 seconds per full stage cycle
      radius: 2.6, // 2.6m left-right stage
      depthRange: 2.8, // 2.8m front-back depth
      elevationRange: 1.8, // ±1.8m height swing
      active: true,
    },
  },
  {
    id: '8d-orbit',
    name: '8D Audio Orbit',
    badge: '8D BINAURAL',
    description: '360° circular binaural orbit around the head with pinna HRTF shadow depth.',
    defaultConfig: {
      pattern: '8d-orbit',
      speedHz: 0.08, // ~12.5 seconds per complete 360° rotation
      radius: 2.4,
      depthRange: 2.4,
      elevationRange: 0.4,
      active: true,
    },
  },
  {
    id: '8d-fast',
    name: '8D Club Velocity',
    badge: '8D FAST',
    description: 'Faster rotating 8D spatial motion with dynamic distance pulsing.',
    defaultConfig: {
      pattern: '8d-fast',
      speedHz: 0.16, // ~6 seconds per rotation
      radius: 2.2,
      depthRange: 2.2,
      elevationRange: 0.6,
      active: true,
    },
  },
  {
    id: '16d-infinity',
    name: '16D Infinity Field',
    badge: '16D DUAL-AXIS',
    description: 'Figure-8 multi-axis orbital trajectory sweeping over and behind the listener.',
    defaultConfig: {
      pattern: '16d-infinity',
      speedHz: 0.065, // ~15 seconds per figure-8
      radius: 3.0,
      depthRange: 2.6,
      elevationRange: 2.2,
      active: true,
    },
  },
  {
    id: '16d-spiral',
    name: '16D Cosmic Spiral',
    badge: '16D HELIX',
    description: 'Ascending and descending 3D helix from floor level to cathedral ceiling.',
    defaultConfig: {
      pattern: '16d-spiral',
      speedHz: 0.09,
      radius: 2.5,
      depthRange: 2.5,
      elevationRange: 2.5,
      active: true,
    },
  },
  {
    id: 'front-back',
    name: 'Front-to-Back Pendulum',
    badge: 'DEPTH SWEEP',
    description: 'Smooth linear depth sweep passing directly through the acoustic center.',
    defaultConfig: {
      pattern: 'front-back',
      speedHz: 0.1,
      radius: 0.8,
      depthRange: 3.2,
      elevationRange: 0.8,
      active: true,
    },
  },
  {
    id: 'left-right',
    name: 'Left-to-Right Arc',
    badge: 'PANNING ARC',
    description: 'Wide horizontal stereo arc gliding ear-to-ear across the front soundstage.',
    defaultConfig: {
      pattern: 'left-right',
      speedHz: 0.12,
      radius: 3.2,
      depthRange: 1.8,
      elevationRange: 0.6,
      active: true,
    },
  },
  {
    id: 'manual',
    name: 'Manual Placement',
    badge: 'STATIC / DRAG',
    description: 'Static coordinates. Click or drag anywhere on the radar chamber to position.',
    defaultConfig: {
      pattern: 'manual',
      speedHz: 0,
      radius: 2.0,
      depthRange: 2.0,
      elevationRange: 0,
      active: false,
    },
  },
];

/**
 * Computes exact 3D Cartesian coordinates (x, y, z) for a given motion config and elapsed time (seconds).
 */
export function calculateMotionCoordinates(
  config: SpatialMotionConfig,
  timeSeconds: number,
  manualFallback: SpatialCoordinates = { x: 0, y: 1.8, z: 0 }
): SpatialCoordinates {
  if (!config.active || config.pattern === 'manual') {
    return manualFallback;
  }

  const omega = 2 * Math.PI * config.speedHz;
  const t = timeSeconds;
  const rad = Math.max(0.4, config.radius);
  const depth = Math.max(0.4, config.depthRange);
  const elev = Math.max(0, config.elevationRange);

  switch (config.pattern) {
    case 'singer-motion': {
      // Natural organic singer movement:
      // Front-to-Back (Y), Left-to-Right (X), and Up-to-Down (Z) with smooth harmonics
      const u = omega * t;
      const x = rad * (0.75 * Math.sin(u) + 0.28 * Math.sin(2 * u - Math.PI / 3));
      const y = depth * (0.72 * Math.cos(u) + 0.32 * Math.cos(3 * u + Math.PI / 4));
      const z = elev * (0.7 * Math.sin(1.3 * u) + 0.3 * Math.cos(2.6 * u));
      return { x, y, z };
    }

    case '8d-orbit': {
      // 360° pure circular rotation around the listener head
      const angle = omega * t;
      const x = rad * Math.sin(angle);
      const y = depth * Math.cos(angle);
      const z = elev * 0.25 * Math.sin(2 * angle);
      return { x, y, z };
    }

    case '8d-fast': {
      // Fast orbit with slight breathing radius
      const angle = omega * t;
      const r = rad * (1.0 + 0.18 * Math.sin(angle * 2));
      const x = r * Math.sin(angle);
      const y = r * Math.cos(angle);
      const z = elev * 0.4 * Math.sin(angle);
      return { x, y, z };
    }

    case '16d-infinity': {
      // Lemniscate of Bernoulli (figure-8) in horizontal plane + vertical wave
      const u = omega * t;
      const x = rad * Math.sin(u);
      const y = depth * Math.sin(2 * u) * 0.85;
      const z = elev * Math.cos(1.5 * u);
      return { x, y, z };
    }

    case '16d-spiral': {
      // Ascending and descending helix from floor to ceiling
      const u = omega * t;
      const x = rad * Math.cos(u);
      const y = depth * Math.sin(u);
      const z = elev * Math.sin(0.4 * u);
      return { x, y, z };
    }

    case 'front-back': {
      // Straight through-depth pendulum
      const u = omega * t;
      const x = rad * 0.25 * Math.sin(2 * u);
      const y = depth * Math.cos(u);
      const z = elev * 0.4 * Math.sin(u);
      return { x, y, z };
    }

    case 'left-right': {
      // Wide frontal arc
      const u = omega * t;
      const x = rad * Math.sin(u);
      const y = depth * (0.8 + 0.25 * Math.cos(2 * u));
      const z = elev * 0.35 * Math.sin(u);
      return { x, y, z };
    }

    default:
      return manualFallback;
  }
}
