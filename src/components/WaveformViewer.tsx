import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SilenceRegion, SpeechRegion } from '../utils/audioSilence';
import { ZoomIn, ZoomOut, Maximize2, Scissors, Sparkles, Volume2 } from 'lucide-react';

interface WaveformViewerProps {
  originalPeaks: { peaksMin: Float32Array; peaksMax: Float32Array; rms: Float32Array } | null;
  processedPeaks: { peaksMin: Float32Array; peaksMax: Float32Array; rms: Float32Array } | null;
  originalDuration: number;
  processedDuration: number;
  silenceRegions: SilenceRegion[];
  speechRegions: SpeechRegion[];
  currentTime: number;
  isPlaying: boolean;
  activeTrack: 'original' | 'processed';
  onSeek: (time: number) => void;
  onSelectSilence?: (silence: SilenceRegion) => void;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  originalPeaks,
  processedPeaks,
  originalDuration,
  processedDuration,
  silenceRegions,
  speechRegions,
  currentTime,
  isPlaying,
  activeTrack,
  onSeek,
  onSelectSilence,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = fit, 2 = 2x, 4 = 4x
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverRegionInfo, setHoverRegionInfo] = useState<string | null>(null);

  const duration = activeTrack === 'original' ? originalDuration : processedDuration;
  const currentPeaks = activeTrack === 'original' ? originalPeaks : processedPeaks;

  // Handle zoom in/out
  const handleZoomIn = () => setZoomLevel((z) => Math.min(8, z * 1.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1, z / 1.5));
  const handleZoomFit = () => setZoomLevel(1);

  // Redraw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPeaks || duration <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const clientWidth = canvas.clientWidth;
    const clientHeight = canvas.clientHeight;

    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = clientWidth;
    const height = clientHeight;
    const centerY = height / 2;

    // Clear background
    ctx.fillStyle = '#09090b'; // zinc-950
    ctx.fillRect(0, 0, width, height);

    // Grid lines & Time markers
    ctx.strokeStyle = '#27272a'; // zinc-800
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const timeStep = duration > 60 ? 10 : duration > 20 ? 5 : duration > 5 ? 1 : 0.5;
    ctx.fillStyle = '#71717a'; // zinc-500
    ctx.font = '10px monospace';

    for (let t = 0; t <= duration; t += timeStep) {
      const x = (t / duration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 6);
      ctx.stroke();
      if (x < width - 30) {
        ctx.fillText(`${t.toFixed(1)}s`, x + 2, 12);
      }
    }

    // Render Silence Highlights (if viewing Original track)
    if (activeTrack === 'original') {
      silenceRegions.forEach((s) => {
        const xStart = (s.start / duration) * width;
        const xEnd = (s.end / duration) * width;
        const w = Math.max(2, xEnd - xStart);

        if (s.active) {
          // Amber/Red cut background
          ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
          ctx.fillRect(xStart, 16, w, height - 16);

          // Top badge line
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(xStart, 16, w, 2);

          // Striping pattern
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 1;
          for (let sx = xStart; sx < xEnd; sx += 8) {
            ctx.beginPath();
            ctx.moveTo(sx, 16);
            ctx.lineTo(Math.min(sx + 10, xEnd), height);
            ctx.stroke();
          }

          // Label text if width is enough
          if (w > 45) {
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText(`CUT ${s.duration.toFixed(1)}s`, xStart + 4, 30);
          }
        } else {
          // Inactive / kept silence
          ctx.fillStyle = 'rgba(161, 161, 170, 0.12)';
          ctx.fillRect(xStart, 16, w, height - 16);
        }
      });
    }

    // Render Waveform bars
    const numPoints = currentPeaks.peaksMin.length;
    const barWidth = Math.max(1, width / numPoints);

    for (let i = 0; i < numPoints; i++) {
      const x = i * barWidth;
      const minVal = currentPeaks.peaksMin[i];
      const maxVal = currentPeaks.peaksMax[i];
      const timeAtPoint = (i / numPoints) * duration;

      const yTop = centerY - Math.max(2, maxVal * (centerY - 16));
      const yBottom = centerY - Math.min(-2, minVal * (centerY - 16));

      // Check if this point falls inside an active cut silence
      let isInsideSilence = false;
      if (activeTrack === 'original') {
        isInsideSilence = silenceRegions.some(
          (s) => s.active && timeAtPoint >= s.start && timeAtPoint <= s.end
        );
      }

      if (isInsideSilence) {
        ctx.fillStyle = '#f87171'; // red-400 for silence
      } else {
        // Gradient color for speech: emerald/cyan
        const progress = i / numPoints;
        ctx.fillStyle = activeTrack === 'original' ? '#10b981' : '#06b6d4'; // emerald vs cyan
      }

      ctx.fillRect(x, yTop, Math.max(1, barWidth - 0.5), Math.max(2, yBottom - yTop));
    }

    // Render Playhead cursor
    if (currentTime >= 0 && currentTime <= duration) {
      const playheadX = (currentTime / duration) * width;

      // Vertical glow line
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Handle triangle
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [currentPeaks, duration, silenceRegions, activeTrack, currentTime, zoomLevel]);

  // Handle canvas click / scrubbing
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;
    onSeek(targetTime);

    // If clicked inside a silence region, trigger selection
    if (activeTrack === 'original' && onSelectSilence) {
      const clickedSilence = silenceRegions.find(
        (s) => targetTime >= s.start && targetTime <= s.end
      );
      if (clickedSilence) {
        onSelectSilence(clickedSilence);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    const t = ratio * duration;
    setHoverTime(t);

    if (activeTrack === 'original') {
      const matchSilence = silenceRegions.find((s) => t >= s.start && t <= s.end);
      if (matchSilence) {
        setHoverRegionInfo(`Detected Silence (${matchSilence.duration.toFixed(2)}s) > 0.5s`);
      } else {
        setHoverRegionInfo('Speech Region');
      }
    } else {
      setHoverRegionInfo('Processed Audio');
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverRegionInfo(null);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg text-zinc-300">
              {activeTrack === 'original' ? 'Original Audio Timeline' : 'Processed Spliced Audio'}
            </span>
          </div>

          {activeTrack === 'original' && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400 pl-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Active Speech
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Silences Cut (&gt;0.5s)
              </span>
            </div>
          )}
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-zinc-400">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in waveform"
            title="Zoom In"
            className="p-1.5 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out waveform"
            title="Zoom Out"
            className="p-1.5 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomFit}
            aria-label="Fit waveform to screen"
            title="Fit to Screen"
            className="p-1.5 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors text-xs font-mono px-2"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Waveform Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-xl border border-zinc-800/90 bg-zinc-950 shadow-inner group"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-40 sm:h-48 cursor-crosshair block"
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
        />

        {/* Hover Inspector Tooltip */}
        {hoverTime !== null && (
          <div className="pointer-events-none absolute bottom-2 left-3 px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-700/80 text-[11px] text-zinc-200 shadow-md backdrop-blur-sm flex items-center gap-2">
            <span className="font-mono text-emerald-400">{hoverTime.toFixed(2)}s</span>
            {hoverRegionInfo && <span className="text-zinc-400">• {hoverRegionInfo}</span>}
          </div>
        )}
      </div>

      {/* Timeline subtext */}
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1 font-mono">
        <span>00:00.0</span>
        <span className="text-zinc-300 font-semibold">
          Cursor: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
        <span>
          {Math.floor(duration / 60)
            .toString()
            .padStart(2, '0')}
          :
          {(duration % 60).toFixed(1).padStart(4, '0')}
        </span>
      </div>
    </div>
  );
};
