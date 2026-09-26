'use client';

import React, { useState } from 'react';
import { getSonicSpaceEngine } from '@/lib/audioEngine';
import { Download, CheckCircle, AlertCircle, Loader2, X, Activity } from 'lucide-react';
import { SpatialMotionConfig } from '@/lib/audioTypes';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetName: string;
  motionConfig?: SpatialMotionConfig;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  presetName,
  motionConfig,
}) => {
  const [bitDepth, setBitDepth] = useState<16 | 24>(24);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedFile, setRenderedFile] = useState<{
    url: string;
    filename: string;
    sizeBytes: number;
    duration: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsRendering(true);
    setErrorMsg(null);

    try {
      const engine = getSonicSpaceEngine();
      const result = await engine.exportProcessedWav({
        bitDepth,
        motionConfig,
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const motionTag =
        motionConfig?.active && motionConfig.pattern !== 'manual'
          ? `_${motionConfig.pattern}`
          : '';
      const cleanPreset = presetName.replace(/\s+/g, '_');
      const filename = `SonicSpace_${cleanPreset}${motionTag}_${bitDepth}bit_${dateStr}.wav`;
      const url = URL.createObjectURL(result.blob);

      setRenderedFile({
        url,
        filename,
        sizeBytes: result.size,
        duration: result.duration,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown rendering failure';
      setErrorMsg(`Export failed: ${error}`);
    } finally {
      setIsRendering(false);
    }
  };

  const handleClose = () => {
    if (renderedFile) {
      URL.revokeObjectURL(renderedFile.url);
      setRenderedFile(null);
    }
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="w-full max-w-md bg-[#0e121a] border border-[#232f42] rounded-lg shadow-2xl p-5 flex flex-col gap-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2636]">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-sm tracking-wide text-white">
              OFFLINE AUDIO RENDER & EXPORT
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-[#1a2332] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed">
          Renders the current spatial acoustic soundstage and full DSP chain (EQ, Compression,
          Convolution Reverb, Saturation, Delay) offline into a broadcast-grade PCM WAV master.
        </p>

        {/* Bit Depth Selector */}
        {!renderedFile && (
          <div className="flex flex-col gap-2 bg-[#090c12] p-3 rounded border border-[#1b2536]">
            <span className="text-xs text-slate-300 font-semibold">PCM BIT DEPTH:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBitDepth(24)}
                className={`py-2 px-3 rounded text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                  bitDepth === 24
                    ? 'bg-cyan-950/70 border border-cyan-500/80 text-cyan-300 font-bold shadow-xs'
                    : 'bg-[#121824] border border-[#222e40] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>24-BIT LINEAR PCM</span>
                <span className="text-[10px] text-slate-500 font-normal">Studio Master Quality</span>
              </button>

              <button
                type="button"
                onClick={() => setBitDepth(16)}
                className={`py-2 px-3 rounded text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                  bitDepth === 16
                    ? 'bg-cyan-950/70 border border-cyan-500/80 text-cyan-300 font-bold shadow-xs'
                    : 'bg-[#121824] border border-[#222e40] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>16-BIT RED BOOK</span>
                <span className="text-[10px] text-slate-500 font-normal">Standard Distribution</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Completed Render Card */}
        {renderedFile && (
          <div className="flex flex-col gap-3 bg-[#090d14] p-3.5 rounded border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle className="w-4 h-4" />
              <span>RENDER SUCCESSFUL</span>
            </div>

            <div className="text-[11px] text-slate-300 flex flex-col gap-1 bg-[#101520] p-2.5 rounded border border-[#1b2536]">
              <div className="truncate text-cyan-300 font-semibold">{renderedFile.filename}</div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-[#182230]">
                <span>DURATION: {renderedFile.duration.toFixed(2)}s</span>
                <span>SIZE: {(renderedFile.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>

            <a
              href={renderedFile.url}
              download={renderedFile.filename}
              className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD WAV FILE</span>
            </a>
          </div>
        )}

        {/* Action Button */}
        {!renderedFile && (
          <button
            onClick={handleStartExport}
            disabled={isRendering}
            className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>RENDERING OFFLINE DSP GRAPH...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>RENDER & EXPORT MASTER WAV</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
