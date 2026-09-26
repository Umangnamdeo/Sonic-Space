'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RoomAcoustics, SpatialCoordinates } from '@/lib/audioTypes';
import { Maximize2, Move, Box, Layers, RefreshCw } from 'lucide-react';

interface SpatialChamberProps {
  acoustics: RoomAcoustics;
  onAcousticsChange: (acoustics: RoomAcoustics) => void;
  coords: SpatialCoordinates;
  onCoordsChange: (coords: SpatialCoordinates) => void;
  isPlaying: boolean;
}

export const SpatialChamber: React.FC<SpatialChamberProps> = ({
  acoustics,
  onAcousticsChange,
  coords,
  onCoordsChange,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'acoustics' | 'dimensions'>('acoustics');

  // Polar coordinates calculation
  const distance = Math.hypot(coords.x, coords.y, coords.z).toFixed(2);
  const azimuthDeg = Math.round((Math.atan2(coords.x, coords.y) * 180) / Math.PI);
  const elevationDeg = Math.round((Math.atan2(coords.z, Math.hypot(coords.x, coords.y)) * 180) / Math.PI);

  // Handle canvas mouse drag to position sound source
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
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

      // Center of canvas is (0,0) listener
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Scale: fit room width and length onto canvas with padding
      const maxDim = Math.max(acoustics.width, acoustics.length);
      const scale = (Math.min(rect.width, rect.height) * 0.8) / maxDim;

      // Meters relative to center
      const rawX = (clientX - centerX) / scale;
      const rawY = (centerY - clientY) / scale; // Invert Y so up is positive front

      // Clamp within room walls
      const halfW = acoustics.width / 2 - 0.2;
      const halfL = acoustics.length / 2 - 0.2;
      const clampedX = Math.max(-halfW, Math.min(halfW, rawX));
      const clampedY = Math.max(-halfL, Math.min(halfL, rawY));

      onCoordsChange({
        ...coords,
        x: parseFloat(clampedX.toFixed(2)),
        y: parseFloat(clampedY.toFixed(2)),
      });
    },
    [acoustics.width, acoustics.length, coords, onCoordsChange]
  );

  // Canvas render loop for 2D/3D acoustic soundstage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let wavePhase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;

      // Compute scale
      const maxDim = Math.max(acoustics.width, acoustics.length);
      const scale = (Math.min(w, h) * 0.8) / maxDim;

      const roomPxW = acoustics.width * scale;
      const roomPxL = acoustics.length * scale;
      const roomLeft = centerX - roomPxW / 2;
      const roomTop = centerY - roomPxL / 2;

      // 1. Draw Room Floor & Grid
      ctx.fillStyle = '#080b0f';
      ctx.fillRect(roomLeft, roomTop, roomPxW, roomPxL);

      // Meter grid lines
      ctx.strokeStyle = '#141b24';
      ctx.lineWidth = 1;
      const meterStep = scale; // 1 meter in pixels

      // Grid vertical
      for (let x = -Math.floor(acoustics.width / 2); x <= Math.floor(acoustics.width / 2); x++) {
        const px = centerX + x * meterStep;
        if (px >= roomLeft && px <= roomLeft + roomPxW) {
          ctx.beginPath();
          ctx.moveTo(px, roomTop);
          ctx.lineTo(px, roomTop + roomPxL);
          ctx.stroke();
        }
      }

      // Grid horizontal
      for (let y = -Math.floor(acoustics.length / 2); y <= Math.floor(acoustics.length / 2); y++) {
        const py = centerY - y * meterStep;
        if (py >= roomTop && py <= roomTop + roomPxL) {
          ctx.beginPath();
          ctx.moveTo(roomLeft, py);
          ctx.lineTo(roomLeft + roomPxW, py);
          ctx.stroke();
        }
      }

      // 2. Draw Distance Concentric Circles from Listener
      ctx.strokeStyle = '#1c2636';
      ctx.setLineDash([3, 4]);
      [2, 5, 10, 15].forEach((distMeters) => {
        const r = distMeters * scale;
        if (r < Math.max(roomPxW, roomPxL)) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);

      // 3. Draw Room Outer Boundary Walls
      ctx.strokeStyle = '#2b394e';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(roomLeft, roomTop, roomPxW, roomPxL);

      // Wall Corner Accents
      const cornerSize = 10;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      // Top-Left
      ctx.strokeRect(roomLeft - 1, roomTop - 1, cornerSize, 1);
      ctx.strokeRect(roomLeft - 1, roomTop - 1, 1, cornerSize);
      // Top-Right
      ctx.strokeRect(roomLeft + roomPxW - cornerSize + 1, roomTop - 1, cornerSize, 1);
      ctx.strokeRect(roomLeft + roomPxW, roomTop - 1, 1, cornerSize);
      // Bottom-Left
      ctx.strokeRect(roomLeft - 1, roomTop + roomPxL, cornerSize, 1);
      ctx.strokeRect(roomLeft - 1, roomTop + roomPxL - cornerSize + 1, 1, cornerSize);
      // Bottom-Right
      ctx.strokeRect(roomLeft + roomPxW - cornerSize + 1, roomTop + roomPxL, cornerSize, 1);
      ctx.strokeRect(roomLeft + roomPxW, roomTop + roomPxL - cornerSize + 1, 1, cornerSize);

      // 4. Source Pixel Position
      const srcPxX = centerX + coords.x * scale;
      const srcPxY = centerY - coords.y * scale;

      // Acoustic specular ray reflections (Direct path + 4 wall specular bounces)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;

      // Direct ray
      ctx.beginPath();
      ctx.moveTo(srcPxX, srcPxY);
      ctx.lineTo(centerX, centerY);
      ctx.stroke();

      // Wall reflection rays: compute reflection points on Left, Right, Top, Bottom walls
      const walls = [
        { x: roomLeft, y: (srcPxY + centerY) / 2 }, // Left wall reflection
        { x: roomLeft + roomPxW, y: (srcPxY + centerY) / 2 }, // Right wall reflection
        { x: (srcPxX + centerX) / 2, y: roomTop }, // Front wall reflection
        { x: (srcPxX + centerX) / 2, y: roomTop + roomPxL }, // Back wall reflection
      ];

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.setLineDash([2, 3]);
      walls.forEach((pt) => {
        ctx.beginPath();
        ctx.moveTo(srcPxX, srcPxY);
        ctx.lineTo(pt.x, pt.y);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 5. Sound Wave Ripples if Playing
      if (isPlaying) {
        wavePhase = (wavePhase + 0.8) % 40;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
        for (let r = wavePhase; r < 120; r += 20) {
          ctx.beginPath();
          ctx.arc(srcPxX, srcPxY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 6. Center Listener Node (Head + Ears)
      ctx.save();
      // Listener head
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ears (L / R)
      ctx.fillStyle = '#38bdf8';
      // Left Ear (-X)
      ctx.fillRect(centerX - 13, centerY - 3, 3, 6);
      // Right Ear (+X)
      ctx.fillRect(centerX + 10, centerY - 3, 3, 6);

      // Nose / Forward orientation indicator (+Y)
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(centerX - 3, centerY - 8);
      ctx.lineTo(centerX + 3, centerY - 8);
      ctx.lineTo(centerX, centerY - 14);
      ctx.closePath();
      ctx.fill();

      // Listener Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LISTENER', centerX, centerY + 22);
      ctx.restore();

      // 7. Draggable Sound Source Puck
      ctx.save();
      // Outer glow ring
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(srcPxX, srcPxY, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Inner puck
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(srcPxX, srcPxY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Elevation indicator (concentric dotted circle)
      if (Math.abs(coords.z) > 0.1) {
        ctx.strokeStyle = coords.z > 0 ? '#10b981' : '#f43f5e';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(srcPxX, srcPxY, 14 + Math.abs(coords.z) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Source Tag
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SOURCE', srcPxX, srcPxY - 18);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [acoustics, coords, isPlaying]);

  return (
    <div className="w-full bg-[#0d1016] border border-[#1d2634] rounded-md overflow-hidden flex flex-col xl:flex-row">
      {/* 2D/3D Top-Down Acoustic Soundstage Canvas */}
      <div className="flex-1 relative flex flex-col bg-[#07090c] p-3 border-b xl:border-b-0 xl:border-r border-[#1d2634]">
        {/* Header HUD */}
        <div className="flex items-center justify-between pb-2 border-b border-[#171f2c] text-xs font-mono select-none">
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-bold tracking-wider uppercase text-[11px]">
              ACOUSTIC SOUNDFIELD
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#131922] border border-[#202a3a] text-cyan-400">
              {acoustics.width}m Ã {acoustics.length}m Ã {acoustics.height}m
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>
              POS: <span className="text-cyan-300">X:{coords.x}m Y:{coords.y}m Z:{coords.z}m</span>
            </span>
            <span>
              AZIMUTH: <span className="text-amber-300">{azimuthDeg}Â°</span>
            </span>
            <span>
              DIST: <span className="text-emerald-300">{distance}m</span>
            </span>
          </div>
        </div>

        {/* Interactive Canvas */}
        <div className="relative flex-1 min-h-[300px] flex items-center justify-center py-2">
          <canvas
            ref={canvasRef}
            width={480}
            height={340}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full max-h-[360px] cursor-crosshair rounded bg-[#080b0f] border border-[#18212e] touch-none"
            title="Drag the sound source puck to position it relative to the central listener in the acoustic chamber."
          />
          <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] font-mono text-slate-500 bg-[#0c1017]/80 px-2 py-1 rounded border border-[#1b2330]">
            DRAG SOURCE PUCK TO RELOCATE
          </div>
        </div>

        {/* Elevation (Z-Axis) Slider */}
        <div className="pt-2 border-t border-[#171f2c] flex items-center justify-between gap-3 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">ELEVATION (Z-AXIS):</span>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <span className="text-[10px] text-slate-500">-5m</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.1"
              value={coords.z}
              onChange={(e) => onCoordsChange({ ...coords, z: parseFloat(e.target.value) })}
              className="flex-1 h-1.5"
            />
            <span className="text-[10px] text-slate-500">+5m</span>
          </div>
          <span className="text-cyan-400 w-12 text-right text-xs">
            {coords.z > 0 ? `+${coords.z}` : coords.z}m
          </span>
        </div>
      </div>

      {/* Acoustic Parameters Sidebar */}
      <div className="w-full xl:w-80 bg-[#0e121a] p-3 flex flex-col gap-3 font-mono text-xs select-none">
        {/* Tabs: Acoustics vs Dimensions */}
        <div className="flex rounded bg-[#080b0f] p-0.5 border border-[#1a2332]">
          <button
            onClick={() => setActiveTab('acoustics')}
            className={`flex-1 py-1 text-center text-[11px] rounded transition-colors cursor-pointer ${
              activeTab === 'acoustics'
                ? 'bg-[#18212e] text-cyan-300 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACOUSTICS & REVERB
          </button>
          <button
            onClick={() => setActiveTab('dimensions')}
            className={`flex-1 py-1 text-center text-[11px] rounded transition-colors cursor-pointer ${
              activeTab === 'dimensions'
                ? 'bg-[#18212e] text-cyan-300 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ROOM GEOMETRY
          </button>
        </div>

        {activeTab === 'acoustics' ? (
          <div className="flex flex-col gap-3">
            {/* Wall Material */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-[10px] flex justify-between">
                <span>WALL ABSORPTION MATERIAL</span>
                <span className="text-cyan-400 uppercase">{acoustics.material}</span>
              </label>
              <select
                value={acoustics.material}
                onChange={(e) =>
                  onAcousticsChange({
                    ...acoustics,
                    material: e.target.value as RoomAcoustics['material'],
                  })
                }
                className="w-full bg-[#121822] border border-[#232f42] rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="studio">Studio Treated Panels (Î± = 0.65)</option>
                <option value="wood">Symphonic Hardwood (Î± = 0.35)</option>
                <option value="cathedral">Gothic Limestone Vault (Î± = 0.12)</option>
                <option value="concrete">Reinforced Concrete (Î± = 0.08)</option>
                <option value="tile">Ceramic Echo Tile (Î± = 0.04)</option>
                <option value="anechoic">Anechoic Polyurethane Foam (Î± = 0.98)</option>
              </select>
            </div>

            {/* RT60 Decay Time */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">RT60 DECAY TIME</span>
                <span className="text-amber-400 font-semibold">{acoustics.rt60.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="6.0"
                step="0.05"
                value={acoustics.rt60}
                onChange={(e) => onAcousticsChange({ ...acoustics, rt60: parseFloat(e.target.value) })}
                className="w-full h-1.5"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0.1s (Dry)</span>
                <span>3.0s</span>
                <span>6.0s (Cathedral)</span>
              </div>
            </div>

            {/* High Frequency Damping */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">HF DAMPING (ABSORPTION)</span>
                <span className="text-cyan-400 font-semibold">{acoustics.damping} Hz</span>
              </div>
              <input
                type="range"
                min="1000"
                max="18000"
                step="250"
                value={acoustics.damping}
                onChange={(e) => onAcousticsChange({ ...acoustics, damping: parseInt(e.target.value) })}
                className="w-full h-1.5"
              />
            </div>

            {/* Early Reflections Mix */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">EARLY REFLECTIONS</span>
                <span className="text-slate-200 font-semibold">
                  {Math.round(acoustics.earlyReflections * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={acoustics.earlyReflections}
                onChange={(e) =>
                  onAcousticsChange({ ...acoustics, earlyReflections: parseFloat(e.target.value) })
                }
                className="w-full h-1.5"
              />
            </div>

            {/* Pre-Delay */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">PRE-DELAY</span>
                <span className="text-slate-200 font-semibold">{acoustics.preDelayMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={acoustics.preDelayMs}
                onChange={(e) =>
                  onAcousticsChange({ ...acoustics, preDelayMs: parseInt(e.target.value) })
                }
                className="w-full h-1.5"
              />
            </div>

            {/* Space Reverb Wet Mix */}
            <div className="flex flex-col gap-1 pt-2 border-t border-[#1a2332]">
              <div className="flex justify-between text-[11px]">
                <span className="text-cyan-400 font-semibold">SPACE WET / DRY MIX</span>
                <span className="text-cyan-300 font-bold">
                  {Math.round(acoustics.wetMix * 100)}% WET
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={acoustics.wetMix}
                onChange={(e) => onAcousticsChange({ ...acoustics, wetMix: parseFloat(e.target.value) })}
                className="w-full h-2 accent-cyan-400"
              />
            </div>
          </div>
        ) : (
          /* Dimensions Tab */
          <div className="flex flex-col gap-3">
            {/* Room Width */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">ROOM WIDTH</span>
                <span className="text-slate-200 font-semibold">{acoustics.width} meters</span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="0.5"
                value={acoustics.width}
                onChange={(e) => onAcousticsChange({ ...acoustics, width: parseFloat(e.target.value) })}
                className="w-full h-1.5"
              />
            </div>

            {/* Room Length */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">ROOM LENGTH</span>
                <span className="text-slate-200 font-semibold">{acoustics.length} meters</span>
              </div>
              <input
                type="range"
                min="4"
                max="40"
                step="0.5"
                value={acoustics.length}
                onChange={(e) => onAcousticsChange({ ...acoustics, length: parseFloat(e.target.value) })}
                className="w-full h-1.5"
              />
            </div>

            {/* Room Height */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">ROOM HEIGHT (CEILING)</span>
                <span className="text-slate-200 font-semibold">{acoustics.height} meters</span>
              </div>
              <input
                type="range"
                min="2.5"
                max="16"
                step="0.5"
                value={acoustics.height}
                onChange={(e) => onAcousticsChange({ ...acoustics, height: parseFloat(e.target.value) })}
                className="w-full h-1.5"
              />
            </div>

            {/* Physical Room Stats */}
            <div className="mt-3 bg-[#080b0f] p-2.5 rounded border border-[#182230] flex flex-col gap-1.5 text-[10px]">
              <div className="flex justify-between text-slate-400">
                <span>ENCLOSED VOLUME:</span>
                <span className="text-slate-200">
                  {Math.round(acoustics.width * acoustics.length * acoustics.height)} mÂ³
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>TOTAL SURFACE AREA:</span>
                <span className="text-slate-200">
                  {Math.round(
                    2 * (acoustics.width * acoustics.length +
                      acoustics.width * acoustics.height +
                      acoustics.length * acoustics.height)
                  )}{' '}
                  mÂ²
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>THEORETICAL SCHROEDER FREQ:</span>
                <span className="text-cyan-400">
                  {Math.round(
                    2000 *
                      Math.sqrt(
                        acoustics.rt60 /
                          (acoustics.width * acoustics.length * acoustics.height)
                      )
                  )}{' '}
                  Hz
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
