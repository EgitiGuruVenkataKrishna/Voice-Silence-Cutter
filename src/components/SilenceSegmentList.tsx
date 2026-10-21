import React from 'react';
import { SilenceRegion } from '../utils/audioSilence';
import { CheckSquare, Square, Play, Eye, Scissors, Info } from 'lucide-react';

interface SilenceSegmentListProps {
  silences: SilenceRegion[];
  onToggleSilence: (id: string) => void;
  onPreviewSilence: (silence: SilenceRegion) => void;
  onSelectAll: (active: boolean) => void;
  selectedSilenceId?: string;
  thresholdDuration?: number;
}

export const SilenceSegmentList: React.FC<SilenceSegmentListProps> = ({
  silences,
  onToggleSilence,
  onPreviewSilence,
  onSelectAll,
  selectedSilenceId,
  thresholdDuration = 0.5,
}) => {
  const activeCount = silences.filter((s) => s.active).length;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Header & Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              Detected Silence Segments (&gt;{thresholdDuration.toFixed(1)}s)
            </h3>
            <p className="text-xs text-zinc-400">
              Review and toggle individual silence gaps to remove or preserve
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400 mr-1">
            {activeCount} of {silences.length} marked for cut
          </span>
          <button
            type="button"
            onClick={() => onSelectAll(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Cut All
          </button>
          <button
            type="button"
            onClick={() => onSelectAll(false)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Keep All
          </button>
        </div>
      </div>

      {/* Segments Table / List */}
      {silences.length === 0 ? (
        <div className="py-8 text-center space-y-2 text-zinc-500">
          <Info className="w-6 h-6 mx-auto text-zinc-600" />
          <p className="text-sm">No silences exceeding 0.5s were detected in this audio file.</p>
          <p className="text-xs text-zinc-600">Try lowering the minimum silence duration or threshold.</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {silences.map((silence, idx) => {
            const isHighlighted = selectedSilenceId === silence.id;
            return (
              <div
                key={silence.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all text-xs ${
                  isHighlighted
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : silence.active
                    ? 'border-red-900/40 bg-red-950/20 hover:bg-red-950/30'
                    : 'border-zinc-800 bg-zinc-950/60 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Checkbox & ID */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleSilence(silence.id)}
                    aria-label={`Toggle silence cut for gap #${idx + 1}`}
                    className="text-zinc-300 hover:text-emerald-400 p-0.5 rounded"
                  >
                    {silence.active ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-600" />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-200">
                      Gap #{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        silence.active
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {silence.active ? 'Cut' : 'Preserved'}
                    </span>
                  </div>
                </div>

                {/* Timestamps & Duration */}
                <div className="flex items-center gap-4 font-mono">
                  <div className="text-zinc-400 text-right">
                    <span>{silence.start.toFixed(2)}s</span>
                    <span className="text-zinc-600 mx-1">→</span>
                    <span>{silence.end.toFixed(2)}s</span>
                  </div>

                  <div className="w-18 text-right font-bold text-emerald-400">
                    +{silence.duration.toFixed(2)}s
                  </div>

                  <div className="w-16 text-right text-zinc-500 hidden sm:block">
                    {silence.averageDb} dB
                  </div>
                </div>

                {/* Actions: Jump/Preview */}
                <div className="flex items-center gap-1.5 pl-2">
                  <button
                    type="button"
                    onClick={() => onPreviewSilence(silence)}
                    aria-label={`Preview silence #${idx + 1}`}
                    title="Jump & Preview this silence"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-300 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
