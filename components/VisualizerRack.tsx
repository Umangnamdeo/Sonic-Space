'use client';

import React, { useRef, useEffect, useState } from 'react';
import { getSonicSpaceEngine } from '@/lib/audioEngine';
import { Activity, Radio, BarChart3, Disc } from 'lucide-react';

type VisualizerMode = 'spectrum' | 'vectorscope' | 'oscilloscope' | 'meters';

// 1. RTA Spectrum Analyzer (Logarithmic Frequency Axis 20Hz - 20kHz)
function renderSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqL: Uint8Array,
  freqR: Uint8Array
) {
  // dB horizontal grid lines (-90dB to 0dB)
  ctx.strokeStyle = '#141c26';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#475569';
  ctx.font = '9px monospace';

  const dbSteps = [0, -12, -24, -36, -48, -60, -72, -84];
  dbSteps.forEach((db) => {
    const y = (Math.abs(db) / 90) * (h - 24) + 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(`${db}dB`, 4, y - 2);
  });

  // Frequency vertical grid lines
  const freqMarkers = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 18000];
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);

  freqMarkers.forEach((f) => {
    const x = ((Math.log10(f) - minLog) / (maxLog - minLog)) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h - 16);
    ctx.stroke();
    const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
    ctx.fillText(label, x - 8, h - 4);
  });

  // Draw Frequency Response Curve (Stereo average / gradient fill)
  ctx.beginPath();
  ctx.moveTo(0, h - 18);

  const binCount = freqL.length;
  for (let px = 0; px < w; px += 2) {
    const logFreq = minLog + (px / w) * (maxLog - minLog);
    const freq = Math.pow(10, logFreq);
    const binIdx = Math.min(binCount - 1, Math.floor((freq / 24000) * binCount));

    const mag = (freqL[binIdx] + freqR[binIdx]) / 2;
    const normMag = mag / 255;
    const y = h - 18 - normMag * (h - 32);

    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }

  ctx.lineTo(w, h - 18);
  ctx.closePath();

  // Fill area under curve
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
  gradient.addColorStop(0.6, 'rgba(6, 182, 212, 0.15)');
  gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Top stroke
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// 2. Stereo Vectorscope (Goniometer Lissajous Phase Plot)
function renderVectorscope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeL: Float32Array,
  timeR: Float32Array
) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) * 0.85;

  // Crosshairs (M/S Axes rotated 45 degrees)
  ctx.strokeStyle = '#182230';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Polar circles
  ctx.strokeStyle = '#121822';
  ctx.setLineDash([2, 4]);
  [0.33, 0.66, 1.0].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Axis Labels
  ctx.fillStyle = '#475569';
  ctx.font = '10px monospace';
  ctx.fillText('L', cx - radius + 5, cy - 5);
  ctx.fillText('R', cx + radius - 15, cy - 5);
  ctx.fillText('+M (MONO)', cx - 25, cy - radius + 12);
  ctx.fillText('-S (SIDE)', cx - 22, cy + radius - 5);

  // Plot Lissajous X = (L - R) / sqrt(2), Y = (L + R) / sqrt(2)
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();

  const invSqrt2 = 0.7071;
  const len = Math.min(timeL.length, 512);

  for (let i = 0; i < len; i++) {
    const l = timeL[i];
    const r = timeR[i];
    const x = cx + (l - r) * invSqrt2 * radius * 1.5;
    const y = cy - (l + r) * invSqrt2 * radius * 1.5;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// 3. Time-Domain Oscilloscope
function renderOscilloscope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeL: Float32Array,
  timeR: Float32Array
) {
  const cy = h / 2;

  // Center baseline
  ctx.strokeStyle = '#182230';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  // Left Channel (Cyan)
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const len = timeL.length;
  const step = w / len;

  for (let i = 0; i < len; i++) {
    const x = i * step;
    const y = cy - timeL[i] * (h * 0.42);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Right Channel (Amber - slightly transparent)
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < len; i++) {
    const x = i * step;
    const y = cy - timeR[i] * (h * 0.42);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Legend
  ctx.font = '10px monospace';
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('CH 1 (LEFT)', 10, 18);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('CH 2 (RIGHT)', 90, 18);
}

// 4. Precision Broadcast VU & Peak Meters (on Canvas)
function renderPrecisionMeters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  metrics: { peakL: number; peakR: number; rmsL: number; rmsR: number },
  holdL: number,
  holdR: number
) {
  const meterW = 34;
  const meterH = h - 45;
  const startY = 25;

  const leftX = w / 2 - meterW - 16;
  const rightX = w / 2 + 16;

  // Channel labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', leftX + meterW / 2, 16);
  ctx.fillText('RIGHT', rightX + meterW / 2, 16);

  // Draw meter backgrounds
  ctx.fillStyle = '#0d131a';
  ctx.fillRect(leftX, startY, meterW, meterH);
  ctx.fillRect(rightX, startY, meterW, meterH);

  // Scale dB lines
  const marks = [0, -3, -6, -12, -18, -24, -36, -48];
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';

  marks.forEach((db) => {
    const normY = Math.pow(10, db / 20);
    const y = startY + meterH * (1 - normY);
    ctx.strokeStyle = '#232d3d';
    ctx.beginPath();
    ctx.moveTo(leftX - 4, y);
    ctx.lineTo(rightX + meterW + 4, y);
    ctx.stroke();

    ctx.fillStyle = db === 0 ? '#ef4444' : '#64748b';
    ctx.fillText(`${db}`, w / 2, y + 3);
  });

  // Fill Left meter
  const fillL = Math.min(1.0, metrics.peakL) * meterH;
  const gradL = ctx.createLinearGradient(0, startY + meterH, 0, startY);
  gradL.addColorStop(0, '#059669');
  gradL.addColorStop(0.7, '#10b981');
  gradL.addColorStop(0.9, '#f59e0b');
  gradL.addColorStop(1.0, '#ef4444');

  ctx.fillStyle = gradL;
  ctx.fillRect(leftX + 2, startY + meterH - fillL, meterW - 4, fillL);

  // Fill Right meter
  const fillR = Math.min(1.0, metrics.peakR) * meterH;
  ctx.fillStyle = gradL;
  ctx.fillRect(rightX + 2, startY + meterH - fillR, meterW - 4, fillR);

  // Peak hold needles
  ctx.fillStyle = '#f8fafc';
  if (holdL > 0.01) {
    const holdYL = startY + meterH * (1 - Math.min(1.0, holdL));
    ctx.fillRect(leftX + 2, holdYL, meterW - 4, 2);
  }
  if (holdR > 0.01) {
    const holdYR = startY + meterH * (1 - Math.min(1.0, holdR));
    ctx.fillRect(rightX + 2, holdYR, meterW - 4, 2);
  }
}

export const VisualizerRack: React.FC = () => {
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ freq: number; db: number } | null>(null);

  const [meterState, setMeterState] = useState({
    peakL: 0,
    peakR: 0,
    rmsL: 0,
    rmsR: 0,
    peakHoldL: 0,
    peakHoldR: 0,
    clipL: false,
    clipR: false,
    correlation: 1.0,
    grDb: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let localPeakHoldL = 0;
    let localPeakHoldR = 0;
    let clipCounterL = 0;
    let clipCounterR = 0;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      const engine = getSonicSpaceEngine();
      const metrics = engine.getAudioMetrics();
      const { timeDataL, timeDataR, freqDataL, freqDataR } = engine.getVisualizerData();

      // Update peak holds with gentle decay
      if (metrics.peakL > localPeakHoldL) {
        localPeakHoldL = metrics.peakL;
      } else {
        localPeakHoldL = Math.max(0, localPeakHoldL - 0.005);
      }

      if (metrics.peakR > localPeakHoldR) {
        localPeakHoldR = metrics.peakR;
      } else {
        localPeakHoldR = Math.max(0, localPeakHoldR - 0.005);
      }

      // Clip checks (> 0.99)
      if (metrics.peakL >= 0.99) clipCounterL = 30;
      else if (clipCounterL > 0) clipCounterL--;

      if (metrics.peakR >= 0.99) clipCounterR = 30;
      else if (clipCounterR > 0) clipCounterR--;

      // Throttle React DOM meter state update to every 4 frames (~15fps) to maintain optimal performance
      if (frameCount % 4 === 0) {
        setMeterState({
          peakL: metrics.peakL,
          peakR: metrics.peakR,
          rmsL: metrics.rmsL,
          rmsR: metrics.rmsR,
          peakHoldL: localPeakHoldL,
          peakHoldR: localPeakHoldR,
          clipL: clipCounterL > 0,
          clipR: clipCounterR > 0,
          correlation: metrics.phaseCorrelation,
          grDb: metrics.gainReductionDb,
        });
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid & bezel
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, 0, w, h);

      if (mode === 'spectrum') {
        renderSpectrum(ctx, w, h, freqDataL, freqDataR);
      } else if (mode === 'vectorscope') {
        renderVectorscope(ctx, w, h, timeDataL, timeDataR);
      } else if (mode === 'oscilloscope') {
        renderOscilloscope(ctx, w, h, timeDataL, timeDataR);
      } else if (mode === 'meters') {
        renderPrecisionMeters(ctx, w, h, metrics, localPeakHoldL, localPeakHoldR);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [mode]);

  // Canvas mousemove for RTA inspection tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'spectrum') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const logFreq = minLog + (x / rect.width) * (maxLog - minLog);
    const freq = Math.round(Math.pow(10, logFreq));
    const db = Math.round(-(y / (rect.height - 24)) * 90);

    setHoverInfo({ freq, db });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  return (
    <div className="w-full bg-[#0d1016] border border-[#1d2634] rounded-md overflow-hidden flex flex-col font-mono select-none">
      {/* Visualizer Rack Top Header & Mode Selectors */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#090b10] border-b border-[#1b2330] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-200 font-bold uppercase text-[11px] tracking-wider">
            SIGNAL ANALYTICS
          </span>
          {hoverInfo && mode === 'spectrum' && (
            <span className="text-[11px] text-cyan-400 bg-[#121822] px-2 py-0.5 rounded border border-[#1f293a]">
              {hoverInfo.freq} Hz // {hoverInfo.db} dBFS
            </span>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#121620] border border-[#1f2838] rounded p-0.5">
          <button
            onClick={() => setMode('spectrum')}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              mode === 'spectrum'
                ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>RTA SPECTRUM</span>
          </button>

          <button
            onClick={() => setMode('vectorscope')}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              mode === 'vectorscope'
                ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Disc className="w-3 h-3" />
            <span>VECTORSCOPE</span>
          </button>

          <button
            onClick={() => setMode('oscilloscope')}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              mode === 'oscilloscope'
                ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>OSCILLOSCOPE</span>
          </button>

          <button
            onClick={() => setMode('meters')}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              mode === 'meters'
                ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>VU METERS</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Screen */}
      <div className="relative w-full h-56 bg-[#07090d]">
        <canvas
          ref={canvasRef}
          width={640}
          height={224}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair"
        />

        {/* Phase Correlation & Real-Time Telemetry Bar at bottom */}
        <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between pointer-events-none text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 bg-[#090c12]/90 px-2 py-0.5 rounded border border-[#192230]">
            <span>PHASE CORR:</span>
            <div className="w-16 h-1.5 bg-[#141b24] rounded-full overflow-hidden flex items-center relative">
              <div className="w-px h-full bg-slate-500 absolute left-1/2" />
              <div
                className={`h-full transition-all duration-75 ${
                  meterState.correlation < 0 ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{
                  width: `${Math.abs(meterState.correlation) * 50}%`,
                  marginLeft: meterState.correlation >= 0 ? '50%' : `${50 - Math.abs(meterState.correlation) * 50}%`,
                }}
              />
            </div>
            <span
              className={`font-semibold ${
                meterState.correlation < 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {meterState.correlation.toFixed(2)}
            </span>
          </div>

          {meterState.grDb > 0.1 && (
            <div className="bg-[#090c12]/90 px-2 py-0.5 rounded border border-[#192230] text-amber-400 flex items-center gap-1">
              <span>COMP GR:</span>
              <span className="font-bold">-{meterState.grDb.toFixed(1)} dB</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#090c12]/90 px-2 py-0.5 rounded border border-[#192230]">
            <span className={meterState.clipL || meterState.clipR ? 'text-rose-400 font-bold' : 'text-slate-500'}>
              CLIP 0dBFS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
