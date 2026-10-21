import React, { useState } from 'react';
import { Download, X, FileAudio, CheckCircle2, FileText, Sparkles, Music, Disc } from 'lucide-react';
import { SilenceRegion, SpeechRegion, generateEdlReport } from '../utils/audioSilence';
import { ExportFormat } from '../utils/audioExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: {
    format: ExportFormat;
    bitDepth: 16 | 24 | 32;
    mp3Kbps: number;
    normalize: boolean;
    filename: string;
  }) => void;
  originalFilename: string;
  sampleRate: number;
  channelsCount: number;
  processedDuration: number;
  silences: SilenceRegion[];
  speech: SpeechRegion[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  originalFilename,
  sampleRate,
  channelsCount,
  processedDuration,
  silences,
  speech,
}) => {
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [bitDepth, setBitDepth] = useState<16 | 24 | 32>(24);
  const [mp3Kbps, setMp3Kbps] = useState<number>(320); // At least 320kbps as requested
  const [normalize, setNormalize] = useState(true);
  const [customName, setCustomName] = useState(() => {
    const base = originalFilename.replace(/\.[^/.]+$/, '');
    return `${base}_clean`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  if (!isOpen) return null;

  // File extension corresponding to current format
  const extension = format === 'wav' ? '.wav' : format === 'flac' ? '.flac' : '.mp3';

  // Calculate estimated file size
  let estimatedBytes = 0;
  if (format === 'wav') {
    const bytesPerSample = bitDepth / 8;
    estimatedBytes = 44 + processedDuration * sampleRate * channelsCount * bytesPerSample;
  } else if (format === 'flac') {
    // 16-bit FLAC container
    estimatedBytes = 38 + processedDuration * sampleRate * channelsCount * 2 + 1024;
  } else {
    // MP3 at 320 kbps CBR
    estimatedBytes = Math.floor(((mp3Kbps * 1000) / 8) * processedDuration);
  }
  const estimatedMb = (estimatedBytes / (1024 * 1024)).toFixed(2);

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      onExport({
        format,
        bitDepth,
        mp3Kbps,
        normalize,
        filename: `${customName}${extension}`,
      });
      setIsExporting(false);
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    }, 120);
  };

  const handleDownloadEdl = () => {
    const edlContent = generateEdlReport(originalFilename, silences, speech);
    const blob = new Blob([edlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customName}_CutList.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-zinc-950 shadow-md shadow-emerald-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Export High-Quality Audio</h2>
              <p className="text-xs text-zinc-400">Choose between Lossless WAV, Lossless FLAC, or 320kbps MP3</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          {/* Format Selection Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Target Audio Format</label>
            <div className="grid grid-cols-3 gap-2">
              {/* WAV */}
              <button
                type="button"
                onClick={() => setFormat('wav')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  format === 'wav'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-100">WAV</span>
                  <Disc className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[10px] text-emerald-400/90 font-medium mt-0.5">Lossless Master</div>
              </button>

              {/* FLAC */}
              <button
                type="button"
                onClick={() => setFormat('flac')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  format === 'flac'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-100">FLAC</span>
                  <FileAudio className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[10px] text-emerald-400/90 font-medium mt-0.5">Lossless Codec</div>
              </button>

              {/* MP3 (320kbps) */}
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  format === 'mp3'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-100">MP3</span>
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[10px] text-emerald-400/90 font-medium mt-0.5">320 kbps (CBR)</div>
              </button>
            </div>
          </div>

          {/* Sub-format settings */}
          {format === 'wav' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <label className="text-xs font-semibold text-zinc-300">WAV Bit Depth</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { depth: 24 as const, label: '24-bit PCM', desc: 'Studio Standard' },
                  { depth: 32 as const, label: '32-bit Float', desc: 'True Lossless' },
                  { depth: 16 as const, label: '16-bit PCM', desc: 'CD Quality' },
                ].map((opt) => (
                  <button
                    key={opt.depth}
                    type="button"
                    onClick={() => setBitDepth(opt.depth)}
                    className={`p-2 rounded-lg border text-left transition-all text-xs ${
                      bitDepth === opt.depth
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] text-zinc-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {format === 'mp3' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <label className="text-xs font-semibold text-zinc-300">MP3 Bitrate (Minimum 320 kbps)</label>
              <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold text-sm">320 kbps</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Maximum CBR Quality
                  </span>
                </div>
                <span className="text-xs text-zinc-400">Broadcast Grade</span>
              </div>
            </div>
          )}

          {format === 'flac' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400">
              <div className="flex items-center justify-between text-zinc-300 font-semibold">
                <span>Free Lossless Audio Codec (RFC 9582)</span>
                <span className="text-emerald-400 font-mono">16-bit Lossless</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Pure bit-perfect lossless compression compatible with VLC, Audacity, Premiere, and modern media players.
              </p>
            </div>
          )}

          {/* Filename Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">File Name</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-xs font-mono text-emerald-400 font-bold">{extension}</span>
            </div>
          </div>

          {/* Mastering & Normalization Toggle */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Peak Normalization (-0.1 dBFS)
                </span>
                <p className="text-[11px] text-zinc-500">
                  Optimizes speech loudness without introducing distortion or clipping.
                </p>
              </div>
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* File summary badges */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80 text-center text-xs">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Sample Rate</span>
              <span className="font-mono font-bold text-zinc-300">
                {(sampleRate / 1000).toFixed(1)} kHz
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Channels</span>
              <span className="font-mono font-bold text-zinc-300">
                {channelsCount === 2 ? 'Stereo' : 'Mono'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Estimated Size</span>
              <span className="font-mono font-bold text-emerald-400">
                ~{estimatedMb} MB
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-zinc-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-500/25 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : exportComplete ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Downloaded Successfully!</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>
                  Download {format.toUpperCase()}{' '}
                  {format === 'mp3' ? '(320kbps)' : '(Lossless)'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadEdl}
            className="w-full py-2 px-3 rounded-xl font-medium text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download Silence Cut Report (EDL / Text List)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
