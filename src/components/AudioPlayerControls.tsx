import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Sparkles,
  Layers,
  Repeat,
} from 'lucide-react';

interface AudioPlayerControlsProps {
  isPlaying: boolean;
  activeTrack: 'original' | 'processed';
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLooping: boolean;
  onTogglePlay: () => void;
  onSwitchTrack: (track: 'original' | 'processed') => void;
  onSeek: (time: number) => void;
  onChangeVolume: (volume: number) => void;
  onChangePlaybackRate: (rate: number) => void;
  onToggleLoop: () => void;
  vuLevelLeft: number;
  vuLevelRight: number;
}

export const AudioPlayerControls: React.FC<AudioPlayerControlsProps> = ({
  isPlaying,
  activeTrack,
  currentTime,
  duration,
  volume,
  playbackRate,
  isLooping,
  onTogglePlay,
  onSwitchTrack,
  onSeek,
  onChangeVolume,
  onChangePlaybackRate,
  onToggleLoop,
  vuLevelLeft,
  vuLevelRight,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onChangeVolume(prevVolume || 1);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      onChangeVolume(0);
    }
  };

  const skip = (delta: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    onSeek(newTime);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = (secs % 60).toFixed(1);
    return `${mins.toString().padStart(2, '0')}:${remaining.padStart(4, '0')}`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Upper row: A/B Track Selector & Quick Specs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
        {/* A/B Switcher */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 px-2 uppercase tracking-wider">
            Audio Track:
          </span>
          <button
            type="button"
            onClick={() => onSwitchTrack('processed')}
            aria-label="Listen to processed audio with silences removed"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTrack === 'processed'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Processed (Clean)</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTrack('original')}
            aria-label="Listen to original raw audio"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTrack === 'original'
                ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Original (Raw)</span>
          </button>
        </div>

        {/* Real-time VU meter */}
        <div className="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold text-zinc-500">L</span>
              <div className="w-20 sm:w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, isPlaying ? vuLevelLeft * 100 : 0)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold text-zinc-500">R</span>
              <div className="w-20 sm:w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, isPlaying ? vuLevelRight * 100 : 0)}%` }}
                />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">VU Meter</span>
        </div>
      </div>

      {/* Main Playback Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Play / Skip Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Restart audio from beginning"
            title="Restart"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => skip(-5)}
            aria-label="Skip back 5 seconds"
            title="Back 5s"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Master Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-zinc-950" /> : <Play className="w-6 h-6 fill-zinc-950 translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => skip(5)}
            aria-label="Skip forward 5 seconds"
            title="Forward 5s"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <FastForward className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
            title="Loop Playback"
            className={`p-2 rounded-xl transition-colors ${
              isLooping
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Time display */}
        <div className="font-mono text-sm text-zinc-200">
          <span className="text-emerald-400 font-bold">{formatTime(currentTime)}</span>
          <span className="text-zinc-500 mx-1.5">/</span>
          <span className="text-zinc-400">{formatTime(duration)}</span>
        </div>

        {/* Speed & Volume */}
        <div className="flex items-center gap-3">
          {/* Speed selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onChangePlaybackRate(rate)}
                className={`px-2 py-1 rounded-lg font-mono font-medium transition-colors ${
                  playbackRate === rate
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="text-zinc-400 hover:text-zinc-200 p-1"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setIsMuted(false);
                onChangeVolume(val);
              }}
              aria-label="Volume slider"
              className="w-16 sm:w-20 accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
