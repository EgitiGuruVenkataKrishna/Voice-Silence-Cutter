import React from 'react';
import { AudioAnalysisStats } from '../utils/audioSilence';
import { Clock, Zap, Scissors, Sparkles, TrendingUp, BarChart2 } from 'lucide-react';

interface AnalysisStatsCardProps {
  stats: AudioAnalysisStats;
  thresholdDuration?: number;
}

export const AnalysisStatsCard: React.FC<AnalysisStatsCardProps> = ({
  stats,
  thresholdDuration = 0.5,
}) => {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return mins > 0 ? `${mins}m ${s}s` : `${s}s`;
  };

  const speedupFactor = stats.processedDuration > 0
    ? (stats.originalDuration / stats.processedDuration).toFixed(2)
    : '1.0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Time Saved */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Silence Removed</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Scissors className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              -{formatTime(stats.totalSilenceRemoved)}
            </span>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {stats.percentageSaved}%
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Dead air stripped from track
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Processed Length */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Output Duration</span>
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">
              {formatTime(stats.processedDuration)}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              / {formatTime(stats.originalDuration)}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Tightened continuous speech
          </p>
        </div>
      </div>

      {/* 3. Pauses Detected */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Pauses (&gt;{thresholdDuration.toFixed(1)}s)
          </span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
              {stats.silenceCount}
            </span>
            <span className="text-xs text-zinc-400">
              gaps cut
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Avg pause: {stats.avgSilenceLength}s (max: {stats.longestSilence}s)
          </p>
        </div>
      </div>

      {/* 4. Pacing Factor */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider">Pacing Boost</span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono tracking-tight">
              {speedupFactor}x
            </span>
            <span className="text-xs text-purple-400/80 font-medium">
              pacing
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Speech density & flow increase
          </p>
        </div>
      </div>
    </div>
  );
};
