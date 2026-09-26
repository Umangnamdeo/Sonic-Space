'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { SourceDeck } from '@/components/SourceDeck';
import { PlacementRadar } from '@/components/PlacementRadar';
import { ToneDeck } from '@/components/ToneDeck';
import { DspRack } from '@/components/DspRack';
import { VisualizerRack } from '@/components/VisualizerRack';
import { ExportModal } from '@/components/ExportModal';
import { UploadModal } from '@/components/UploadModal';
import { getSonicSpaceEngine } from '@/lib/audioEngine';
import {
  AudioSourceType,
  CompressorParameters,
  DelayParameters,
  EqParameters,
  RoomAcoustics,
  SaturatorParameters,
  SpacePreset,
  SpatialCoordinates,
  SpatialMotionConfig,
  ToneParameters,
} from '@/lib/audioTypes';
import { SPACE_PRESETS } from '@/lib/spacePresets';
import { BUILTIN_SOUND_PRESETS } from '@/lib/proceduralAudio';
import { calculateMotionCoordinates, MOTION_PRESETS } from '@/lib/spatialMotion';
import { ShieldCheck, Cpu, HardDrive, Sliders, Activity, ChevronDown, ChevronUp } from 'lucide-react';

export default function WorkstationPage() {
  const [engineReady, setEngineReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(12.0);
  const [isLooping, setIsLooping] = useState(true);
  const [isBypassed, setIsBypassed] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.9);
  const [sampleRate, setSampleRate] = useState(48000);

  // Audio Source State (Default to Vocal Melody for immediate 3D / 8D / 16D singer demonstration)
  const [sourceType, setSourceType] = useState<AudioSourceType>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState('singer-melody');
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  // Space Preset & Acoustics State
  const [currentSpacePresetId, setCurrentSpacePresetId] = useState('vocal-booth');
  const [acoustics, setAcoustics] = useState<RoomAcoustics>(
    (SPACE_PRESETS.find((p) => p.id === 'vocal-booth') || SPACE_PRESETS[0]).acoustics as RoomAcoustics
  );

  // Spatial Coordinates & 3D Motion Configuration
  const [coords, setCoords] = useState<SpatialCoordinates>({ x: 0, y: 1.8, z: 0.2 });

  // Default to Singer Stage Walk (Front-to-Back, Left-to-Right, Up-to-Down)
  const [motionConfig, setMotionConfig] = useState<SpatialMotionConfig>({
    pattern: 'singer-motion',
    speedHz: 0.07, // ~14 seconds per full natural stage walk
    radius: 2.6,
    depthRange: 2.8,
    elevationRange: 1.8,
    active: true,
  });

  // Tone Hardware Knobs (matching screenshot: INPUT, LOW, MID, MID FREQ 900Hz, HIGH)
  const [tone, setTone] = useState<ToneParameters>({
    inputGainDb: 0.0,
    lowGainDb: 0.0,
    midGainDb: 0.0,
    midFreqHz: 900,
    highGainDb: 0.0,
  });

  // Secondary DSP Rack States
  const [eq, setEq] = useState<EqParameters>({
    lowCut: { type: 'highpass', freq: 35, gain: 0, q: 0.707, active: true },
    lowShelf: { type: 'lowshelf', freq: 100, gain: 0, q: 0.707, active: true },
    midBell: { type: 'peaking', freq: 900, gain: 0, q: 1.2, active: true },
    highShelf: { type: 'highshelf', freq: 8500, gain: 0, q: 0.707, active: true },
    active: true,
  });

  const [compressor, setCompressor] = useState<CompressorParameters>({
    threshold: -18,
    ratio: 3.2,
    attack: 0.02,
    release: 0.15,
    knee: 8,
    makeupGain: 2.0,
    active: true,
  });

  const [saturator, setSaturator] = useState<SaturatorParameters>({
    drive: 0.18,
    type: 'tape',
    tone: 14000,
    mix: 0.4,
    active: true,
  });

  const [delay, setDelay] = useState<DelayParameters>({
    timeMs: 240,
    feedback: 0.25,
    pingPong: true,
    dampingHz: 6500,
    mix: 0.15,
    active: false,
  });

  const [gainReductionDb, setGainReductionDb] = useState(0);

  // Modals & Panels
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [showAdvancedPanels, setShowAdvancedPanels] = useState(false);

  // Ref to track elapsed time for smooth motion preview when paused or playing
  const lastTimeRef = useRef<number>(0);
  const virtualElapsedRef = useRef<number>(0);

  // Initialize engine with default vocal preset
  useEffect(() => {
    const engine = getSonicSpaceEngine();
    engine.loadPresetAudio('singer-melody').then((buffer) => {
      setDuration(buffer.duration);
      setEngineReady(true);
      const ctx = engine.getContext();
      if (ctx) setSampleRate(ctx.sampleRate);
    });

    return () => {
      engine.stop();
    };
  }, []);

  // Main high-precision animation loop for playback status, metrics, and 3D / 8D / 16D spatial motion
  useEffect(() => {
    let animId: number;

    const update = (now: number) => {
      const dt = lastTimeRef.current === 0 ? 0.016 : Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const engine = getSonicSpaceEngine();
      const state = engine.getPlaybackState();
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      if (state.duration > 0) {
        setDuration(state.duration);
      }

      const metrics = engine.getAudioMetrics();
      setGainReductionDb(metrics.gainReductionDb);

      // Automated 3D / 8D / 16D / Singer Spatial Motion Engine
      if (motionConfig.active && motionConfig.pattern !== 'manual') {
        virtualElapsedRef.current += dt;
        // When playing, use state.currentTime; when paused, use virtual elapsed to preview path smoothly
        const sampleTime = state.isPlaying ? state.currentTime : virtualElapsedRef.current;
        const newCoords = calculateMotionCoordinates(motionConfig, sampleTime, coords);
        setCoords(newCoords);
        engine.updateSpatialPosition(newCoords, true);
      }

      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [motionConfig, coords]);

  // Spacebar toggle Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target === document.body || (e.target as HTMLElement).tagName === 'DIV')) {
        e.preventDefault();
        const engine = getSonicSpaceEngine();
        if (isPlaying) {
          engine.pause();
        } else {
          engine.play();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Transport Handlers
  const handlePlay = useCallback(async () => {
    const engine = getSonicSpaceEngine();
    await engine.play();
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    const engine = getSonicSpaceEngine();
    engine.pause();
    setIsPlaying(false);
  }, []);

  const handleReturn = useCallback(() => {
    const engine = getSonicSpaceEngine();
    engine.seek(0);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((time: number) => {
    const engine = getSonicSpaceEngine();
    engine.seek(time);
    setCurrentTime(time);
  }, []);

  const handleToggleLoop = useCallback(() => {
    const next = !isLooping;
    setIsLooping(next);
    getSonicSpaceEngine().setLoop(next);
  }, [isLooping]);

  const handleMasterVolumeChange = useCallback((vol: number) => {
    setMasterVolume(vol);
    getSonicSpaceEngine().setMasterVolume(vol);
  }, []);

  const handleToggleBypass = useCallback(() => {
    const next = !isBypassed;
    setIsBypassed(next);
    getSonicSpaceEngine().setBypass(next);
  }, [isBypassed]);

  // Audio source loader handlers
  const handleSelectSoundPreset = useCallback(
    async (presetId: string) => {
      setSelectedPresetId(presetId);
      setSourceType('preset');
      setCustomFileName(null);
      const engine = getSonicSpaceEngine();
      const wasPlaying = isPlaying;
      const buf = await engine.loadPresetAudio(presetId);
      setDuration(buf.duration);
      if (wasPlaying) {
        await engine.play();
      }
    },
    [isPlaying]
  );

  const handleFileLoaded = useCallback(
    async (file: File) => {
      const engine = getSonicSpaceEngine();
      const wasPlaying = isPlaying;
      const buf = await engine.loadUploadedFile(file);
      setSourceType('upload');
      setCustomFileName(file.name);
      setDuration(buf.duration);
      if (wasPlaying) {
        await engine.play();
      }
    },
    [isPlaying]
  );

  // Coordinates and Space Preset handlers
  const handleCoordsChange = useCallback((newCoords: SpatialCoordinates) => {
    setCoords(newCoords);
    getSonicSpaceEngine().updateSpatialPosition(newCoords, false);
  }, []);

  const handleSelectSpacePreset = useCallback(
    (presetId: string) => {
      setCurrentSpacePresetId(presetId);
      const preset = SPACE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const engine = getSonicSpaceEngine();
      if (preset.acoustics) {
        const merged = { ...acoustics, ...preset.acoustics };
        setAcoustics(merged);
        engine.updateAcoustics(merged);
      }
    },
    [acoustics]
  );

  const handleAcousticsChange = useCallback((newAcoustics: RoomAcoustics) => {
    setAcoustics(newAcoustics);
    getSonicSpaceEngine().updateAcoustics(newAcoustics);
  }, []);

  // Tone handlers (updating preamp gain + low/mid/high EQ filters)
  const handleToneChange = useCallback(
    (newTone: ToneParameters) => {
      setTone(newTone);
      const engine = getSonicSpaceEngine();
      engine.updateTone(newTone);
      setEq((prev) => ({
        ...prev,
        lowShelf: { ...prev.lowShelf, gain: newTone.lowGainDb },
        midBell: { ...prev.midBell, gain: newTone.midGainDb, freq: newTone.midFreqHz },
        highShelf: { ...prev.highShelf, gain: newTone.highGainDb },
      }));
    },
    []
  );

  // Active labels
  const activeSourceLabel =
    sourceType === 'upload' && customFileName
      ? customFileName
      : BUILTIN_SOUND_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Vocal Melody';

  const activeSpaceName =
    SPACE_PRESETS.find((p) => p.id === currentSpacePresetId)?.name || 'Vocal Booth';

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-200 flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <Header
        currentPresetId={currentSpacePresetId}
        onSelectPreset={(preset) => handleSelectSpacePreset(preset.id)}
        isBypassed={isBypassed}
        onToggleBypass={handleToggleBypass}
        onOpenExport={() => setIsExportOpen(true)}
        sampleRate={sampleRate}
        isPlaying={isPlaying}
        activeSourceLabel={activeSourceLabel}
      />

      {/* Main Workstation Canvas */}
      <div className="flex-1 max-w-[1500px] w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* 1. SOURCE Deck (Matching top of screenshot) */}
        <SourceDeck
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onReturn={handleReturn}
          isLooping={isLooping}
          onToggleLoop={handleToggleLoop}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          sourceType={sourceType}
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectSoundPreset}
          onFileUploaded={handleFileLoaded}
          customFileName={customFileName}
        />

        {/* 2. Lower Two-Column Section (Matching screenshot: PLACEMENT on left, TONE & SPACE on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Left Column: PLACEMENT Radar & 3D Spatial Motion Presets */}
          <PlacementRadar
            coords={coords}
            onCoordsChange={handleCoordsChange}
            motionConfig={motionConfig}
            onMotionConfigChange={setMotionConfig}
            isPlaying={isPlaying}
          />

          {/* Right Column: TONE Hardware Knobs, SPACE & REVERB, MASTER & EXPORT */}
          <ToneDeck
            tone={tone}
            onToneChange={handleToneChange}
            acoustics={acoustics}
            onAcousticsChange={handleAcousticsChange}
            masterVolume={masterVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            isBypassed={isBypassed}
            onToggleBypass={handleToggleBypass}
            onOpenExport={() => setIsExportOpen(true)}
            currentSpacePresetId={currentSpacePresetId}
            onSelectSpacePreset={handleSelectSpacePreset}
          />
        </div>

        {/* 3. Optional Expandable Engineering Drawers (DSP Rack & Visualizer) */}
        <div className="w-full mt-1">
          <button
            onClick={() => setShowAdvancedPanels(!showAdvancedPanels)}
            className="w-full py-2 px-4 rounded bg-[#0b0e14] border border-[#171d27] hover:border-zinc-700 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {showAdvancedPanels
                  ? 'Hide Broadcast Analytics & Dynamics Rack'
                  : 'Open Broadcast Analytics (Phase Vectorscope, Spectrum RTA) & Dynamics Rack'}
              </span>
            </div>
            {showAdvancedPanels ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>

          {showAdvancedPanels && (
            <div className="mt-3 flex flex-col gap-4 animate-in fade-in duration-200">
              {/* Broadcast Visualizer Rack */}
              <VisualizerRack />

              {/* Dynamics Compressor, Tape Saturator, Stereo Delay */}
              <DspRack
                eq={eq}
                onEqChange={(newEq) => {
                  setEq(newEq);
                  getSonicSpaceEngine().updateEq(newEq);
                }}
                compressor={compressor}
                onCompressorChange={(newComp) => {
                  setCompressor(newComp);
                  getSonicSpaceEngine().updateCompressor(newComp);
                }}
                saturator={saturator}
                onSaturatorChange={(newSat) => {
                  setSaturator(newSat);
                  getSonicSpaceEngine().updateSaturator(newSat);
                }}
                delay={delay}
                onDelayChange={(newDelay) => {
                  setDelay(newDelay);
                  getSonicSpaceEngine().updateDelay(newDelay);
                }}
                gainReductionDb={gainReductionDb}
              />
            </div>
          )}
        </div>
      </div>

      {/* Engineering Footer Bar */}
      <footer className="w-full bg-[#080b0f] border-t border-[#141b25] px-4 py-2 text-[11px] font-mono text-zinc-500 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span>3D BINAURAL HRTF ENGINE</span>
          </div>

          <span className="text-zinc-800">|</span>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase">
              MOTION: {motionConfig.active ? motionConfig.pattern : 'MANUAL'}
            </span>
          </div>

          <span className="text-zinc-800 hidden md:inline">|</span>

          <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>LATENCY: ~4.8ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>ZERO EXTERNAL TRANSMISSION · 100% IN-BROWSER</span>
        </div>
      </footer>

      {/* Offline WAV Render Export Modal (baking 8D/16D/Singer movement into master WAV) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        presetName={activeSpaceName}
        motionConfig={motionConfig}
      />

      {/* Audio File Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onFileLoaded={handleFileLoaded}
      />
    </main>
  );
}
