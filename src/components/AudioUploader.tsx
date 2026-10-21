import React, { useRef, useState } from 'react';
import { Upload, Music, Sparkles, Mic, Play, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SAMPLE_PRESETS, SamplePreset } from './SyntheticPresets';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
  onPresetSelected: (preset: SamplePreset) => void;
  isLoading: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileSelected,
  onPresetSelected,
  isLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i)) {
        onFileSelected(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-4 py-8">
      {/* Intro hero banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Precision Audio Silence Removal (&gt;0.5s)</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
          Clean Silences from AI Speech in Seconds
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          AI voice generators often leave awkward hesitation pauses, thought gaps, and dead air.
          Upload your AI-generated audio or try an instant sample to automatically detect silences
          longer than <strong className="text-emerald-400 font-semibold">0.5 seconds</strong> and export pristine, click-free audio.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400 shadow-xl group-hover:scale-105 transition-transform">
            <Upload className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold text-zinc-200">
              Drag & drop your AI audio file here, or <span className="text-emerald-400 underline underline-offset-4">browse</span>
            </p>
            <p className="text-xs text-zinc-400">
              Supports WAV, MP3, M4A, OGG, AAC, FLAC, and WebM (lossless sample accurate decoding)
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">Auto 0.5s Threshold</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">Anti-Click Crossfade</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">32-bit Float Master</span>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-zinc-200">Decoding and analyzing audio waveform...</p>
          </div>
        )}
      </div>

      {/* Or Quick Instant Samples */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Or test instantly with AI Voice Presets
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={isLoading}
              onClick={() => onPresetSelected(preset)}
              className="group text-left p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 transition-all shadow-sm hover:shadow-emerald-500/5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">
                    <Music className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {preset.durationEstimate}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                    {preset.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.subtitle}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-emerald-400 font-medium">
                <span>Load Sample</span>
                <Play className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
