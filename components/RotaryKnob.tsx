'use client';

import React, { useState, useRef, useCallback } from 'react';

interface RotaryKnobProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  displayValue?: string;
  onChange: (val: number) => void;
  size?: number; // diameter in px (default 52)
  accentColor?: string; // default amber/cyan
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 0.1,
  defaultValue = 0,
  unit = '',
  displayValue,
  onChange,
  size = 52,
  accentColor = '#f59e0b', // warm amber matching screenshot
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  // Angle ranges from -135deg (min) to +135deg (max) => total 270deg
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angleDeg = -135 + fraction * 270;

  // Pointer drag logic
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      // 150px drag distance for full range (finer if shift pressed)
      const sensitivity = e.shiftKey ? 400 : 160;
      const change = (deltaY / sensitivity) * range;
      let nextVal = startValRef.current + change;

      // Snap to step
      if (step > 0) {
        nextVal = Math.round(nextVal / step) * step;
      }
      nextVal = Math.max(min, Math.min(max, nextVal));
      onChange(Number(nextVal.toFixed(2)));
    },
    [isDragging, max, min, onChange, step]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * (step || 0.1);
    let nextVal = value + (e.shiftKey ? delta * 0.2 : delta);
    nextVal = Math.max(min, Math.min(max, nextVal));
    onChange(Number(nextVal.toFixed(2)));
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  // SVG arc calculation
  const radius = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -135 * (Math.PI / 180);
  const currentAngle = angleDeg * (Math.PI / 180);

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInRadians: number) => ({
    x: centerX + r * Math.sin(angleInRadians),
    y: centerY - r * Math.cos(angleInRadians),
  });

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= Math.PI ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Arc path from -135deg to currentAngle
  const arcPath = fraction > 0.001 ? describeArc(cx, cy, radius, startAngle, currentAngle) : '';
  const backgroundArc = describeArc(cx, cy, radius, startAngle, 135 * (Math.PI / 180));

  // Formatted readout text
  const formattedText =
    displayValue !== undefined
      ? displayValue
      : unit === 'Hz'
      ? `${Math.round(value)} Hz`
      : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${unit ? ' ' + unit : 'dB'}`;

  return (
    <div className="flex flex-col items-center select-none" id={id}>
      {/* Label */}
      <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5 font-medium">
        {label}
      </span>

      {/* Knob Body */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${formattedText} (Drag vertically, double-click to reset)`}
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center cursor-ns-resize group touch-none"
      >
        {/* Background track SVG */}
        <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
          {/* Base inactive ring */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="#1b212c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Active arc */}
          {arcPath && (
            <path
              d={arcPath}
              fill="none"
              stroke={accentColor}
              strokeWidth="3"
              strokeLinecap="round"
              className="transition-colors"
            />
          )}
        </svg>

        {/* Rotary Knurled Disc */}
        <div
          style={{
            width: size - 14,
            height: size - 14,
            transform: `rotate(${angleDeg}deg)`,
          }}
          className={`rounded-full bg-[#11161f] border border-[#263142] shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),0_2px_6px_rgba(0,0,0,0.6)] flex items-center justify-center transition-shadow relative ${
            isDragging ? 'ring-1 ring-amber-500/50' : 'group-hover:border-[#38475e]'
          }`}
        >
          {/* Needle / Indicator Tick */}
          <div
            style={{ backgroundColor: accentColor }}
            className="absolute top-1.5 w-[2px] h-[7px] rounded-full shadow-[0_0_4px_rgba(245,158,11,0.6)]"
          />
          {/* Center metallic dimple */}
          <div className="w-2.5 h-2.5 rounded-full bg-[#0c0f16] border border-[#1e2634]" />
        </div>
      </div>

      {/* Value Readout */}
      <span className="text-[11px] font-mono tracking-tight text-zinc-300 mt-1.5 font-medium tabular-nums">
        {formattedText}
      </span>
    </div>
  );
};
