import React from 'react';
import { Scissors, Sparkles, Download, RefreshCw, AudioWaveform } from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
  onReset: () => void;
  hasAudio: boolean;
  sampleRate?: number;
  channelsCount?: number;
  filename?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  onReset,
  hasAudio,
  sampleRate,
  channelsCount,
  filename,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-500/20">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
                SilenceCutter AI
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Studio v2
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Intelligent silence analyzer & cleaner for AI-generated voice & speech
            </p>
          </div>
        </div>

        {/* Status / Active File Metadata */}
        {hasAudio && (
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
            <AudioWaveform className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-mono text-zinc-200 max-w-[180px] truncate" title={filename}>
              {filename || 'audio.wav'}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : ''}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{channelsCount === 2 ? 'Stereo' : 'Mono'}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasAudio && (
            <>
              <button
                type="button"
                onClick={onReset}
                aria-label="Load a different audio file"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New File</span>
              </button>

              <button
                type="button"
                onClick={onOpenExport}
                aria-label="Export processed audio file"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export <span className="hidden sm:inline">High-Quality</span></span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
