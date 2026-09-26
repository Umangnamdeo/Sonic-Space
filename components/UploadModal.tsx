'use client';

import React, { useRef, useState } from 'react';
import { Upload, AlertTriangle, ShieldCheck, CheckCircle2, X, FileAudio } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileLoaded: (file: File) => Promise<void>;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onFileLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleValidateAndLoad = async (file: File) => {
    setErrorMsg(null);

    // 1. Validate File Size (< 50MB)
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum 50MB limit.`);
      return;
    }

    // 2. Validate File Extension
    const allowedExts = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.aiff', '.webm'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = allowedExts.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt && !file.type.startsWith('audio/')) {
      setErrorMsg('Unsupported format. Please select an uncompressed or standard audio file (WAV, MP3, FLAC, OGG).');
      return;
    }

    setIsLoading(true);
    try {
      await onFileLoaded(file);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decode audio file';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateAndLoad(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleValidateAndLoad(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="w-full max-w-md bg-[#0e121a] border border-[#232f42] rounded-lg shadow-2xl p-5 flex flex-col gap-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2636]">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-sm tracking-wide text-white">
              LOAD AUDIO FILE
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1a2332] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full py-8 px-4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/30'
              : 'border-[#253245] bg-[#090d14] hover:border-slate-500'
          }`}
        >
          <FileAudio className="w-10 h-10 text-cyan-400/80" />
          <div className="text-center">
            <span className="text-xs font-semibold text-slate-200 block">
              Drag & Drop audio file here, or click to browse
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Supports WAV, MP3, FLAC, OGG, AAC (Max 50MB)
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac,.aiff"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Client-Side Privacy Notice */}
        <div className="flex items-start gap-2 bg-[#090c12] p-3 rounded border border-[#1b2536] text-[11px] text-slate-400 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-200 font-semibold block">Client-Side Processing Security</span>
            <span>
              Your audio file is decoded directly in your browser memory using Web Audio API. Audio data is
              never uploaded or stored on any external server.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
