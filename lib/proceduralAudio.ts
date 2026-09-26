import { SoundPreset } from './audioTypes';

export const BUILTIN_SOUND_PRESETS: SoundPreset[] = [
  {
    id: 'singer-melody',
    name: 'Acoustic Singer Melody',
    category: 'Vocal',
    bpm: 85,
    key: 'E Minor',
    durationSeconds: 12.0,
    description: 'Expressive lead vocal phrase with natural vibrato and formant filtering, ideal for 3D stage movement.',
  },
  {
    id: 'synth-arp',
    name: 'Analog Neon Arp',
    category: 'Synthesizer',
    bpm: 124,
    key: 'C Minor',
    durationSeconds: 8.0,
    description: 'Analog sawtooth arpeggio with resonant decay and deep sub foundation.',
  },
  {
    id: 'acoustic-guitar',
    name: 'Fingerstyle Acoustic',
    category: 'Strings',
    bpm: 96,
    key: 'A Minor',
    durationSeconds: 10.0,
    description: 'Dry plucked Karplus-Strong acoustic guitar progression (Am - F - C - G).',
  },
  {
    id: 'vintage-break',
    name: 'Studio Drum Break',
    category: 'Drums',
    bpm: 110,
    key: 'Percussion',
    durationSeconds: 8.72,
    description: 'Tight studio drum groove with punchy kick, transient snare and crisp hats.',
  },
  {
    id: 'vocal-drone',
    name: 'Chamber Vocal Pad',
    category: 'Voice',
    bpm: 72,
    key: 'D Minor',
    durationSeconds: 10.0,
    description: 'Warm formant-filtered synthetic choral chord with subtle natural vibrato.',
  },
  {
    id: 'pink-burst',
    name: 'Calibration Pink Noise',
    category: 'Test Signal',
    bpm: 120,
    key: 'Broadband',
    durationSeconds: 6.0,
    description: 'Periodic pink noise impulse burst for room acoustic RT60 analysis.',
  },
];

/**
 * Procedurally generates an AudioBuffer for any of the built-in studio presets.
 */
export function generateProceduralAudio(ctx: BaseAudioContext, presetId: string): AudioBuffer {
  const sampleRate = ctx.sampleRate;

  switch (presetId) {
    case 'singer-melody':
      return generateSingerMelodyBuffer(ctx, sampleRate);
    case 'acoustic-guitar':
      return generateGuitarBuffer(ctx, sampleRate);
    case 'vintage-break':
      return generateDrumBreakBuffer(ctx, sampleRate);
    case 'vocal-drone':
      return generateVocalDroneBuffer(ctx, sampleRate);
    case 'pink-burst':
      return generatePinkNoiseBuffer(ctx, sampleRate);
    case 'synth-arp':
    default:
      return generateSynthArpBuffer(ctx, sampleRate);
  }
}

/**
 * Synthesizes a lyrical melodic vocal line (pentatonic E Minor: E3, G3, A3, B3, D4, E4)
 * with realistic vocal cord glottal pulses, human vowel formants (F1, F2), natural vibrato, and breath dynamics.
 */
function generateSingerMelodyBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const duration = 12.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Melodic notes sequence [freq, startTime, noteDuration, vowel]
  // Vowel types: 0 = 'Ah' (F1: 700Hz, F2: 1200Hz), 1 = 'Oh' (F1: 500Hz, F2: 850Hz), 2 = 'Ee' (F1: 300Hz, F2: 2200Hz)
  const notes: Array<[number, number, number, number]> = [
    [164.81, 0.0, 1.8, 0],  // E3
    [196.00, 1.8, 1.2, 1],  // G3
    [220.00, 3.0, 1.8, 0],  // A3
    [246.94, 4.8, 1.2, 1],  // B3
    [293.66, 6.0, 2.0, 0],  // D4
    [329.63, 8.0, 2.2, 2],  // E4 (high peak)
    [293.66, 10.2, 1.6, 1], // D4
  ];

  let currentPhase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Find active note or transition
    let activeFreq = 164.81;
    let noteEnv = 0;
    let vowelType = 0;

    for (let n = 0; n < notes.length; n++) {
      const [freq, start, len, v] = notes[n];
      if (t >= start && t < start + len) {
        const localT = t - start;
        activeFreq = freq;
        vowelType = v;
        // Natural attack-decay envelope with breath release
        const attack = Math.min(1.0, localT / 0.15);
        const release = Math.min(1.0, (len - localT) / 0.2);
        noteEnv = attack * release;
        break;
      }
    }

    if (noteEnv <= 0.001) {
      left[i] = 0;
      right[i] = 0;
      continue;
    }

    // Natural 5.2 Hz vocal vibrato (delayed vibrato after onset)
    const vibratoAmount = 0.012;
    const vibrato = 1.0 + vibratoAmount * Math.sin(2 * Math.PI * 5.2 * t);
    const instantFreq = activeFreq * vibrato;

    currentPhase += (2 * Math.PI * instantFreq) / sampleRate;
    if (currentPhase > 2 * Math.PI * 1000) currentPhase %= 2 * Math.PI;

    // Glottal pulse waveform (asymmetrical triangle with harmonic richness)
    const normPhase = (currentPhase / (2 * Math.PI)) % 1;
    let glottal = 0;
    if (normPhase < 0.6) {
      glottal = (normPhase / 0.6) * 2 - 1;
    } else {
      glottal = ((1 - normPhase) / 0.4) * 2 - 1;
    }

    // Formant resonance filter approximation
    let f1 = 700;
    let f2 = 1200;
    if (vowelType === 1) { // Oh
      f1 = 500;
      f2 = 850;
    } else if (vowelType === 2) { // Ee
      f1 = 320;
      f2 = 2200;
    }

    const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.35;
    const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.22;
    const breathNoise = (Math.random() * 2 - 1) * 0.04;

    const voiceSample = (glottal * 0.6 + formant1 + formant2 + breathNoise) * noteEnv * 0.4;

    // Subtle stereo width for vocal source
    left[i] = voiceSample * 0.98;
    right[i] = voiceSample * 1.02;
  }

  return buffer;
}

/**
 * Synthesizes an analog sawtooth arpeggiator in C Minor
 */
function generateSynthArpBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const duration = 8.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // C minor notes: C2 (65.41), G2 (98), C3 (130.81), Eb3 (155.56), G3 (196.00), Bb3 (233.08), D4 (293.66), Eb4 (311.13)
  const notes = [130.81, 155.56, 196.0, 233.08, 293.66, 311.13, 293.66, 233.08];
  const subNotes = [65.41, 65.41, 58.27, 58.27, 48.99, 48.99, 58.27, 65.41];

  const bpm = 124;
  const secondsPerBeat = 60 / bpm;
  const stepDuration = secondsPerBeat / 2; // 1/8th notes

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const step = Math.floor(t / stepDuration);
    const noteFreq = notes[step % notes.length];
    const subFreq = subNotes[Math.floor(step / 4) % subNotes.length];

    const noteTime = (t % stepDuration) / stepDuration;
    const env = Math.exp(-noteTime * 4.5); // decay envelope

    // Detuned sawtooth oscillators
    const osc1 = ((t * noteFreq) % 1) * 2 - 1;
    const osc2 = ((t * (noteFreq * 1.004)) % 1) * 2 - 1;
    const osc3 = ((t * (noteFreq * 0.996)) % 1) * 2 - 1;
    const subOsc = Math.sin(2 * Math.PI * subFreq * t);

    const leadSample = (osc1 * 0.4 + osc2 * 0.3 + osc3 * 0.3) * env * 0.4;
    const subSample = subOsc * 0.35;

    // Stereo spread
    left[i] = (leadSample * 0.9 + subSample) * 0.7;
    right[i] = (leadSample * 1.1 + subSample) * 0.7;
  }

  return buffer;
}

/**
 * Synthesizes an acoustic fingerstyle guitar progression using Karplus-Strong
 */
function generateGuitarBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const duration = 10.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Chord progression: Am -> F -> C -> G
  // Frequencies in Hz
  const patterns = [
    // Am
    [110.0, 164.81, 220.0, 261.63, 329.63],
    // F
    [87.31, 174.61, 220.0, 261.63, 349.23],
    // C
    [130.81, 164.81, 196.0, 261.63, 329.63],
    // G
    [98.0, 146.83, 196.0, 246.94, 293.66],
  ];

  const noteInterval = 0.3125; // ~96 bpm 1/8th note triplet/swing feel
  const totalNotes = Math.floor(duration / noteInterval);

  // Pluck simulation per note
  for (let n = 0; n < totalNotes; n++) {
    const chordIndex = Math.floor(n / 8) % patterns.length;
    const chord = patterns[chordIndex];
    const stringIndex = n % chord.length;
    const freq = chord[stringIndex];

    const startSample = Math.floor(n * noteInterval * sampleRate);
    const period = Math.floor(sampleRate / freq);
    const ksBuffer = new Float32Array(period);

    // Seed with white noise
    for (let j = 0; j < period; j++) {
      ksBuffer[j] = Math.random() * 2 - 1;
    }

    // Decay loop
    const decayDurationSamples = Math.floor(sampleRate * 2.5);
    const maxIndex = Math.min(numSamples, startSample + decayDurationSamples);
    let ksIdx = 0;
    const feedback = 0.991;

    for (let i = startSample; i < maxIndex; i++) {
      const nextIdx = (ksIdx + 1) % period;
      const filtered = (ksBuffer[ksIdx] + ksBuffer[nextIdx]) * 0.5 * feedback;
      ksBuffer[ksIdx] = filtered;

      const pan = (stringIndex / (chord.length - 1)) * 0.4 - 0.2; // slight stereo spread across strings
      left[i] += filtered * 0.35 * (0.5 - pan);
      right[i] += filtered * 0.35 * (0.5 + pan);

      ksIdx = nextIdx;
    }
  }

  return buffer;
}

/**
 * Synthesizes a studio drum break (Kick, Snare, Hi-hats)
 */
function generateDrumBreakBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const bpm = 110;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const duration = barSec * 4; // 4 bars = 8.727s
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Pattern matrix: 16 steps per bar
  // 1 = Kick, 2 = Snare, 3 = Closed Hat, 4 = Open Hat
  const pattern = [
    [1, 0, 3, 0, 2, 0, 3, 1, 0, 1, 2, 0, 0, 0, 4, 0],
    [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 2, 0, 0, 1, 3, 0],
    [1, 0, 3, 0, 2, 0, 3, 1, 0, 0, 2, 0, 1, 0, 4, 0],
    [1, 0, 3, 1, 2, 0, 3, 0, 1, 1, 2, 0, 2, 0, 2, 2], // fill
  ];

  const stepSec = barSec / 16;

  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const hit = pattern[bar][step];
      const startSample = Math.floor((bar * barSec + step * stepSec) * sampleRate);

      if (hit === 1) {
        // Kick: pitch drop 150Hz -> 45Hz
        const kickDuration = Math.floor(sampleRate * 0.35);
        for (let i = 0; i < kickDuration && startSample + i < numSamples; i++) {
          const t = i / sampleRate;
          const pitch = 45 + 110 * Math.exp(-t * 30);
          const env = Math.exp(-t * 9);
          const val = Math.sin(2 * Math.PI * pitch * t) * env * 0.75;
          left[startSample + i] += val;
          right[startSample + i] += val;
        }
      } else if (hit === 2) {
        // Snare: 180Hz tone body + highpassed white noise burst
        const snareDuration = Math.floor(sampleRate * 0.28);
        for (let i = 0; i < snareDuration && startSample + i < numSamples; i++) {
          const t = i / sampleRate;
          const body = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 22) * 0.45;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.4;
          const val = body + noise;
          left[startSample + i] += val * 0.65;
          right[startSample + i] += val * 0.65;
        }
      } else if (hit === 3) {
        // Closed Hat: short metallic noise
        const hatDuration = Math.floor(sampleRate * 0.05);
        for (let i = 0; i < hatDuration && startSample + i < numSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.18;
          left[startSample + i] += noise * 0.4;
          right[startSample + i] += noise * 0.6;
        }
      } else if (hit === 4) {
        // Open Hat
        const hatDuration = Math.floor(sampleRate * 0.3);
        for (let i = 0; i < hatDuration && startSample + i < numSamples; i++) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.22;
          left[startSample + i] += noise * 0.4;
          right[startSample + i] += noise * 0.6;
        }
      }
    }
  }

  return buffer;
}

/**
 * Synthesizes a vocal choir drone with formant filters
 */
function generateVocalDroneBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const duration = 10.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // D Minor choral chord: D3 (146.83), A3 (220.0), F4 (349.23), D4 (293.66)
  const freqs = [146.83, 220.0, 293.66, 349.23];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Vibrato
    const vibrato = 1.0 + 0.008 * Math.sin(2 * Math.PI * 5.2 * t);
    // Breath envelope
    const env = Math.min(1.0, t / 1.5) * Math.min(1.0, (duration - t) / 1.5);

    let sumL = 0;
    let sumR = 0;

    for (let j = 0; j < freqs.length; j++) {
      const f = freqs[j] * vibrato;
      // Sawtooth with formant weighting (Ah vowel: ~700Hz and 1200Hz peaks)
      const saw1 = ((t * f) % 1) * 2 - 1;
      const saw2 = ((t * (f * 1.003) + 0.25) % 1) * 2 - 1;

      // Soft saturation & formant simulation
      const formantMod = Math.sin(2 * Math.PI * 800 * t) * 0.2;
      const tone = (saw1 * 0.6 + saw2 * 0.4 + formantMod) * 0.15;

      if (j % 2 === 0) {
        sumL += tone * 1.1;
        sumR += tone * 0.9;
      } else {
        sumL += tone * 0.9;
        sumR += tone * 1.1;
      }
    }

    left[i] = sumL * env;
    right[i] = sumR * env;
  }

  return buffer;
}

/**
 * Synthesizes reference pink noise impulse burst (Paul Kellet filter)
 */
function generatePinkNoiseBuffer(ctx: BaseAudioContext, sampleRate: number): AudioBuffer {
  const duration = 6.0;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Periodic burst: 1.5 sec on, 1.5 sec off
    const cycle = t % 3.0;
    const gate = cycle < 1.4 ? 1.0 : 0.0;
    const fade = gate > 0 ? Math.min(1.0, cycle / 0.05) * Math.min(1.0, (1.4 - cycle) / 0.05) : 0;

    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;

    left[i] = pink * fade * 0.5;
    right[i] = pink * fade * 0.5;
  }

  return buffer;
}
