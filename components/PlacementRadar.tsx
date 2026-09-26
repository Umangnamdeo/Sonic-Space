'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SpatialCoordinates, SpatialMotionConfig, SpatialMotionPattern } from '@/lib/audioTypes';
import { MOTION_PRESETS } from '@/lib/spatialMotion';
import { Play, Pause, Compass, Sliders, Activity, Sparkles } from 'lucide-react';

interface PlacementRadarProps {
  coords: SpatialCoordinates;
  onCoordsChange: (coords: SpatialCoordinates) => void;
  motionConfig: SpatialMotionConfig;
  onMotionConfigChange: (config: SpatialMotionConfig) => void;
  isPlaying: boolean;
}

export const PlacementRadar: React.FC<PlacementRadarProps> = ({
  coords,
  onCoordsChange,
  motionConfig,
  onMotionConfigChange,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Compute polar coordinates from Cartesian (X, Y)
  const distance = Math.hypot(coords.x, coords.y).toFixed(2);
  // Azimuth in degrees: 0° is FRONT (+Y), 90° is RIGHT (+X), -90° is LEFT (-X), 180° is BACK (-Y)
  const rawAzimuth = (Math.atan2(coords.x, coords.y) * 180) / Math.PI;
  const azimuthDeg = Math.round(rawAzimuth >= 0 ? rawAzimuth : 360 + rawAzimuth);

  // Handle manual mouse/touch drag to reposition sound source
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    // If dragging manually, switch pattern to manual
    if (motionConfig.active && motionConfig.pattern !== 'manual') {
      onMotionConfigChange({ ...motionConfig, pattern: 'manual', active: false });
    }
    updateSourceFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateSourceFromPointer(e);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const updateSourceFromPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radiusPx = Math.min(centerX, centerY) * 0.85;

      // Max radius = 4.0 meters
      const maxMeters = 4.0;
      const scale = radiusPx / maxMeters;

      const rawX = (clientX - centerX) / scale;
      const rawY = (centerY - clientY) / scale; // +Y is FRONT

      const dist = Math.hypot(rawX, rawY);
      const clampedDist = Math.min(maxMeters, dist);
      const angle = Math.atan2(rawX, rawY);

      const x = parseFloat((clampedDist * Math.sin(angle)).toFixed(2));
      const y = parseFloat((clampedDist * Math.cos(angle)).toFixed(2));

      onCoordsChange({ ...coords, x, y });
    },
    [coords, onCoordsChange]
  );

  // Canvas radar animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let pulsePhase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const maxMeters = 4.0;
      const radarRadius = Math.min(centerX, centerY) * 0.84;
      const scale = radarRadius / maxMeters;

      // 1. Radar Background Circle & Range Rings
      const rings = [1.0, 2.0, 3.0, 4.0];
      rings.forEach((r) => {
        const ringPx = r * scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringPx, 0, Math.PI * 2);
        ctx.strokeStyle = r === 4.0 ? '#1b2330' : '#141a24';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Distance label
        ctx.fillStyle = '#334155';
        ctx.font = '9px monospace';
        ctx.fillText(`${r}m`, centerX + 4, centerY - ringPx + 10);
      });

      // 2. Axis Crosshairs & Degree Rays
      ctx.strokeStyle = '#161d28';
      ctx.lineWidth = 1;

      // Vertical (Front/Back)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radarRadius);
      ctx.lineTo(centerX, centerY + radarRadius);
      ctx.stroke();

      // Horizontal (Left/Right)
      ctx.beginPath();
      ctx.moveTo(centerX - radarRadius, centerY);
      ctx.lineTo(centerX + radarRadius, centerY);
      ctx.stroke();

      // 45-degree diagonals
      const diag = radarRadius * Math.SQRT1_2;
      ctx.beginPath();
      ctx.moveTo(centerX - diag, centerY - diag);
      ctx.lineTo(centerX + diag, centerY + diag);
      ctx.moveTo(centerX - diag, centerY + diag);
      ctx.lineTo(centerX + diag, centerY - diag);
      ctx.strokeStyle = '#10141d';
      ctx.stroke();

      // 3. Cardinal Direction Labels (matching screenshot)
      ctx.font = '10px monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // FRONT
      ctx.fillText('FRONT', centerX, centerY - radarRadius - 12);
      // L (Left)
      ctx.fillText('L', centerX - radarRadius - 12, centerY);
      // R (Right)
      ctx.fillText('R', centerX + radarRadius + 12, centerY);
      // BACK
      ctx.fillText('BACK', centerX, centerY + radarRadius + 12);

      // 4. Center Listener Icon (oriented to FRONT)
      ctx.save();
      ctx.translate(centerX, centerY);

      // Outer listener head halo
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#0f141e';
      ctx.strokeStyle = '#273346';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Ears (Left and Right)
      ctx.fillStyle = '#475569';
      ctx.fillRect(-13, -3, 2.5, 6);
      ctx.fillRect(10.5, -3, 2.5, 6);

      // Forward orientation triangle / nose (pointing UP to FRONT, matching screenshot)
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();

      ctx.restore();

      // 5. Sound Source Position (Cartesian mapping: +Y is UP, +X is RIGHT)
      const sourcePxX = centerX + coords.x * scale;
      const sourcePxY = centerY - coords.y * scale;

      // Connecting ray from listener to source
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sourcePxX, sourcePxY);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pulsing acoustic wavefront ripples if audio is playing or motion active
      if (isPlaying || motionConfig.active) {
        pulsePhase = (pulsePhase + 0.04) % (Math.PI * 2);
        for (let i = 0; i < 3; i++) {
          const rPulse = 10 + ((pulsePhase * 7 + i * 12) % 36);
          const alpha = Math.max(0, 1 - rPulse / 36) * 0.45;
          ctx.beginPath();
          ctx.arc(sourcePxX, sourcePxY, rPulse, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Outer glow of amber node
      const glow = ctx.createRadialGradient(sourcePxX, sourcePxY, 2, sourcePxX, sourcePxY, 16);
      glow.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
      glow.addColorStop(0.5, 'rgba(217, 119, 6, 0.3)');
      glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sourcePxX, sourcePxY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Amber Source Core Node (matching screenshot amber dot)
      ctx.beginPath();
      ctx.arc(sourcePxX, sourcePxY, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [coords, isPlaying, motionConfig.active]);

  const handleSelectPattern = (pattern: SpatialMotionPattern) => {
    const preset = MOTION_PRESETS.find((p) => p.id === pattern);
    if (preset) {
      onMotionConfigChange({ ...preset.defaultConfig });
    }
  };

  const activePreset = MOTION_PRESETS.find((p) => p.id === motionConfig.pattern);

  return (
    <div
      id="placement-radar-card"
      className="w-full bg-[#0b0e14] border border-[#171d27] rounded-lg p-4 sm:p-5 flex flex-col justify-between"
    >
      {/* Header (matching screenshot format: PLACEMENT on left, 0° · 1.40 m on right) */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase font-medium">
          PLACEMENT
        </span>
        <div className="text-zinc-400 font-mono text-xs tracking-wider flex items-center gap-2 tabular-nums">
          <span className="text-amber-400 font-medium">{azimuthDeg}°</span>
          <span className="text-zinc-600">·</span>
          <span>{distance} m</span>
          <span className="text-zinc-600">·</span>
          <span
            className={`${
              coords.z > 0.3
                ? 'text-cyan-400'
                : coords.z < -0.3
                ? 'text-indigo-400'
                : 'text-zinc-400'
            }`}
            title="Vertical Elevation (Up / Down)"
          >
            Z {coords.z >= 0 ? '+' : ''}
            {coords.z.toFixed(1)}m
          </span>
        </div>
      </div>

      {/* Radar Soundstage & Elevation Meter */}
      <div className="relative flex items-center justify-center my-1">
        {/* Polar Canvas */}
        <canvas
          ref={canvasRef}
          width={380}
          height={320}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="cursor-crosshair touch-none select-none max-w-full h-auto"
        />

        {/* Vertical Elevation (Up / Down) Meter on Right Edge */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-[10px] font-mono text-zinc-500">
          <span className="text-[9px] text-cyan-400 font-medium">UP</span>
          <div className="w-2.5 h-36 bg-[#07090d] border border-[#1b2332] rounded-full relative overflow-hidden flex items-center justify-center">
            {/* Center Eye Level marker */}
            <div className="absolute top-1/2 w-full h-[1px] bg-zinc-600" />
            {/* Real-time Indicator pill */}
            <div
              style={{
                // coords.z goes from -2.5m (bottom) to +2.5m (top)
                bottom: `${Math.max(4, Math.min(96, ((coords.z + 2.5) / 5.0) * 100))}%`,
              }}
              className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)] -translate-x-1/2 left-1/2 transition-all duration-75"
            />
          </div>
          <span className="text-[9px] text-indigo-400 font-medium">DOWN</span>
        </div>
      </div>

      {/* Spatial Motion & 8D / 16D / Singer Presets Bar */}
      <div className="mt-2 pt-3 border-t border-[#151c27]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">3D Spatial Motion Presets</span>
          </div>

          <button
            onClick={() => setShowControls(!showControls)}
            className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition"
          >
            <Sliders className="w-3 h-3" />
            <span>{showControls ? 'Hide Motion Controls' : 'Fine-Tune Motion'}</span>
          </button>
        </div>

        {/* Preset Selection Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
          {/* Singer Stage Walk (User Explicit Request) */}
          <button
            id="preset-singer-walk"
            onClick={() => handleSelectPattern('singer-motion')}
            className={`px-2.5 py-2 rounded text-left transition border cursor-pointer ${
              motionConfig.pattern === 'singer-motion' && motionConfig.active
                ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-medium'
                : 'border-[#1b2332] bg-[#0e121a] text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">🎤 Singer Walk</span>
              <span className="text-[9px] text-amber-400/90 font-mono">3D</span>
            </div>
            <span className="text-[10px] text-zinc-500 block truncate">
              Front/Back/Left/Right/Up/Down
            </span>
          </button>

          {/* 8D Audio Orbit (User Explicit Request) */}
          <button
            id="preset-8d-orbit"
            onClick={() => handleSelectPattern('8d-orbit')}
            className={`px-2.5 py-2 rounded text-left transition border cursor-pointer ${
              motionConfig.pattern === '8d-orbit' && motionConfig.active
                ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-medium'
                : 'border-[#1b2332] bg-[#0e121a] text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">🌀 8D Audio</span>
              <span className="text-[9px] text-cyan-400 font-mono">360°</span>
            </div>
            <span className="text-[10px] text-zinc-500 block truncate">
              Binaural Head Orbit
            </span>
          </button>

          {/* 16D Infinity Field (User Explicit Request) */}
          <button
            id="preset-16d-infinity"
            onClick={() => handleSelectPattern('16d-infinity')}
            className={`px-2.5 py-2 rounded text-left transition border cursor-pointer ${
              motionConfig.pattern === '16d-infinity' && motionConfig.active
                ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-medium'
                : 'border-[#1b2332] bg-[#0e121a] text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">♾️ 16D Field</span>
              <span className="text-[9px] text-purple-400 font-mono">∞ DUAL</span>
            </div>
            <span className="text-[10px] text-zinc-500 block truncate">
              Figure-8 Over Head
            </span>
          </button>

          {/* Manual Placement */}
          <button
            id="preset-manual"
            onClick={() => handleSelectPattern('manual')}
            className={`px-2.5 py-2 rounded text-left transition border cursor-pointer ${
              motionConfig.pattern === 'manual' || !motionConfig.active
                ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-medium'
                : 'border-[#1b2332] bg-[#0e121a] text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">🖐️ Manual</span>
              <span className="text-[9px] text-zinc-500 font-mono">DRAG</span>
            </div>
            <span className="text-[10px] text-zinc-500 block truncate">
              Fixed Position
            </span>
          </button>
        </div>

        {/* Additional Motion Patterns Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 font-mono text-[11px]">
          <span className="text-zinc-500 text-[10px] uppercase mr-1">More:</span>
          <button
            onClick={() => handleSelectPattern('8d-fast')}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              motionConfig.pattern === '8d-fast' && motionConfig.active
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-[#18202c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            8D Fast Club
          </button>

          <button
            onClick={() => handleSelectPattern('16d-spiral')}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              motionConfig.pattern === '16d-spiral' && motionConfig.active
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-[#18202c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            16D Cosmic Helix
          </button>

          <button
            onClick={() => handleSelectPattern('front-back')}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              motionConfig.pattern === 'front-back' && motionConfig.active
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-[#18202c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Front ↔ Back Sweep
          </button>

          <button
            onClick={() => handleSelectPattern('left-right')}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              motionConfig.pattern === 'left-right' && motionConfig.active
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-[#18202c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Left ↔ Right Arc
          </button>
        </div>

        {/* Collapsible Motion Fine-Tuning Controls */}
        {showControls && (
          <div className="mt-3 p-3 bg-[#080b10] border border-[#171e2a] rounded space-y-2.5 text-xs font-mono">
            {/* Speed Slider */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 text-[11px] w-28">Speed / Cycle</span>
              <input
                type="range"
                min={0.02}
                max={0.35}
                step={0.01}
                value={motionConfig.speedHz}
                onChange={(e) =>
                  onMotionConfigChange({
                    ...motionConfig,
                    speedHz: parseFloat(e.target.value),
                  })
                }
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <span className="text-zinc-300 text-[11px] w-20 text-right tabular-nums">
                {(1 / motionConfig.speedHz).toFixed(1)}s / loop
              </span>
            </div>

            {/* Orbit Radius Slider */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 text-[11px] w-28">Stage Width</span>
              <input
                type="range"
                min={0.8}
                max={3.8}
                step={0.1}
                value={motionConfig.radius}
                onChange={(e) =>
                  onMotionConfigChange({
                    ...motionConfig,
                    radius: parseFloat(e.target.value),
                  })
                }
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <span className="text-zinc-300 text-[11px] w-20 text-right tabular-nums">
                {motionConfig.radius.toFixed(1)} m
              </span>
            </div>

            {/* Up/Down Elevation Range Slider */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 text-[11px] w-28">Up/Down Swing</span>
              <input
                type="range"
                min={0}
                max={3.0}
                step={0.1}
                value={motionConfig.elevationRange}
                onChange={(e) =>
                  onMotionConfigChange({
                    ...motionConfig,
                    elevationRange: parseFloat(e.target.value),
                  })
                }
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <span className="text-zinc-300 text-[11px] w-20 text-right tabular-nums">
                ±{motionConfig.elevationRange.toFixed(1)} m
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
