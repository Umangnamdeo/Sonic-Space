import {
  AudioMetrics,
  CompressorParameters,
  DelayParameters,
  EqParameters,
  RoomAcoustics,
  SaturatorParameters,
  SpatialCoordinates,
  SpatialMotionConfig,
  ToneParameters,
} from './audioTypes';
import { generateRoomImpulseResponse } from './impulseGenerator';
import { generateProceduralAudio } from './proceduralAudio';
import { encodeAudioBufferToWav } from './wavEncoder';
import { calculateMotionCoordinates } from './spatialMotion';

export class SonicSpaceEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private currentBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  // DSP Nodes
  private inputGainNode: GainNode | null = null;
  private waveShaperNode: WaveShaperNode | null = null;
  private satToneNode: BiquadFilterNode | null = null;
  private satDryGain: GainNode | null = null;
  private satWetGain: GainNode | null = null;

  // 4-Band EQ
  private eqLowCut: BiquadFilterNode | null = null;
  private eqLowShelf: BiquadFilterNode | null = null;
  private eqMidBell: BiquadFilterNode | null = null;
  private eqHighShelf: BiquadFilterNode | null = null;

  // Dynamics Compressor
  private compressorNode: DynamicsCompressorNode | null = null;
  private makeupGainNode: GainNode | null = null;

  // Spatial Panner & Acoustics
  private spatialPanner: PannerNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // Delay
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayFilterNode: BiquadFilterNode | null = null;
  private delayWetGain: GainNode | null = null;

  // Master & Bypass
  private masterGainNode: GainNode | null = null;
  private bypassSwitchGain: GainNode | null = null;
  private processedSwitchGain: GainNode | null = null;

  // Metering Analysers (Dual channel)
  private channelSplitter: ChannelSplitterNode | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;

  // Playback state
  private playbackStartTime: number = 0;
  private playbackOffset: number = 0;
  private isLooping: boolean = true;
  private isMicActive: boolean = false;
  private isBypassed: boolean = false;

  // State parameters cache
  private currentAcoustics: RoomAcoustics = {
    width: 10,
    length: 14,
    height: 4.5,
    rt60: 1.8,
    damping: 6500,
    material: 'studio',
    earlyReflections: 0.7,
    preDelayMs: 25,
    wetMix: 0.35,
  };

  private currentCoords: SpatialCoordinates = { x: 0, y: 3.5, z: 0 };

  private currentEq: EqParameters = {
    lowCut: { type: 'highpass', freq: 35, gain: 0, q: 0.707, active: true },
    lowShelf: { type: 'lowshelf', freq: 140, gain: 1.5, q: 0.707, active: true },
    midBell: { type: 'peaking', freq: 1250, gain: -1.0, q: 1.2, active: true },
    highShelf: { type: 'highshelf', freq: 8500, gain: 2.0, q: 0.707, active: true },
    active: true,
  };

  private currentComp: CompressorParameters = {
    threshold: -18,
    ratio: 3.5,
    attack: 0.025,
    release: 0.15,
    knee: 8,
    makeupGain: 2.5,
    active: true,
  };

  private currentSat: SaturatorParameters = {
    drive: 0.25,
    type: 'tape',
    tone: 14000,
    mix: 0.6,
    active: true,
  };

  private currentDelay: DelayParameters = {
    timeMs: 240,
    feedback: 0.35,
    pingPong: true,
    dampingHz: 6500,
    mix: 0.2,
    active: false,
  };

  // Reusable data arrays for high-performance visualizers
  private timeDataL: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(1024 * 4));
  private timeDataR: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(1024 * 4));
  private freqDataL: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));
  private freqDataR: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));

  constructor() {
    // Lazy AudioContext creation on first user interaction
  }

  public async initContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
      this.buildDspGraph();
      // Generate initial impulse
      this.updateAcoustics(this.currentAcoustics);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  private buildDspGraph(): void {
    if (!this.ctx) return;

    // 1. Input Gain
    this.inputGainNode = this.ctx.createGain();

    // 2. Bypass switch
    this.bypassSwitchGain = this.ctx.createGain();
    this.bypassSwitchGain.gain.value = 0; // 0 when processed, 1 when bypassed
    this.processedSwitchGain = this.ctx.createGain();
    this.processedSwitchGain.gain.value = 1;

    // 3. Saturator
    this.waveShaperNode = this.ctx.createWaveShaper();
    this.waveShaperNode.curve = this.createSaturationCurve(this.currentSat.drive, this.currentSat.type);
    this.waveShaperNode.oversample = '4x';

    this.satToneNode = this.ctx.createBiquadFilter();
    this.satToneNode.type = 'lowpass';
    this.satToneNode.frequency.value = this.currentSat.tone;

    this.satDryGain = this.ctx.createGain();
    this.satWetGain = this.ctx.createGain();
    this.satDryGain.gain.value = 1 - this.currentSat.mix;
    this.satWetGain.gain.value = this.currentSat.mix;

    // Connect Saturator
    this.inputGainNode.connect(this.satDryGain);
    this.inputGainNode.connect(this.waveShaperNode);
    this.waveShaperNode.connect(this.satToneNode);
    this.satToneNode.connect(this.satWetGain);

    const satSum = this.ctx.createGain();
    this.satDryGain.connect(satSum);
    this.satWetGain.connect(satSum);

    // 4. 4-Band Parametric EQ
    this.eqLowCut = this.ctx.createBiquadFilter();
    this.eqLowCut.type = 'highpass';
    this.eqLowCut.frequency.value = this.currentEq.lowCut.freq;
    this.eqLowCut.Q.value = this.currentEq.lowCut.q;

    this.eqLowShelf = this.ctx.createBiquadFilter();
    this.eqLowShelf.type = 'lowshelf';
    this.eqLowShelf.frequency.value = this.currentEq.lowShelf.freq;
    this.eqLowShelf.gain.value = this.currentEq.lowShelf.gain;

    this.eqMidBell = this.ctx.createBiquadFilter();
    this.eqMidBell.type = 'peaking';
    this.eqMidBell.frequency.value = this.currentEq.midBell.freq;
    this.eqMidBell.Q.value = this.currentEq.midBell.q;
    this.eqMidBell.gain.value = this.currentEq.midBell.gain;

    this.eqHighShelf = this.ctx.createBiquadFilter();
    this.eqHighShelf.type = 'highshelf';
    this.eqHighShelf.frequency.value = this.currentEq.highShelf.freq;
    this.eqHighShelf.gain.value = this.currentEq.highShelf.gain;

    satSum.connect(this.eqLowCut);
    this.eqLowCut.connect(this.eqLowShelf);
    this.eqLowShelf.connect(this.eqMidBell);
    this.eqMidBell.connect(this.eqHighShelf);

    // 5. Dynamics Compressor
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = this.currentComp.threshold;
    this.compressorNode.knee.value = this.currentComp.knee;
    this.compressorNode.ratio.value = this.currentComp.ratio;
    this.compressorNode.attack.value = this.currentComp.attack;
    this.compressorNode.release.value = this.currentComp.release;

    this.makeupGainNode = this.ctx.createGain();
    this.makeupGainNode.gain.value = Math.pow(10, this.currentComp.makeupGain / 20);

    this.eqHighShelf.connect(this.compressorNode);
    this.compressorNode.connect(this.makeupGainNode);

    // 6. Spatial Acoustics (3D Panner + Convolution Reverb)
    this.spatialPanner = this.ctx.createPanner();
    this.spatialPanner.panningModel = 'HRTF';
    this.spatialPanner.distanceModel = 'inverse';
    this.spatialPanner.refDistance = 1.0;
    this.spatialPanner.maxDistance = 100.0;
    this.spatialPanner.rolloffFactor = 0.8;
    this.spatialPanner.coneInnerAngle = 360;

    // Set initial spatial coordinates
    this.updateSpatialPosition(this.currentCoords);

    this.convolverNode = this.ctx.createConvolver();
    this.reverbDryGain = this.ctx.createGain();
    this.reverbWetGain = this.ctx.createGain();
    this.reverbDryGain.gain.value = 1.0 - this.currentAcoustics.wetMix * 0.5;
    this.reverbWetGain.gain.value = this.currentAcoustics.wetMix;

    // Route through panner
    this.makeupGainNode.connect(this.spatialPanner);

    // Split to dry panned sound and room convolver
    this.spatialPanner.connect(this.reverbDryGain);
    this.spatialPanner.connect(this.convolverNode);
    this.convolverNode.connect(this.reverbWetGain);

    const spaceSum = this.ctx.createGain();
    this.reverbDryGain.connect(spaceSum);
    this.reverbWetGain.connect(spaceSum);

    // 7. Stereo Delay
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = this.currentDelay.timeMs / 1000;

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.value = this.currentDelay.feedback;

    this.delayFilterNode = this.ctx.createBiquadFilter();
    this.delayFilterNode.type = 'lowpass';
    this.delayFilterNode.frequency.value = this.currentDelay.dampingHz;

    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.value = this.currentDelay.active ? this.currentDelay.mix : 0;

    // Delay loop
    spaceSum.connect(this.delayNode);
    this.delayNode.connect(this.delayFilterNode);
    this.delayFilterNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayFilterNode.connect(this.delayWetGain);

    // 8. Processed sum
    const processedBus = this.ctx.createGain();
    spaceSum.connect(processedBus);
    this.delayWetGain.connect(processedBus);

    // Switch between Processed Bus and Raw Dry Input
    processedBus.connect(this.processedSwitchGain);
    this.inputGainNode.connect(this.bypassSwitchGain);

    // 9. Master Gain
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.value = 0.9;

    this.processedSwitchGain.connect(this.masterGainNode);
    this.bypassSwitchGain.connect(this.masterGainNode);

    // 10. Dual Channel Metering Analysers
    this.channelSplitter = this.ctx.createChannelSplitter(2);
    this.analyserLeft = this.ctx.createAnalyser();
    this.analyserRight = this.ctx.createAnalyser();

    this.analyserLeft.fftSize = 2048;
    this.analyserRight.fftSize = 2048;
    this.analyserLeft.smoothingTimeConstant = 0.8;
    this.analyserRight.smoothingTimeConstant = 0.8;

    this.masterGainNode.connect(this.channelSplitter);
    this.channelSplitter.connect(this.analyserLeft, 0);
    this.channelSplitter.connect(this.analyserRight, 1);

    // Final destination
    this.masterGainNode.connect(this.ctx.destination);
  }

  /**
   * Load and play built-in preset or uploaded audio buffer
   */
  public async loadPresetAudio(presetId: string): Promise<AudioBuffer> {
    const ctx = await this.initContext();
    const buffer = generateProceduralAudio(ctx, presetId);
    this.currentBuffer = buffer;
    this.playbackOffset = 0;
    return buffer;
  }

  /**
   * Safely load untrusted user-uploaded audio file
   */
  public async loadUploadedFile(file: File): Promise<AudioBuffer> {
    // Security: Validate file size (max 50 MB)
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 50MB safety limit.`);
    }

    // Security: Validate mime type and extension
    const allowedExtensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.aiff', '.webm'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => lowerName.endsWith(ext));
    const isAudioMime = file.type.startsWith('audio/') || file.type === 'video/ogg' || file.type === '';

    if (!hasValidExt && !isAudioMime) {
      throw new Error(`Unsupported audio format. Supported: WAV, MP3, FLAC, OGG, AAC.`);
    }

    const ctx = await this.initContext();
    const arrayBuffer = await file.arrayBuffer();

    try {
      // Decode audio data safely in-memory
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.currentBuffer = audioBuffer;
      this.playbackOffset = 0;
      return audioBuffer;
    } catch {
      throw new Error(`Corrupt or unreadable audio stream. Please check file integrity.`);
    }
  }

  /**
   * Toggle microphone input safely
   */
  public async setMicInput(enabled: boolean): Promise<boolean> {
    const ctx = await this.initContext();

    if (enabled) {
      this.stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
          },
        });
        this.micStream = stream;
        this.micSourceNode = ctx.createMediaStreamSource(stream);
        if (this.inputGainNode) {
          this.micSourceNode.connect(this.inputGainNode);
        }
        this.isMicActive = true;
        this.isRunning = true;
        return true;
      } catch {
        this.isMicActive = false;
        throw new Error('Microphone access denied or audio device not found.');
      }
    } else {
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
      this.isMicActive = false;
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Transport controls
   */
  public async play(): Promise<void> {
    const ctx = await this.initContext();

    if (this.isMicActive) return;
    if (!this.currentBuffer) return;

    if (this.isRunning) {
      this.stop();
    }

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = this.isLooping;

    if (this.inputGainNode) {
      this.sourceNode.connect(this.inputGainNode);
    }

    this.playbackStartTime = ctx.currentTime - this.playbackOffset;
    this.sourceNode.start(0, this.playbackOffset % this.currentBuffer.duration);
    this.isRunning = true;

    this.sourceNode.onended = () => {
      if (!this.isLooping) {
        this.isRunning = false;
        this.playbackOffset = 0;
      }
    };
  }

  public pause(): void {
    if (!this.isRunning || !this.ctx) return;

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // already stopped
      }
      this.sourceNode = null;
    }

    if (this.currentBuffer) {
      const elapsed = this.ctx.currentTime - this.playbackStartTime;
      this.playbackOffset = (elapsed % this.currentBuffer.duration);
    }

    this.isRunning = false;
  }

  public stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    this.playbackOffset = 0;
    this.isRunning = false;
  }

  public seek(timeSeconds: number): void {
    if (!this.currentBuffer) return;
    const clamped = Math.max(0, Math.min(this.currentBuffer.duration, timeSeconds));
    this.playbackOffset = clamped;
    if (this.isRunning) {
      this.play();
    }
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
    if (this.sourceNode) {
      this.sourceNode.loop = loop;
    }
  }

  public getPlaybackState(): {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isLooping: boolean;
    isMic: boolean;
  } {
    if (this.isMicActive) {
      return {
        isPlaying: true,
        currentTime: this.ctx ? this.ctx.currentTime : 0,
        duration: 0,
        isLooping: false,
        isMic: true,
      };
    }

    const duration = this.currentBuffer ? this.currentBuffer.duration : 0;
    let currentTime = this.playbackOffset;

    if (this.isRunning && this.ctx && duration > 0) {
      const elapsed = this.ctx.currentTime - this.playbackStartTime;
      currentTime = this.isLooping ? (elapsed % duration) : Math.min(elapsed, duration);
    }

    return {
      isPlaying: this.isRunning,
      currentTime,
      duration,
      isLooping: this.isLooping,
      isMic: false,
    };
  }

  /**
   * Spatial & Acoustic controls
   */
  public updateSpatialPosition(pos: SpatialCoordinates, smooth = true): void {
    this.currentCoords = { ...pos };
    if (!this.spatialPanner || !this.ctx) return;

    const t = this.ctx.currentTime;
    const ramp = smooth ? 0.02 : 0.005;
    // Map coords into 3D audio space
    if (this.spatialPanner.positionX) {
      this.spatialPanner.positionX.setTargetAtTime(pos.x, t, ramp);
      this.spatialPanner.positionY.setTargetAtTime(pos.y, t, ramp);
      this.spatialPanner.positionZ.setTargetAtTime(pos.z, t, ramp);
    } else {
      this.spatialPanner.setPosition(pos.x, pos.y, pos.z);
    }
  }

  public updateAcoustics(acoustics: RoomAcoustics): void {
    this.currentAcoustics = { ...acoustics };
    if (!this.ctx || !this.convolverNode || !this.reverbWetGain || !this.reverbDryGain) return;

    // Recalculate room impulse response
    const impulse = generateRoomImpulseResponse(this.ctx, acoustics, this.currentCoords);
    this.convolverNode.buffer = impulse;

    const t = this.ctx.currentTime;
    this.reverbWetGain.gain.setTargetAtTime(acoustics.wetMix, t, 0.04);
    this.reverbDryGain.gain.setTargetAtTime(1.0 - acoustics.wetMix * 0.4, t, 0.04);
  }

  /**
   * DSP Rack Parameters
   */
  public updateEq(eq: EqParameters): void {
    this.currentEq = { ...eq };
    if (!this.ctx || !this.eqLowCut || !this.eqLowShelf || !this.eqMidBell || !this.eqHighShelf) return;

    const t = this.ctx.currentTime;
    const ramp = 0.04;

    this.eqLowCut.frequency.setTargetAtTime(eq.lowCut.freq, t, ramp);
    this.eqLowCut.Q.setTargetAtTime(eq.lowCut.q, t, ramp);

    this.eqLowShelf.frequency.setTargetAtTime(eq.lowShelf.freq, t, ramp);
    this.eqLowShelf.gain.setTargetAtTime(eq.active ? eq.lowShelf.gain : 0, t, ramp);

    this.eqMidBell.frequency.setTargetAtTime(eq.midBell.freq, t, ramp);
    this.eqMidBell.Q.setTargetAtTime(eq.midBell.q, t, ramp);
    this.eqMidBell.gain.setTargetAtTime(eq.active ? eq.midBell.gain : 0, t, ramp);

    this.eqHighShelf.frequency.setTargetAtTime(eq.highShelf.freq, t, ramp);
    this.eqHighShelf.gain.setTargetAtTime(eq.active ? eq.highShelf.gain : 0, t, ramp);
  }

  public updateCompressor(comp: CompressorParameters): void {
    this.currentComp = { ...comp };
    if (!this.ctx || !this.compressorNode || !this.makeupGainNode) return;

    const t = this.ctx.currentTime;
    const ramp = 0.04;

    if (comp.active) {
      this.compressorNode.threshold.setTargetAtTime(comp.threshold, t, ramp);
      this.compressorNode.ratio.setTargetAtTime(comp.ratio, t, ramp);
      this.compressorNode.attack.setTargetAtTime(comp.attack, t, ramp);
      this.compressorNode.release.setTargetAtTime(comp.release, t, ramp);
      this.compressorNode.knee.setTargetAtTime(comp.knee, t, ramp);
      this.makeupGainNode.gain.setTargetAtTime(Math.pow(10, comp.makeupGain / 20), t, ramp);
    } else {
      this.compressorNode.threshold.setTargetAtTime(0, t, ramp);
      this.compressorNode.ratio.setTargetAtTime(1, t, ramp);
      this.makeupGainNode.gain.setTargetAtTime(1.0, t, ramp);
    }
  }

  public updateSaturator(sat: SaturatorParameters): void {
    this.currentSat = { ...sat };
    if (!this.ctx || !this.waveShaperNode || !this.satToneNode || !this.satWetGain || !this.satDryGain) return;

    const t = this.ctx.currentTime;
    this.waveShaperNode.curve = this.createSaturationCurve(sat.active ? sat.drive : 0, sat.type);
    this.satToneNode.frequency.setTargetAtTime(sat.tone, t, 0.04);

    const wet = sat.active ? sat.mix : 0;
    this.satWetGain.gain.setTargetAtTime(wet, t, 0.04);
    this.satDryGain.gain.setTargetAtTime(1.0 - wet * 0.5, t, 0.04);
  }

  public updateDelay(delay: DelayParameters): void {
    this.currentDelay = { ...delay };
    if (!this.ctx || !this.delayNode || !this.delayFeedbackGain || !this.delayFilterNode || !this.delayWetGain) return;

    const t = this.ctx.currentTime;
    this.delayNode.delayTime.setTargetAtTime(delay.timeMs / 1000, t, 0.05);
    this.delayFeedbackGain.gain.setTargetAtTime(delay.active ? delay.feedback : 0, t, 0.05);
    this.delayFilterNode.frequency.setTargetAtTime(delay.dampingHz, t, 0.05);
    this.delayWetGain.gain.setTargetAtTime(delay.active ? delay.mix : 0, t, 0.05);
  }

  public setInputGain(gainDb: number): void {
    if (!this.ctx || !this.inputGainNode) return;
    const linear = Math.pow(10, gainDb / 20);
    this.inputGainNode.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.04);
  }

  public updateTone(tone: ToneParameters): void {
    if (!this.ctx) return;
    this.setInputGain(tone.inputGainDb);
    this.updateEq({
      ...this.currentEq,
      lowShelf: { ...this.currentEq.lowShelf, gain: tone.lowGainDb },
      midBell: { ...this.currentEq.midBell, gain: tone.midGainDb, freq: tone.midFreqHz },
      highShelf: { ...this.currentEq.highShelf, gain: tone.highGainDb },
      active: true,
    });
  }

  public setMasterVolume(vol: number): void {
    if (!this.ctx || !this.masterGainNode) return;
    this.masterGainNode.gain.setTargetAtTime(Math.max(0, Math.min(1.5, vol)), this.ctx.currentTime, 0.04);
  }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!this.ctx || !this.bypassSwitchGain || !this.processedSwitchGain) return;

    const t = this.ctx.currentTime;
    if (bypass) {
      this.processedSwitchGain.gain.setTargetAtTime(0, t, 0.03);
      this.bypassSwitchGain.gain.setTargetAtTime(1, t, 0.03);
    } else {
      this.bypassSwitchGain.gain.setTargetAtTime(0, t, 0.03);
      this.processedSwitchGain.gain.setTargetAtTime(1, t, 0.03);
    }
  }

  public getBypass(): boolean {
    return this.isBypassed;
  }

  /**
   * Saturation curve generator (soft-clip tanh / polynomial)
   */
  private createSaturationCurve(drive: number, type: 'tape' | 'tube' | 'transistor'): Float32Array<ArrayBuffer> {
    const samples = 4096;
    const arrayBuffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(arrayBuffer);
    const k = Math.max(0, drive * 50);

    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;

      if (k === 0) {
        curve[i] = x;
        continue;
      }

      if (type === 'tube') {
        // Asymmetrical tube triode soft-saturation
        if (x < -1) {
          curve[i] = -2 / 3;
        } else if (x > 1) {
          curve[i] = 2 / 3;
        } else {
          curve[i] = x - (x * x * x) / 3;
        }
      } else if (type === 'transistor') {
        // Harder knee clipping
        curve[i] = Math.tanh((1 + k * 0.5) * x);
      } else {
        // Tape saturation with gentle compression
        const deg = Math.PI / 180;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  /**
   * Read real-time audio metrics for visualizers and meters
   */
  public getAudioMetrics(): AudioMetrics {
    if (!this.analyserLeft || !this.analyserRight) {
      return {
        peakL: 0,
        peakR: 0,
        rmsL: 0,
        rmsR: 0,
        gainReductionDb: 0,
        phaseCorrelation: 1.0,
      };
    }

    this.analyserLeft.getFloatTimeDomainData(this.timeDataL);
    this.analyserRight.getFloatTimeDomainData(this.timeDataR);

    let sumL2 = 0;
    let sumR2 = 0;
    let sumLR = 0;
    let maxL = 0;
    let maxR = 0;
    const len = this.timeDataL.length;

    for (let i = 0; i < len; i++) {
      const l = this.timeDataL[i];
      const r = this.timeDataR[i];

      const absL = Math.abs(l);
      const absR = Math.abs(r);

      if (absL > maxL) maxL = absL;
      if (absR > maxR) maxR = absR;

      sumL2 += l * l;
      sumR2 += r * r;
      sumLR += l * r;
    }

    const rmsL = Math.sqrt(sumL2 / len);
    const rmsR = Math.sqrt(sumR2 / len);

    // Phase correlation coefficient: -1 to +1
    let correlation = 1.0;
    const denom = Math.sqrt(sumL2 * sumR2);
    if (denom > 0.00001) {
      correlation = sumLR / denom;
    }

    // Gain reduction from active compressor
    const gainReductionDb = this.compressorNode ? Math.abs(this.compressorNode.reduction) : 0;

    return {
      peakL: maxL,
      peakR: maxR,
      rmsL,
      rmsR,
      gainReductionDb,
      phaseCorrelation: correlation,
    };
  }

  public getVisualizerData(): {
    timeDataL: Float32Array;
    timeDataR: Float32Array;
    freqDataL: Uint8Array;
    freqDataR: Uint8Array;
  } {
    if (this.analyserLeft && this.analyserRight) {
      this.analyserLeft.getFloatTimeDomainData(this.timeDataL);
      this.analyserRight.getFloatTimeDomainData(this.timeDataR);
      this.analyserLeft.getByteFrequencyData(this.freqDataL);
      this.analyserRight.getByteFrequencyData(this.freqDataR);
    }
    return {
      timeDataL: this.timeDataL,
      timeDataR: this.timeDataR,
      freqDataL: this.freqDataL,
      freqDataR: this.freqDataR,
    };
  }

  /**
   * Offline Audio Export to WAV
   * Genuine offline DSP rendering of the processed acoustic soundscape!
   */
  public async exportProcessedWav(options: {
    bitDepth?: 16 | 24;
    motionConfig?: SpatialMotionConfig;
  } = {}): Promise<{ blob: Blob; size: number; duration: number }> {
    if (!this.currentBuffer) {
      throw new Error('No audio loaded to export.');
    }

    const duration = this.currentBuffer.duration;
    const sampleRate = this.currentBuffer.sampleRate;
    const length = Math.floor(duration * sampleRate);

    // Create OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    // 1. Source
    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = this.currentBuffer;

    // 2. Saturator
    const offWaveShaper = offlineCtx.createWaveShaper();
    offWaveShaper.curve = this.createSaturationCurve(this.currentSat.active ? this.currentSat.drive : 0, this.currentSat.type);

    const offSatTone = offlineCtx.createBiquadFilter();
    offSatTone.type = 'lowpass';
    offSatTone.frequency.value = this.currentSat.tone;

    const offSatDry = offlineCtx.createGain();
    const offSatWet = offlineCtx.createGain();
    const wet = this.currentSat.active ? this.currentSat.mix : 0;
    offSatWet.gain.value = wet;
    offSatDry.gain.value = 1.0 - wet * 0.5;

    offlineSource.connect(offSatDry);
    offlineSource.connect(offWaveShaper);
    offWaveShaper.connect(offSatTone);
    offSatTone.connect(offSatWet);

    const satSum = offlineCtx.createGain();
    offSatDry.connect(satSum);
    offSatWet.connect(satSum);

    // 3. EQ
    const offEqLowCut = offlineCtx.createBiquadFilter();
    offEqLowCut.type = 'highpass';
    offEqLowCut.frequency.value = this.currentEq.lowCut.freq;
    offEqLowCut.Q.value = this.currentEq.lowCut.q;

    const offEqLowShelf = offlineCtx.createBiquadFilter();
    offEqLowShelf.type = 'lowshelf';
    offEqLowShelf.frequency.value = this.currentEq.lowShelf.freq;
    offEqLowShelf.gain.value = this.currentEq.active ? this.currentEq.lowShelf.gain : 0;

    const offEqMidBell = offlineCtx.createBiquadFilter();
    offEqMidBell.type = 'peaking';
    offEqMidBell.frequency.value = this.currentEq.midBell.freq;
    offEqMidBell.Q.value = this.currentEq.midBell.q;
    offEqMidBell.gain.value = this.currentEq.active ? this.currentEq.midBell.gain : 0;

    const offEqHighShelf = offlineCtx.createBiquadFilter();
    offEqHighShelf.type = 'highshelf';
    offEqHighShelf.frequency.value = this.currentEq.highShelf.freq;
    offEqHighShelf.gain.value = this.currentEq.active ? this.currentEq.highShelf.gain : 0;

    satSum.connect(offEqLowCut);
    offEqLowCut.connect(offEqLowShelf);
    offEqLowShelf.connect(offEqMidBell);
    offEqMidBell.connect(offEqHighShelf);

    // 4. Compressor
    const offComp = offlineCtx.createDynamicsCompressor();
    const offMakeup = offlineCtx.createGain();
    if (this.currentComp.active) {
      offComp.threshold.value = this.currentComp.threshold;
      offComp.ratio.value = this.currentComp.ratio;
      offComp.attack.value = this.currentComp.attack;
      offComp.release.value = this.currentComp.release;
      offComp.knee.value = this.currentComp.knee;
      offMakeup.gain.value = Math.pow(10, this.currentComp.makeupGain / 20);
    } else {
      offComp.threshold.value = 0;
      offComp.ratio.value = 1;
      offMakeup.gain.value = 1;
    }

    offEqHighShelf.connect(offComp);
    offComp.connect(offMakeup);

    // 5. Spatial Panner
    const offPanner = offlineCtx.createPanner();
    offPanner.panningModel = 'HRTF';
    offPanner.distanceModel = 'inverse';

    if (options.motionConfig && options.motionConfig.active && options.motionConfig.pattern !== 'manual' && offPanner.positionX) {
      // Keyframe motion across entire duration at 20 updates per second
      const step = 0.05;
      for (let sec = 0; sec <= duration; sec += step) {
        const p = calculateMotionCoordinates(options.motionConfig, sec, this.currentCoords);
        offPanner.positionX.setValueAtTime(p.x, sec);
        offPanner.positionY.setValueAtTime(p.y, sec);
        offPanner.positionZ.setValueAtTime(p.z, sec);
      }
    } else if (offPanner.positionX) {
      offPanner.positionX.value = this.currentCoords.x;
      offPanner.positionY.value = this.currentCoords.y;
      offPanner.positionZ.value = this.currentCoords.z;
    } else {
      offPanner.setPosition(this.currentCoords.x, this.currentCoords.y, this.currentCoords.z);
    }

    offMakeup.connect(offPanner);

    // 6. Convolution Reverb
    const offConvolver = offlineCtx.createConvolver();
    offConvolver.buffer = generateRoomImpulseResponse(offlineCtx, this.currentAcoustics, this.currentCoords);

    const offRevDry = offlineCtx.createGain();
    const offRevWet = offlineCtx.createGain();
    offRevWet.gain.value = this.currentAcoustics.wetMix;
    offRevDry.gain.value = 1.0 - this.currentAcoustics.wetMix * 0.4;

    offPanner.connect(offRevDry);
    offPanner.connect(offConvolver);
    offConvolver.connect(offRevWet);

    const offSpaceSum = offlineCtx.createGain();
    offRevDry.connect(offSpaceSum);
    offRevWet.connect(offSpaceSum);

    // 7. Delay
    const offDelay = offlineCtx.createDelay(2.0);
    offDelay.delayTime.value = this.currentDelay.timeMs / 1000;
    const offDelayFb = offlineCtx.createGain();
    offDelayFb.gain.value = this.currentDelay.active ? this.currentDelay.feedback : 0;
    const offDelayFilter = offlineCtx.createBiquadFilter();
    offDelayFilter.type = 'lowpass';
    offDelayFilter.frequency.value = this.currentDelay.dampingHz;
    const offDelayWet = offlineCtx.createGain();
    offDelayWet.gain.value = this.currentDelay.active ? this.currentDelay.mix : 0;

    offSpaceSum.connect(offDelay);
    offDelay.connect(offDelayFilter);
    offDelayFilter.connect(offDelayFb);
    offDelayFb.connect(offDelay);
    offDelayFilter.connect(offDelayWet);

    // 8. Output
    const offMaster = offlineCtx.createGain();
    offMaster.gain.value = this.masterGainNode ? this.masterGainNode.gain.value : 0.9;

    offSpaceSum.connect(offMaster);
    offDelayWet.connect(offMaster);
    offMaster.connect(offlineCtx.destination);

    offlineSource.start(0);

    // Render buffer
    const renderedBuffer = await offlineCtx.startRendering();

    // Encode to WAV
    const wavBlob = encodeAudioBufferToWav(renderedBuffer, { bitDepth: options.bitDepth || 16 });

    return {
      blob: wavBlob,
      size: wavBlob.size,
      duration: renderedBuffer.duration,
    };
  }

  public getCurrentAcoustics(): RoomAcoustics {
    return { ...this.currentAcoustics };
  }

  public getCurrentCoords(): SpatialCoordinates {
    return { ...this.currentCoords };
  }

  public getCurrentEq(): EqParameters {
    return { ...this.currentEq };
  }

  public getCurrentCompressor(): CompressorParameters {
    return { ...this.currentComp };
  }

  public getCurrentSaturator(): SaturatorParameters {
    return { ...this.currentSat };
  }

  public getCurrentDelay(): DelayParameters {
    return { ...this.currentDelay };
  }

  public getMasterVolume(): number {
    return this.masterGainNode ? this.masterGainNode.gain.value : 0.9;
  }

  public dispose(): void {
    this.stop();
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// Global engine singleton instance
let engineInstance: SonicSpaceEngine | null = null;

export function getSonicSpaceEngine(): SonicSpaceEngine {
  if (!engineInstance) {
    engineInstance = new SonicSpaceEngine();
  }
  return engineInstance;
}
