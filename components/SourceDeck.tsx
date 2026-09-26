'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Repeat, UploadCloud, Music, ChevronDown } from 'lucide-react';
import { BUILTIN_SOUND_PRESETS } from '@/lib/proceduralAudio';
import { AudioSourceType } from '@/lib/audioTypes';
import { getSonicSpaceEngine } from '@/lib/audioEngine';

interface SourceDeckProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReturn: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  sourceType: AudioSourceType;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onFileUploaded: (file: File) => void;
  customFileName?: string | null;
}

export const SourceDeck: React.FC<SourceDeckProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onReturn,
  isLooping,
  onToggleLoop,
  currentTime,
  duration,
  onSeek,
  sourceType,
  selectedPresetId,
  onSelectPreset,
  onFileUploaded,
  customFileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  // Format time as M:SS.S / M:SS.S (e.g. 0:00.0 / 0:00.0 matching screenshot)
  const formatTime = (sec: number): string => {
    if (isNaN(sec) || sec < 0) sec = 0;
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    const secs = Math.floor(remainder);
    const tenths = Math.floor((remainder % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUploaded(file);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onFileUploaded(file);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformContainerRef.current || duration <= 0) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  // Render waveform peaks
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const engine = getSonicSpaceEngine();
    const buffer = engine.getAudioBuffer();

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!buffer) {
      return;
    }

    const channelData = buffer.getChannelData(0);
    const totalSamples = channelData.length;
    const step = Math.ceil(totalSamples / w);
    const mid = h / 2;
    const progress = duration > 0 ? currentTime / duration : 0;
    const playheadX = progress * w;

    // Draw waveform bars
    for (let x = 0; x < w; x++) {
      let min = 1.0;
      let max = -1.0;
      const start = x * step;
      const end = Math.min(start + step, totalSamples);

      for (let s = start; s < end; s += Math.max(1, Math.floor(step / 16))) {
        const val = channelData[s];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      const amp = Math.max(0.04, (max - min) * 0.5);
      const barH = amp * (h * 0.78);

      // Distinct color before and after playhead
      if (x < playheadX) {
        ctx.fillStyle = '#f59e0b'; // amber played
      } else {
        ctx.fillStyle = '#334155'; // slate unplayed
      }

      ctx.fillRect(x, mid - barH / 2, 1.5, Math.max(1.5, barH));
    }

    // Playhead line
    if (playheadX >= 0 && playheadX <= w) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(playheadX - 1, 0, 2, h);

      // Playhead glow
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fillRect(playheadX - 4, 0, 8, h);
    }
  }, [currentTime, duration, sourceType, selectedPresetId, customFileName]);

  const activePreset = BUILTIN_SOUND_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <div
      id="source-deck-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full bg-[#0b0e14] border ${
        isDragOver ? 'border-amber-500/80 bg-[#121722]' : 'border-[#171d27]'
      } rounded-lg p-4 sm:p-5 transition-colors relative`}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Section */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase block mb-1">
            SOURCE
          </span>
          <h2 className="text-zinc-200 text-sm sm:text-base font-medium flex items-center gap-2">
            {customFileName ? (
              <span className="truncate max-w-xs sm:max-w-md text-amber-400 font-mono text-sm">
                {customFileName}
              </span>
            ) : (
              'Drop an audio file, or browse'
            )}
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            WAV, MP3, FLAC, OGG, M4A · up to 60 MB
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Demo Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              className="px-2.5 py-1.5 rounded text-xs font-mono border border-zinc-800 bg-[#111620] text-zinc-300 hover:border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Select built-in audio stem"
            >
              <Music className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">{activePreset?.name || 'Presets'}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {isPresetMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#10141d] border border-zinc-700/80 rounded-md shadow-2xl py-1.5 z-50 text-xs font-mono">
                <div className="px-3 py-1 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  Built-in Audio Presets
                </div>
                {BUILTIN_SOUND_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPreset(p.id);
                      setIsPresetMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-zinc-800/80 transition flex items-center justify-between ${
                      selectedPresetId === p.id && !customFileName
                        ? 'text-amber-400 font-medium bg-amber-500/10'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] text-zinc-500">{p.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Browse Button */}
          <button
            id="browse-audio-btn"
            onClick={handleBrowseClick}
            className="px-3.5 py-1.5 rounded text-xs font-mono border border-[#273244] bg-[#121722] text-zinc-200 hover:bg-[#1a2130] hover:border-zinc-500 transition cursor-pointer flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5 text-zinc-400" />
            <span>Browse</span>
          </button>
        </div>
      </div>

      {/* Waveform Canvas Viewport */}
      <div
        ref={waveformContainerRef}
        onClick={handleWaveformClick}
        className="w-full h-28 sm:h-32 bg-[#07090d] border border-[#171e2b] rounded flex items-center justify-center relative overflow-hidden cursor-pointer group"
      >
        {/* Horizontal Guideline Grid (matching screenshot) */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30 py-3">
          <div className="w-full border-b border-[#1e2738]" />
          <div className="w-full border-b border-[#1e2738]" />
          <div className="w-full border-b border-[#1e2738]" />
        </div>

        {/* Real Waveform Canvas */}
        <canvas
          ref={waveformCanvasRef}
          width={900}
          height={120}
          className="absolute inset-0 w-full h-full"
        />

        {/* "NO SIGNAL LOADED" overlay if empty */}
        {duration <= 0 && (
          <div className="z-10 pointer-events-none text-center">
            <span className="text-zinc-600 font-mono text-xs tracking-[0.28em] uppercase">
              NO SIGNAL LOADED
            </span>
          </div>
        )}

        {/* Hover Scrub Overlay */}
        <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Waveform Transport Footer (matching screenshot) */}
      <div className="flex items-center justify-between mt-3 text-xs font-mono">
        {/* Left: Transport Buttons */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            id="source-play-pause-btn"
            onClick={isPlaying ? onPause : onPlay}
            className="w-8 h-8 rounded border border-[#252f40] bg-[#121722] text-zinc-200 hover:bg-[#1a2232] hover:border-amber-500/60 transition flex items-center justify-center cursor-pointer active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-zinc-200 fill-zinc-200 ml-0.5" />
            )}
          </button>

          {/* Return Button */}
          <button
            id="source-return-btn"
            onClick={onReturn}
            className="px-3 py-1.5 rounded border border-[#252f40] bg-[#121722] text-zinc-300 hover:bg-[#1a2232] transition cursor-pointer text-xs flex items-center gap-1.5"
            title="Rewind to 0:00"
          >
            <RotateCcw className="w-3 h-3 text-zinc-400" />
            <span>Return</span>
          </button>

          {/* Loop Button */}
          <button
            id="source-loop-btn"
            onClick={onToggleLoop}
            className={`px-3 py-1.5 rounded border transition cursor-pointer text-xs flex items-center gap-1.5 ${
              isLooping
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 font-medium'
                : 'border-[#252f40] bg-[#121722] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle Looping"
          >
            <Repeat className="w-3 h-3" />
            <span>Loop</span>
          </button>
        </div>

        {/* Right: Timecode Display */}
        <div className="text-zinc-400 font-mono text-xs tracking-wider tabular-nums">
          <span className="text-zinc-200">{formatTime(currentTime)}</span>
          <span className="mx-1 text-zinc-600">/</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
