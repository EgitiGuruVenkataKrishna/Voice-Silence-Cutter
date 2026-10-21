import React from 'react';
import { Sliders, HelpCircle, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface SilenceSettings {
  minDuration: number;
  thresholdDb: number;
  paddingMs: number;
  truncateMode: 'strip' | 'shorten';
  truncateDurationMs: number;
  normalize: boolean;
  crossfadeMs: number;
}

interface SilenceSettingsPanelProps {
  settings: SilenceSettings;
  onChangeSettings: (newSettings: SilenceSettings) => void;
  onApply: () => void;
  isAnalyzing: boolean;
}

export const SilenceSettingsPanel: React.FC<SilenceSettingsPanelProps> = ({
  settings,
  onChangeSettings,
  onApply,
  isAnalyzing,
}) => {
  const update = <K extends keyof SilenceSettings>(key: K, value: SilenceSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm sm:text-base">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Silence Detection & Splicing Parameters</span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          Active Filter: &gt;{settings.minDuration.toFixed(2)}s
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Setting 1: Min Silence Duration (Adjustable 0.1s to 5.0s, default 0.5s) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <span>Silence Removal Threshold</span>
              {settings.minDuration === 0.5 && (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  Default: 0.5s
                </span>
              )}
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0.1"
                max="5.0"
                step="0.05"
                value={settings.minDuration}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    update('minDuration', Math.max(0.1, Math.min(5.0, val)));
                  }
                }}
                aria-label="Silence threshold in seconds"
                className="w-16 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-right font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-mono text-zinc-400">s</span>
            </div>
          </div>

          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.05"
            value={settings.minDuration}
            onChange={(e) => update('minDuration', parseFloat(e.target.value))}
            aria-label="Adjust silence duration threshold between 0.1s and 5.0s"
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {[0.2, 0.5, 1.0, 2.0, 3.0, 5.0].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => update('minDuration', preset)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  settings.minDuration === preset
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {preset === 0.5 ? '0.5s*' : `${preset}s`}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400">
            Removes silences exceeding this duration (adjustable from 0.1s to 5.0s).
          </p>
        </div>

        {/* Setting 2: Silence dB Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200">
              Silence Threshold (dB)
            </label>
            <span className="font-mono text-xs text-zinc-200 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              {settings.thresholdDb} dB
            </span>
          </div>
          <input
            type="range"
            min="-60"
            max="-20"
            step="1"
            value={settings.thresholdDb}
            onChange={(e) => update('thresholdDb', parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>-60 dB (Clean studio)</span>
            <span>-40 dB</span>
            <span>-20 dB (Noisy mic)</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Audio below this energy level is classified as silence.
          </p>
        </div>

        {/* Setting 3: Plosive Safety Padding */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200">
              Voice Margin / Padding
            </label>
            <span className="font-mono text-xs text-zinc-200 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              {settings.paddingMs} ms
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="5"
            value={settings.paddingMs}
            onChange={(e) => update('paddingMs', parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>0 ms (Sharp cut)</span>
            <span>40 ms (Natural)</span>
            <span>120 ms (Wide)</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Protects trailing vocal decay and plosive consonants.
          </p>
        </div>
      </div>

      {/* Advanced Splicing & Output Options */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
        {/* Truncate vs Strip Mode */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-300">Cut Style:</span>
          <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => update('truncateMode', 'strip')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                settings.truncateMode === 'strip'
                  ? 'bg-emerald-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Strip Completely (0s)
            </button>
            <button
              type="button"
              onClick={() => update('truncateMode', 'shorten')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                settings.truncateMode === 'shorten'
                  ? 'bg-emerald-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Shorten to Breathing Pause (200ms)
            </button>
          </div>
        </div>

        {/* Master options & Re-analyze trigger */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={settings.normalize}
              onChange={(e) => update('normalize', e.target.checked)}
              className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 accent-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span>Auto Peak Normalize (-0.1 dB)</span>
          </label>

          <button
            type="button"
            onClick={onApply}
            disabled={isAnalyzing}
            aria-label="Re-analyze audio with new parameters"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 shadow-md shadow-emerald-500/20 transition-transform active:scale-95 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Re-Analyze Waveform</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
