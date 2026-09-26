'use client';

import React, { useRef, useState } from 'react';
import { Play, Pause, Square, Repeat, Mic, Upload, Volume2, Sparkles } from 'lucide-react';
import { BUILTIN_SOUND_PRESETS } from '@/lib/proceduralAudio';
import { AudioSourceType } from '@/lib/audioTypes';

interface TransportBarProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  sourceType: AudioSourceType;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onOpenUpload: () => void;
  isMicActive: boolean;
  onToggleMic: () => void;
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  customFileName?: string | null;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  isLooping,
  onToggleLoop,
  currentTime,
  duration,
  onSeek,
  sourceType,
  selectedPresetId,
  onSelectPreset,
  onOpenUpload,
  isMicActive,
  onToggleMic,
  masterVolume,
  onMasterVolumeChange,
  customFileName,
}) => {
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Format time as MM:SS.mmm
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const volumeDb = masterVolume > 0.0001 ? (20 * Math.log10(masterVolume)).toFixed(1) : '-â';

  return (
    <div className="w-full bg-[#0d1016] border-b border-[#1c2431] px-4 py-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-slate-200">
      {/* Primary Transport Controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`w-10 h-10 rounded flex items-center justify-center transition-all cursor-pointer ${
            isPlaying
              ? 'bg-amber-500/20 border border-amber-500 text-amber-300 hover:bg-amber-500/30'
              : 'bg-cyan-500/20 border border-cyan-500 text-cyan-300 hover:bg-cyan-500/30'
          }`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="w-9 h-9 rounded bg-[#151a24] border border-[#242e3f] hover:border-slate-500 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Stop & Reset Timeline"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onToggleLoop}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors cursor-pointer ${
            isLooping
              ? 'bg-cyan-950/60 border border-cyan-500/60 text-cyan-400'
              : 'bg-[#151a24] border border-[#242e3f] text-slate-400 hover:text-slate-200'
          }`}
          title={isLooping ? 'Looping Active' : 'Enable Loop'}
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>

        {/* Timecode Digital Readout */}
        <div className="px-3 py-1.5 rounded bg-[#090b0f] border border-[#1b222e] font-mono text-xs flex items-center gap-1.5 text-cyan-400">
          <span className="font-semibold text-slate-100">{formatTime(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{isMicActive ? 'LIVE MIC' : formatTime(duration)}</span>
        </div>
      </div>

      {/* Scrubber / Progress Timeline */}
      <div className="flex-1 min-w-[180px] max-w-xl flex flex-col justify-center gap-1">
        <div
          ref={scrubberRef}
          onClick={handleScrubberClick}
          className="relative w-full h-4 bg-[#080a0e] border border-[#1c2431] rounded cursor-pointer overflow-hidden group"
          title="Click to scrub playback position"
        >
          {/* Subtle audio grid lines */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20 px-1">
            <span className="w-px h-full bg-slate-400" />
            <span className="w-px h-full bg-slate-400" />
            <span className="w-px h-full bg-slate-400" />
            <span className="w-px h-full bg-slate-400" />
          </div>

          {/* Progress fill */}
          <div
            className="h-full bg-cyan-500/40 border-r-2 border-cyan-400 transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>00:00.000</span>
          <span>{isMicActive ? 'STREAMING' : `${Math.round(progressPercent)}%`}</span>
          <span>{isMicActive ? 'â' : formatTime(duration)}</span>
        </div>
      </div>

      {/* Audio Source Switcher (Presets / Upload / Mic) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source preset dropdown */}
        <div className="flex items-center bg-[#131822] border border-[#222c3c] rounded px-2 py-1">
          <span className="text-[11px] font-mono text-slate-400 mr-1.5 hidden lg:inline">AUDIO:</span>
          <select
            value={sourceType === 'preset' ? selectedPresetId : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                onOpenUpload();
              } else {
                onSelectPreset(e.target.value);
              }
            }}
            disabled={isMicActive}
            className="bg-transparent text-xs text-cyan-300 focus:outline-none cursor-pointer font-medium disabled:opacity-50"
          >
            <optgroup label="Studio Presets (Web Audio)" className="bg-[#131822] text-slate-200">
              {BUILTIN_SOUND_PRESETS.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.category})
                </option>
              ))}
            </optgroup>
            {customFileName && (
              <optgroup label="Loaded Audio File" className="bg-[#131822] text-slate-200">
                <option value="custom">File: {customFileName}</option>
              </optgroup>
            )}
          </select>
        </div>

        {/* Upload Audio File Button */}
        <button
          onClick={onOpenUpload}
          disabled={isMicActive}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
            sourceType === 'upload'
              ? 'bg-cyan-950/70 border border-cyan-500/60 text-cyan-300'
              : 'bg-[#151b24] border border-[#232c3c] text-slate-300 hover:border-slate-400'
          } disabled:opacity-40`}
          title="Upload audio file (WAV, MP3, FLAC, OGG, max 50MB)"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">LOAD FILE</span>
        </button>

        {/* Live Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${
            isMicActive
              ? 'bg-rose-500/20 border border-rose-500/80 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse'
              : 'bg-[#151b24] border border-[#232c3c] text-slate-300 hover:border-slate-400'
          }`}
          title="Toggle live microphone capture (requires user browser permission)"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{isMicActive ? 'MIC ON' : 'MIC'}</span>
        </button>

        {/* Master Output Volume Fader */}
        <div className="flex items-center gap-2 bg-[#121620] border border-[#202837] rounded px-2.5 py-1">
          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1.5 cursor-pointer accent-cyan-400"
            title={`Master Gain: ${volumeDb} dB`}
          />
          <span className="text-[10px] font-mono text-slate-400 w-11 text-right">
            {volumeDb}dB
          </span>
        </div>
      </div>
    </div>
  );
};
