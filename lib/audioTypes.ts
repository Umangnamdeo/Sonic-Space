export type AudioSourceType = 'preset' | 'upload' | 'mic';

export interface SpatialCoordinates {
  x: number; // -10 to +10 meters (left to right)
  y: number; // -10 to +10 meters (front to back)
  z: number; // -5 to +5 meters (floor to ceiling)
}

export interface RoomAcoustics {
  width: number; // meters (3 to 30)
  length: number; // meters (4 to 40)
  height: number; // meters (2.5 to 15)
  rt60: number; // decay time in seconds (0.2 to 8.0)
  damping: number; // high frequency damping (Hz, 1000 to 18000)
  material: 'studio' | 'cathedral' | 'concrete' | 'wood' | 'anechoic' | 'tile';
  earlyReflections: number; // 0 to 1
  preDelayMs: number; // 0 to 120 ms
  wetMix: number; // 0 to 1
}

export interface EqBand {
  type: BiquadFilterType;
  freq: number;
  gain: number; // dB (-18 to +18)
  q: number; // 0.1 to 18
  active: boolean;
}

export interface EqParameters {
  lowCut: EqBand;
  lowShelf: EqBand;
  midBell: EqBand;
  highShelf: EqBand;
  active: boolean;
}

export interface CompressorParameters {
  threshold: number; // dB (-60 to 0)
  ratio: number; // 1 to 20
  attack: number; // seconds (0.001 to 0.5)
  release: number; // seconds (0.01 to 1.5)
  knee: number; // dB (0 to 40)
  makeupGain: number; // dB (0 to 24)
  active: boolean;
}

export interface SaturatorParameters {
  drive: number; // 0 to 1
  type: 'tape' | 'tube' | 'transistor';
  tone: number; // lowpass filter cutoff 2000 - 20000
  mix: number; // 0 to 1
  active: boolean;
}

export interface DelayParameters {
  timeMs: number; // 10 to 1000 ms
  feedback: number; // 0 to 0.95
  pingPong: boolean;
  dampingHz: number; // 1000 to 16000
  mix: number; // 0 to 1
  active: boolean;
}

export interface AudioMetrics {
  peakL: number; // 0 to 1
  peakR: number; // 0 to 1
  rmsL: number; // 0 to 1
  rmsR: number; // 0 to 1
  gainReductionDb: number; // 0 to 30 dB
  phaseCorrelation: number; // -1 to +1
}

export interface SoundPreset {
  id: string;
  name: string;
  category: string;
  bpm: number;
  key: string;
  durationSeconds: number;
  description: string;
}

export interface SpacePreset {
  id: string;
  name: string;
  description: string;
  acoustics: Partial<RoomAcoustics>;
  position: SpatialCoordinates;
  eq?: Partial<EqParameters>;
}

export type SpatialMotionPattern =
  | 'manual'
  | '8d-orbit'
  | '8d-fast'
  | '16d-infinity'
  | '16d-spiral'
  | 'singer-motion'
  | 'front-back'
  | 'left-right';

export interface SpatialMotionConfig {
  pattern: SpatialMotionPattern;
  speedHz: number; // Rotation / cycle frequency in Hz (0.02 - 0.5)
  radius: number; // Horizontal radius in meters (0.8 - 4.5)
  elevationRange: number; // Vertical Z oscillation range in meters (0 - 3.5)
  depthRange: number; // Front/Back Y oscillation range in meters (0.8 - 4.5)
  active: boolean;
}

export interface ToneParameters {
  inputGainDb: number; // -12dB to +12dB
  lowGainDb: number; // -12dB to +12dB (100 Hz shelf)
  midGainDb: number; // -12dB to +12dB (peaking)
  midFreqHz: number; // 200 Hz to 4000 Hz (parametric center)
  highGainDb: number; // -12dB to +12dB (8.5 kHz shelf)
}

