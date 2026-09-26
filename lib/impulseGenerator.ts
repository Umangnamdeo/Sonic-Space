import { RoomAcoustics, SpatialCoordinates } from './audioTypes';

/**
 * Generates an algorithmic stereo acoustic impulse response based on geometric image sources
 * and frequency-dependent diffuse reverberant decay.
 */
export function generateRoomImpulseResponse(
  ctx: BaseAudioContext,
  acoustics: RoomAcoustics,
  sourcePos: SpatialCoordinates
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const speedOfSound = 343.0; // m/s in standard air (20Â°C)

  const width = Math.max(2, acoustics.width);
  const length = Math.max(2, acoustics.length);
  const height = Math.max(2, acoustics.height);
  const rt60 = Math.max(0.1, acoustics.rt60);

  // Buffer length based on RT60 + predelay
  const duration = Math.min(6.0, rt60 * 1.2 + acoustics.preDelayMs / 1000 + 0.1);
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  // Material absorption presets
  let wallReflectivity = 0.85;
  let highFreqDampFactor = 0.5;

  switch (acoustics.material) {
    case 'anechoic':
      wallReflectivity = 0.05;
      highFreqDampFactor = 0.95;
      break;
    case 'tile':
      wallReflectivity = 0.96;
      highFreqDampFactor = 0.15;
      break;
    case 'concrete':
      wallReflectivity = 0.92;
      highFreqDampFactor = 0.25;
      break;
    case 'wood':
      wallReflectivity = 0.78;
      highFreqDampFactor = 0.45;
      break;
    case 'cathedral':
      wallReflectivity = 0.95;
      highFreqDampFactor = 0.3;
      break;
    case 'studio':
    default:
      wallReflectivity = 0.65;
      highFreqDampFactor = 0.6;
      break;
  }

  // Listener position at center of virtual room
  const listenerX = 0;
  const listenerY = 0;
  const listenerZ = 1.2; // sitting ear height
  const earDistance = 0.18; // approx 18cm inter-aural distance

  // Clamp source within virtual boundaries
  const sx = Math.max(-width / 2 + 0.2, Math.min(width / 2 - 0.2, sourcePos.x));
  const sy = Math.max(-length / 2 + 0.2, Math.min(length / 2 - 0.2, sourcePos.y));
  const sz = Math.max(0.2, Math.min(height - 0.2, sourcePos.z + height / 2));

  const preDelaySamples = Math.floor((acoustics.preDelayMs / 1000) * sampleRate);

  // 1. Compute Geometric Early Reflections (Image-source method up to order 2)
  const orders = [-1, 0, 1];
  const reflections: Array<{ delaySamplesL: number; delaySamplesR: number; gainL: number; gainR: number }> = [];

  for (const mx of orders) {
    for (const my of orders) {
      for (const mz of orders) {
        if (mx === 0 && my === 0 && mz === 0) continue; // skip direct path (handled dry)

        // Calculate virtual image source coordinates
        const isx = mx % 2 === 0 ? sx + mx * width : -sx + mx * width;
        const isy = my % 2 === 0 ? sy + my * length : -sy + my * length;
        const isz = mz % 2 === 0 ? sz + mz * height : -sz + mz * height;

        // Distances to left and right ears
        const dL = Math.hypot(isx - (listenerX - earDistance / 2), isy - listenerY, isz - listenerZ);
        const dR = Math.hypot(isx - (listenerX + earDistance / 2), isy - listenerY, isz - listenerZ);

        const reflectionOrder = Math.abs(mx) + Math.abs(my) + Math.abs(mz);
        const wallLoss = Math.pow(wallReflectivity, reflectionOrder);

        const delaySecL = dL / speedOfSound + acoustics.preDelayMs / 1000;
        const delaySecR = dR / speedOfSound + acoustics.preDelayMs / 1000;

        const sampL = Math.floor(delaySecL * sampleRate);
        const sampR = Math.floor(delaySecR * sampleRate);

        if (sampL < totalSamples && sampR < totalSamples) {
          const invDL = 1.0 / Math.max(1.0, dL);
          const invDR = 1.0 / Math.max(1.0, dR);

          reflections.push({
            delaySamplesL: sampL,
            delaySamplesR: sampR,
            gainL: invDL * wallLoss * acoustics.earlyReflections,
            gainR: invDR * wallLoss * acoustics.earlyReflections,
          });
        }
      }
    }
  }

  // Stamp early reflections into channels
  for (const ref of reflections) {
    if (ref.delaySamplesL < totalSamples) {
      leftChannel[ref.delaySamplesL] += (Math.random() > 0.5 ? 1 : -1) * ref.gainL * 0.4;
    }
    if (ref.delaySamplesR < totalSamples) {
      rightChannel[ref.delaySamplesR] += (Math.random() > 0.5 ? 1 : -1) * ref.gainR * 0.4;
    }
  }

  // 2. Compute Diffuse Reverberant Tail (Exponential Decay with Poisson impulse distribution)
  // Decay constant: -60dB corresponds to a factor of 10^-3 (or ln(1000) = 6.9078)
  const decayRate = 6.9078 / rt60;
  const mixTimeSec = Math.max(0.015, Math.sqrt(width * length * height) / speedOfSound * 0.04);
  const mixTimeSample = Math.floor(mixTimeSec * sampleRate) + preDelaySamples;

  // Filter state for frequency-dependent absorption
  let filterStateL = 0;
  let filterStateR = 0;
  const dampAlpha = Math.max(0.05, Math.min(0.95, (acoustics.damping / 20000) * (1 - highFreqDampFactor * 0.5)));

  for (let i = mixTimeSample; i < totalSamples; i++) {
    const time = (i - mixTimeSample) / sampleRate;
    // Exponential envelope
    const envelope = Math.exp(-decayRate * time);

    // Decorrelated noise burst
    const rawNoiseL = (Math.random() * 2 - 1);
    const rawNoiseR = (Math.random() * 2 - 1);

    // Frequency damping (One-pole IIR lowpass)
    filterStateL = filterStateL + dampAlpha * (rawNoiseL - filterStateL);
    filterStateR = filterStateR + dampAlpha * (rawNoiseR - filterStateR);

    // Fade-in envelope for late tail to seamlessly merge with early reflections
    const fadeIn = Math.min(1.0, (i - mixTimeSample) / (sampleRate * 0.02));

    leftChannel[i] += filterStateL * envelope * fadeIn * 0.22;
    rightChannel[i] += filterStateR * envelope * fadeIn * 0.22;
  }

  // Normalize impulse to prevent clipping while maintaining realistic gain
  let maxAbs = 0;
  for (let i = 0; i < totalSamples; i++) {
    const absL = Math.abs(leftChannel[i]);
    const absR = Math.abs(rightChannel[i]);
    if (absL > maxAbs) maxAbs = absL;
    if (absR > maxAbs) maxAbs = absR;
  }

  if (maxAbs > 0.0001) {
    const norm = 0.85 / maxAbs;
    for (let i = 0; i < totalSamples; i++) {
      leftChannel[i] *= norm;
      rightChannel[i] *= norm;
    }
  }

  return buffer;
}
