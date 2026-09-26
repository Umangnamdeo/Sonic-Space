'use client';

import React from 'react';
import { RotaryKnob } from './RotaryKnob';
import { RoomAcoustics, ToneParameters } from '@/lib/audioTypes';
import { Download, ToggleLeft, ToggleRight, Sparkles, Volume2 } from 'lucide-react';
import { SPACE_PRESETS } from '@/lib/spacePresets';

interface ToneDeckProps {
  tone: ToneParameters;
  onToneChange: (tone: ToneParameters) => void;
  acoustics: RoomAcoustics;
  onAcousticsChange: (acoustics: RoomAcoustics) => void;
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  isBypassed: boolean;
  onToggleBypass: () => void;
  onOpenExport: () => void;
  currentSpacePresetId: string;
  onSelectSpacePreset: (id: string) => void;
}

export const ToneDeck: React.FC<ToneDeckProps> = ({
  tone,
  onToneChange,
  acoustics,
  onAcousticsChange,
  masterVolume,
  onMasterVolumeChange,
  isBypassed,
  onToggleBypass,
  onOpenExport,
  currentSpacePresetId,
  onSelectSpacePreset,
}) => {
  return (
    <div
      id="tone-deck-card"
      className="w-full bg-[#0b0e14] border border-[#171d27] rounded-lg p-4 sm:p-5 flex flex-col justify-between"
    >
      {/* 1. TONE Section Header (matching screenshot) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase font-medium">
            TONE
          </span>
          <span className="text-[10px] font-mono text-zinc-600">ANALOG EQ & PREAMP</span>
        </div>

        {/* 5 Hardware Knobs Row (matching screenshot layout: INPUT, LOW, MID, MID FREQ, HIGH) */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2 px-1 bg-[#070a0f] border border-[#141b25] rounded-lg">
          {/* INPUT */}
          <RotaryKnob
            id="knob-input"
            label="INPUT"
            value={tone.inputGainDb}
            min={-12}
            max={12}
            step={0.5}
            defaultValue={0}
            unit="dB"
            onChange={(val) => onToneChange({ ...tone, inputGainDb: val })}
            accentColor="#f59e0b"
          />

          {/* LOW */}
          <RotaryKnob
            id="knob-low"
            label="LOW"
            value={tone.lowGainDb}
            min={-12}
            max={12}
            step={0.5}
            defaultValue={0}
            unit="dB"
            onChange={(val) => onToneChange({ ...tone, lowGainDb: val })}
            accentColor="#f59e0b"
          />

          {/* MID */}
          <RotaryKnob
            id="knob-mid"
            label="MID"
            value={tone.midGainDb}
            min={-12}
            max={12}
            step={0.5}
            defaultValue={0}
            unit="dB"
            onChange={(val) => onToneChange({ ...tone, midGainDb: val })}
            accentColor="#f59e0b"
          />

          {/* MID FREQ (matching screenshot: 900 Hz) */}
          <RotaryKnob
            id="knob-mid-freq"
            label="MID FREQ"
            value={tone.midFreqHz}
            min={200}
            max={4000}
            step={25}
            defaultValue={900}
            unit="Hz"
            displayValue={`${Math.round(tone.midFreqHz)} Hz`}
            onChange={(val) => onToneChange({ ...tone, midFreqHz: val })}
            accentColor="#f59e0b"
          />

          {/* HIGH */}
          <RotaryKnob
            id="knob-high"
            label="HIGH"
            value={tone.highGainDb}
            min={-12}
            max={12}
            step={0.5}
            defaultValue={0}
            unit="dB"
            onChange={(val) => onToneChange({ ...tone, highGainDb: val })}
            accentColor="#f59e0b"
          />
        </div>
      </div>

      {/* 2. SPACE & ACOUSTICS Section */}
      <div className="mt-4 pt-3 border-t border-[#141b25]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase font-medium">
            SPACE & REVERB
          </span>
          <div className="flex items-center gap-1.5">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onSelectSpacePreset(preset.id);
                  if (preset.acoustics) {
                    onAcousticsChange({
                      ...acoustics,
                      ...preset.acoustics,
                    });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition border cursor-pointer ${
                  currentSpacePresetId === preset.id
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 font-medium'
                    : 'border-[#18202c] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Space Rotary Knobs */}
        <div className="grid grid-cols-4 gap-2 py-2 px-1 bg-[#070a0f] border border-[#141b25] rounded-lg">
          {/* RT60 Decay */}
          <RotaryKnob
            id="knob-rt60"
            label="RT60 DECAY"
            value={acoustics.rt60}
            min={0.2}
            max={6.0}
            step={0.1}
            defaultValue={1.4}
            unit="s"
            displayValue={`${acoustics.rt60.toFixed(1)} s`}
            onChange={(val) => onAcousticsChange({ ...acoustics, rt60: val })}
            accentColor="#06b6d4"
          />

          {/* Width / Room Size */}
          <RotaryKnob
            id="knob-room-size"
            label="ROOM SIZE"
            value={acoustics.width}
            min={4}
            max={28}
            step={1}
            defaultValue={10}
            unit="m"
            displayValue={`${Math.round(acoustics.width)} m`}
            onChange={(val) =>
              onAcousticsChange({
                ...acoustics,
                width: val,
                length: Number((val * 1.3).toFixed(1)),
              })
            }
            accentColor="#06b6d4"
          />

          {/* Early Reflections */}
          <RotaryKnob
            id="knob-reflections"
            label="REFLECTIONS"
            value={acoustics.earlyReflections * 100}
            min={0}
            max={100}
            step={2}
            defaultValue={60}
            unit="%"
            displayValue={`${Math.round(acoustics.earlyReflections * 100)}%`}
            onChange={(val) => onAcousticsChange({ ...acoustics, earlyReflections: val / 100 })}
            accentColor="#06b6d4"
          />

          {/* Wet Mix */}
          <RotaryKnob
            id="knob-reverb-mix"
            label="REVERB MIX"
            value={acoustics.wetMix * 100}
            min={0}
            max={100}
            step={2}
            defaultValue={28}
            unit="%"
            displayValue={`${Math.round(acoustics.wetMix * 100)}%`}
            onChange={(val) => onAcousticsChange({ ...acoustics, wetMix: val / 100 })}
            accentColor="#06b6d4"
          />
        </div>
      </div>

      {/* 3. MASTER & EXPORT Footer Strip */}
      <div className="mt-4 pt-3 border-t border-[#141b25] flex items-center justify-between gap-3 text-xs font-mono">
        {/* Master Output Level & Bypass */}
        <div className="flex items-center gap-3">
          {/* Master Volume Slider/Fader */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] text-zinc-400">Master:</span>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.02}
              value={masterVolume}
              onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
              className="w-20 sm:w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] text-zinc-300 w-10 text-right tabular-nums">
              {masterVolume > 0 ? `${(20 * Math.log10(masterVolume)).toFixed(0)}dB` : '-inf'}
            </span>
          </div>

          {/* Spatial Bypass Button */}
          <button
            onClick={onToggleBypass}
            className={`px-2.5 py-1.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
              isBypassed
                ? 'border-amber-500/80 bg-amber-500/15 text-amber-300 font-medium'
                : 'border-[#222b3a] bg-[#111622] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle Spatial DSP Bypass (A/B testing)"
          >
            {isBypassed ? (
              <ToggleRight className="w-4 h-4 text-amber-400" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-zinc-500" />
            )}
            <span>{isBypassed ? 'Bypassed' : 'Spatial Active'}</span>
          </button>
        </div>

        {/* Master WAV Export Button */}
        <button
          id="btn-export-8d"
          onClick={onOpenExport}
          className="px-3.5 py-1.5 rounded border border-amber-500/40 bg-gradient-to-r from-amber-600/20 to-amber-500/20 text-amber-300 hover:border-amber-500 hover:from-amber-600/30 hover:to-amber-500/30 transition text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 8D/16D WAV</span>
        </button>
      </div>
    </div>
  );
};
