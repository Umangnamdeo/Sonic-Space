'use client';

import React from 'react';
import { SpacePreset } from '@/lib/audioTypes';
import { SPACE_PRESETS } from '@/lib/spacePresets';
import { Volume2, VolumeX, Download, Radio, ShieldCheck, Sliders } from 'lucide-react';

interface HeaderProps {
  currentPresetId: string;
  onSelectPreset: (preset: SpacePreset) => void;
  isBypassed: boolean;
  onToggleBypass: () => void;
  onOpenExport: () => void;
  sampleRate: number;
  isPlaying: boolean;
  activeSourceLabel: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentPresetId,
  onSelectPreset,
  isBypassed,
  onToggleBypass,
  onOpenExport,
  sampleRate,
  isPlaying,
  activeSourceLabel,
}) => {
  return (
    <header className="w-full bg-[#0b0e14] border-b border-[#1f2733] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Brand Identity & Tagline */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#161c26] border border-[#2b3545] flex items-center justify-center text-cyan-400 font-mono font-bold text-base shadow-inner">
            SS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm text-slate-100 uppercase font-mono">
                SonicSpace
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161d28] border border-[#263345] text-cyan-400 font-mono">
                PRO-DSP v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wide">
              Shape Sound. Feel Space.
            </p>
          </div>
        </div>

        {/* Engine Hardware Telemetry Badges */}
        <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-[#1d2532] text-[11px] font-mono">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f131a] border border-[#1e2736] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>{isPlaying ? 'ACTIVE' : 'READY'}</span>
          </div>

          <div className="px-2 py-1 rounded bg-[#0f131a] border border-[#1e2736] text-slate-400">
            RATE: <span className="text-slate-200">{sampleRate ? `${sampleRate / 1000} kHz` : '48 kHz'}</span>
          </div>

          <div className="px-2 py-1 rounded bg-[#0f131a] border border-[#1e2736] text-slate-400">
            SRC: <span className="text-cyan-400 truncate max-w-[110px] inline-block align-bottom">{activeSourceLabel}</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#0f131a] border border-[#1e2736] text-emerald-400/90" title="Processing 100% Client-Side Web Audio. Zero external data transmission.">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[10px] tracking-tight">LOCAL ENCLAVE</span>
          </div>
        </div>
      </div>

      {/* Center / Right Control Cluster: Preset selector, Bypass, and Export */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Preset Selector */}
        <div className="flex items-center gap-1.5 bg-[#121720] border border-[#202937] rounded px-2 py-1">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">SPACE:</span>
          <select
            value={currentPresetId}
            onChange={(e) => {
              const p = SPACE_PRESETS.find((sp) => sp.id === e.target.value);
              if (p) onSelectPreset(p);
            }}
            className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer font-medium"
          >
            {SPACE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-[#121720] text-slate-200">
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {/* A/B Bypass Button */}
        <button
          onClick={onToggleBypass}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
            isBypassed
              ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
              : 'bg-[#151a23] border border-[#232c3b] text-slate-300 hover:border-slate-500'
          }`}
          title="Toggle A/B Master Bypass (compare processed space vs raw input)"
        >
          {isBypassed ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              <span>BYPASS ON (RAW)</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>DSP ACTIVE</span>
            </>
          )}
        </button>

        {/* Master Offline Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 transition-colors shadow-sm cursor-pointer"
          title="Render high-fidelity offline PCM WAV audio"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">EXPORT WAV</span>
          <span className="sm:hidden">EXPORT</span>
        </button>
      </div>
    </header>
  );
};
