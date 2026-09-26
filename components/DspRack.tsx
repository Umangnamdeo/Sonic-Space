'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  CompressorParameters,
  DelayParameters,
  EqParameters,
  SaturatorParameters,
} from '@/lib/audioTypes';
import { Sliders, Zap, Disc3, Clock, Power } from 'lucide-react';

interface DspRackProps {
  eq: EqParameters;
  onEqChange: (eq: EqParameters) => void;
  compressor: CompressorParameters;
  onCompressorChange: (comp: CompressorParameters) => void;
  saturator: SaturatorParameters;
  onSaturatorChange: (sat: SaturatorParameters) => void;
  delay: DelayParameters;
  onDelayChange: (delay: DelayParameters) => void;
  gainReductionDb: number;
}

type DspTab = 'eq' | 'compressor' | 'saturator' | 'delay';

export const DspRack: React.FC<DspRackProps> = ({
  eq,
  onEqChange,
  compressor,
  onCompressorChange,
  saturator,
  onSaturatorChange,
  delay,
  onDelayChange,
  gainReductionDb,
}) => {
  const [activeTab, setActiveTab] = useState<DspTab>('eq');
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render 4-band EQ frequency response curve
  useEffect(() => {
    if (activeTab !== 'eq') return;
    const canvas = eqCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, w, h);

    // dB grid lines (-18dB to +18dB)
    ctx.strokeStyle = '#141c26';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#475569';
    ctx.font = '9px monospace';

    const dbGrid = [18, 12, 6, 0, -6, -12, -18];
    dbGrid.forEach((db) => {
      const y = ((18 - db) / 36) * (h - 20) + 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(`${db > 0 ? `+${db}` : db}dB`, 4, y - 2);
    });

    // Frequency markers
    const freqs = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 18000];
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);

    freqs.forEach((f) => {
      const x = ((Math.log10(f) - minLog) / (maxLog - minLog)) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x - 8, h - 3);
    });

    if (!eq.active) {
      // Flat line if EQ bypassed
      const y0 = ((18 - 0) / 36) * (h - 20) + 10;
      ctx.strokeStyle = '#64748b';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(w, y0);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Compute composite frequency response
    ctx.beginPath();
    const zeroY = ((18 - 0) / 36) * (h - 20) + 10;

    for (let px = 0; px < w; px += 2) {
      const logFreq = minLog + (px / w) * (maxLog - minLog);
      const f = Math.pow(10, logFreq);

      // Approximate summation of filter responses
      let totalDb = 0;

      // 1. Low Cut (Highpass)
      if (eq.lowCut.active) {
        if (f < eq.lowCut.freq) {
          const octaves = Math.log2(eq.lowCut.freq / f);
          totalDb -= octaves * 12; // 12 dB/oct
        }
      }

      // 2. Low Shelf
      if (eq.lowShelf.active) {
        const factor = 1 / (1 + Math.pow(f / eq.lowShelf.freq, 2));
        totalDb += eq.lowShelf.gain * factor;
      }

      // 3. Mid Peaking Bell
      if (eq.midBell.active) {
        const bw = eq.midBell.freq / Math.max(0.2, eq.midBell.q);
        const diff = Math.abs(f - eq.midBell.freq);
        const bellFactor = Math.exp(-Math.pow(diff / bw, 2) * 2.5);
        totalDb += eq.midBell.gain * bellFactor;
      }

      // 4. High Shelf
      if (eq.highShelf.active) {
        const factor = 1 / (1 + Math.pow(eq.highShelf.freq / f, 2));
        totalDb += eq.highShelf.gain * factor;
      }

      // Clamp between -18 and +18 for drawing
      const clampedDb = Math.max(-18, Math.min(18, totalDb));
      const py = ((18 - clampedDb) / 36) * (h - 20) + 10;

      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw control nodes
    const drawNode = (freq: number, gainDb: number, color: string, label: string) => {
      const nx = ((Math.log10(freq) - minLog) / (maxLog - minLog)) * w;
      const ny = ((18 - Math.max(-18, Math.min(18, gainDb))) / 36) * (h - 20) + 10;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(label, nx - 6, ny - 8);
    };

    if (eq.lowCut.active) drawNode(eq.lowCut.freq, 0, '#ef4444', 'HP');
    if (eq.lowShelf.active) drawNode(eq.lowShelf.freq, eq.lowShelf.gain, '#f59e0b', 'LS');
    if (eq.midBell.active) drawNode(eq.midBell.freq, eq.midBell.gain, '#06b6d4', 'MID');
    if (eq.highShelf.active) drawNode(eq.highShelf.freq, eq.highShelf.gain, '#10b981', 'HS');
  }, [eq, activeTab]);

  return (
    <div className="w-full bg-[#0d1016] border border-[#1d2634] rounded-md overflow-hidden flex flex-col font-mono select-none">
      {/* Module Selector Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#090b10] border-b border-[#1a2331] text-xs">
        <div className="flex items-center gap-1 bg-[#121722] border border-[#1f2939] rounded p-0.5">
          {/* Tab 1: Parametric EQ */}
          <button
            onClick={() => setActiveTab('eq')}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'eq'
                ? 'bg-[#1b2535] text-cyan-300 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>4-BAND EQ</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                eq.active ? 'bg-cyan-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Tab 2: Dynamics Compressor */}
          <button
            onClick={() => setActiveTab('compressor')}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'compressor'
                ? 'bg-[#1b2535] text-amber-300 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>COMPRESSOR</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                compressor.active ? 'bg-amber-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Tab 3: Harmonic Saturator */}
          <button
            onClick={() => setActiveTab('saturator')}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'saturator'
                ? 'bg-[#1b2535] text-rose-300 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5 text-rose-400" />
            <span>DRIVE / TAPE</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                saturator.active ? 'bg-rose-400' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Tab 4: Stereo Delay */}
          <button
            onClick={() => setActiveTab('delay')}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'delay'
                ? 'bg-[#1b2535] text-emerald-300 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>DELAY</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
                delay.active ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </button>
        </div>

        {/* Master Module Power Toggle */}
        <div className="flex items-center gap-2">
          {activeTab === 'eq' && (
            <button
              onClick={() => onEqChange({ ...eq, active: !eq.active })}
              className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                eq.active
                  ? 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-300'
                  : 'bg-[#121620] border border-[#232d3d] text-slate-500'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{eq.active ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          )}

          {activeTab === 'compressor' && (
            <button
              onClick={() => onCompressorChange({ ...compressor, active: !compressor.active })}
              className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                compressor.active
                  ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300'
                  : 'bg-[#121620] border border-[#232d3d] text-slate-500'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{compressor.active ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          )}

          {activeTab === 'saturator' && (
            <button
              onClick={() => onSaturatorChange({ ...saturator, active: !saturator.active })}
              className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                saturator.active
                  ? 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                  : 'bg-[#121620] border border-[#232d3d] text-slate-500'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{saturator.active ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          )}

          {activeTab === 'delay' && (
            <button
              onClick={() => onDelayChange({ ...delay, active: !delay.active })}
              className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                delay.active
                  ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                  : 'bg-[#121620] border border-[#232d3d] text-slate-500'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{delay.active ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Module Content Area */}
      <div className="p-3 bg-[#0a0d13]">
        {/* TAB 1: 4-BAND PARAMETRIC EQ */}
        {activeTab === 'eq' && (
          <div className="flex flex-col gap-3">
            <div className="relative w-full h-36 bg-[#07090d] rounded border border-[#1a2332] overflow-hidden">
              <canvas ref={eqCanvasRef} width={640} height={144} className="w-full h-full" />
            </div>

            {/* EQ Band Faders */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {/* Band 1: Highpass */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px] text-red-400 font-bold">
                  <span>LOW CUT (HP)</span>
                  <span>{eq.lowCut.freq} Hz</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="5"
                  value={eq.lowCut.freq}
                  onChange={(e) =>
                    onEqChange({
                      ...eq,
                      lowCut: { ...eq.lowCut, freq: parseInt(e.target.value) },
                    })
                  }
                  className="w-full h-1.5"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>20 Hz</span>
                  <span>400 Hz</span>
                </div>
              </div>

              {/* Band 2: Low Shelf */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px] text-amber-400 font-bold">
                  <span>LOW SHELF</span>
                  <span>
                    {eq.lowShelf.gain > 0 ? `+${eq.lowShelf.gain}` : eq.lowShelf.gain} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.lowShelf.gain}
                  onChange={(e) =>
                    onEqChange({
                      ...eq,
                      lowShelf: { ...eq.lowShelf, gain: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1.5"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>{eq.lowShelf.freq} Hz</span>
                  <span>-15dB to +15dB</span>
                </div>
              </div>

              {/* Band 3: Mid Peaking */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px] text-cyan-400 font-bold">
                  <span>MID BELL</span>
                  <span>
                    {eq.midBell.gain > 0 ? `+${eq.midBell.gain}` : eq.midBell.gain} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.midBell.gain}
                  onChange={(e) =>
                    onEqChange({
                      ...eq,
                      midBell: { ...eq.midBell, gain: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1.5"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Freq: {eq.midBell.freq} Hz</span>
                  <span>Q: {eq.midBell.q}</span>
                </div>
              </div>

              {/* Band 4: High Shelf */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1.5">
                <div className="flex justify-between text-[11px] text-emerald-400 font-bold">
                  <span>HIGH SHELF</span>
                  <span>
                    {eq.highShelf.gain > 0 ? `+${eq.highShelf.gain}` : eq.highShelf.gain} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eq.highShelf.gain}
                  onChange={(e) =>
                    onEqChange({
                      ...eq,
                      highShelf: { ...eq.highShelf, gain: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1.5"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>{eq.highShelf.freq / 1000} kHz</span>
                  <span>Air Boost</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DYNAMICS COMPRESSOR */}
        {activeTab === 'compressor' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Left/Center: Sliders */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3 text-xs">
              {/* Threshold */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">THRESHOLD</span>
                  <span className="text-amber-400 font-semibold">{compressor.threshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="0"
                  step="1"
                  value={compressor.threshold}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, threshold: parseInt(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>

              {/* Ratio */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">RATIO</span>
                  <span className="text-amber-400 font-semibold">{compressor.ratio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={compressor.ratio}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, ratio: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>

              {/* Attack */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">ATTACK</span>
                  <span className="text-slate-200 font-semibold">
                    {Math.round(compressor.attack * 1000)} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.2"
                  step="0.002"
                  value={compressor.attack}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, attack: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>

              {/* Release */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">RELEASE</span>
                  <span className="text-slate-200 font-semibold">
                    {Math.round(compressor.release * 1000)} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="1.0"
                  step="0.02"
                  value={compressor.release}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, release: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>

              {/* Knee */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">KNEE</span>
                  <span className="text-slate-200 font-semibold">{compressor.knee} dB</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={compressor.knee}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, knee: parseInt(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>

              {/* Makeup Gain */}
              <div className="bg-[#10141d] p-2 rounded border border-[#1d2636] flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">MAKEUP GAIN</span>
                  <span className="text-emerald-400 font-semibold">+{compressor.makeupGain} dB</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="18"
                  step="0.5"
                  value={compressor.makeupGain}
                  onChange={(e) =>
                    onCompressorChange({ ...compressor, makeupGain: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5"
                />
              </div>
            </div>

            {/* Right: Active Gain Reduction VU Meter */}
            <div className="bg-[#10141d] p-3 rounded border border-[#1d2636] flex flex-col justify-between items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                GAIN REDUCTION (GR)
              </span>
              <div className="w-full flex-1 max-h-32 bg-[#070a0e] rounded p-2 border border-[#192230] flex flex-col justify-end">
                <div
                  className="w-full bg-amber-500 rounded transition-all duration-75"
                  style={{ height: `${Math.min(100, (gainReductionDb / 20) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-amber-400 mt-2">
                -{gainReductionDb.toFixed(1)} dB
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: HARMONIC SATURATOR */}
        {activeTab === 'saturator' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Drive */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">SATURATION DRIVE</span>
                <span className="text-rose-400 font-semibold">
                  {Math.round(saturator.drive * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={saturator.drive}
                onChange={(e) =>
                  onSaturatorChange({ ...saturator, drive: parseFloat(e.target.value) })
                }
                className="w-full h-2 accent-rose-400"
              />
              <span className="text-[9px] text-slate-500">
                Warm analog harmonic distortion
              </span>
            </div>

            {/* Model Selector */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-1.5">
              <span className="text-slate-400 text-[11px]">ANALOG MODEL</span>
              <select
                value={saturator.type}
                onChange={(e) =>
                  onSaturatorChange({
                    ...saturator,
                    type: e.target.value as SaturatorParameters['type'],
                  })
                }
                className="w-full bg-[#141b25] border border-[#232e3e] rounded px-2 py-1 text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="tape">Vintage Tape Saturation</option>
                <option value="tube">Triode Tube Warmth</option>
                <option value="transistor">Class-A Transistor Clip</option>
              </select>
              <span className="text-[9px] text-slate-500">Polynomial non-linear curve</span>
            </div>

            {/* Tone Filter */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">TONE LOWPASS</span>
                <span className="text-slate-200 font-semibold">{saturator.tone / 1000} kHz</span>
              </div>
              <input
                type="range"
                min="2000"
                max="20000"
                step="500"
                value={saturator.tone}
                onChange={(e) =>
                  onSaturatorChange({ ...saturator, tone: parseInt(e.target.value) })
                }
                className="w-full h-1.5"
              />
              <span className="text-[9px] text-slate-500">High frequency roll-off</span>
            </div>

            {/* Dry/Wet Mix */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">DRIVE WET MIX</span>
                <span className="text-slate-200 font-semibold">
                  {Math.round(saturator.mix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={saturator.mix}
                onChange={(e) =>
                  onSaturatorChange({ ...saturator, mix: parseFloat(e.target.value) })
                }
                className="w-full h-1.5"
              />
              <span className="text-[9px] text-slate-500">Parallel drive blending</span>
            </div>
          </div>
        )}

        {/* TAB 4: STEREO DELAY */}
        {activeTab === 'delay' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Time */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">DELAY TIME</span>
                <span className="text-emerald-400 font-semibold">{delay.timeMs} ms</span>
              </div>
              <input
                type="range"
                min="20"
                max="800"
                step="10"
                value={delay.timeMs}
                onChange={(e) => onDelayChange({ ...delay, timeMs: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>1/16th</span>
                <span>1/8th Dot</span>
                <span>1/4 Beat</span>
              </div>
            </div>

            {/* Feedback */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">FEEDBACK</span>
                <span className="text-emerald-400 font-semibold">
                  {Math.round(delay.feedback * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.02"
                value={delay.feedback}
                onChange={(e) =>
                  onDelayChange({ ...delay, feedback: parseFloat(e.target.value) })
                }
                className="w-full h-1.5"
              />
              <span className="text-[9px] text-slate-500">Echo regeneration amount</span>
            </div>

            {/* Damping Filter */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">FEEDBACK DAMPING</span>
                <span className="text-slate-200 font-semibold">{delay.dampingHz} Hz</span>
              </div>
              <input
                type="range"
                min="1000"
                max="16000"
                step="250"
                value={delay.dampingHz}
                onChange={(e) =>
                  onDelayChange({ ...delay, dampingHz: parseInt(e.target.value) })
                }
                className="w-full h-1.5"
              />
              <span className="text-[9px] text-slate-500">Analog tape high frequency loss</span>
            </div>

            {/* Wet Mix */}
            <div className="bg-[#10141d] p-2.5 rounded border border-[#1d2636] flex flex-col gap-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">DELAY WET MIX</span>
                <span className="text-slate-200 font-semibold">
                  {Math.round(delay.mix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={delay.mix}
                onChange={(e) => onDelayChange({ ...delay, mix: parseFloat(e.target.value) })}
                className="w-full h-1.5"
              />
              <span className="text-[9px] text-slate-500">Parallel echo blend</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
