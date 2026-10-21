import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AudioUploader } from './components/AudioUploader';
import { WaveformViewer } from './components/WaveformViewer';
import { AudioPlayerControls } from './components/AudioPlayerControls';
import { AnalysisStatsCard } from './components/AnalysisStatsCard';
import { SilenceSettingsPanel } from './components/SilenceSettingsPanel';
import { SilenceSegmentList } from './components/SilenceSegmentList';
import { ExportModal } from './components/ExportModal';
import { SAMPLE_PRESETS, SamplePreset } from './components/SyntheticPresets';
import {
  detectSilenceRegions,
  recalculateWithToggledSilences,
  renderProcessedAudio,
  computeWaveformPeaks,
  SilenceRegion,
  SpeechRegion,
  AudioAnalysisStats,
} from './utils/audioSilence';
import {
  audioBuffersToWavBlob,
  audioBuffersToFlacBlob,
  audioBuffersToMp3Blob,
  ExportFormat,
} from './utils/audioExport';

interface AudioState {
  filename: string;
  originalChannels: Float32Array[];
  processedChannels: Float32Array[];
  sampleRate: number;
  originalDuration: number;
  processedDuration: number;
  originalPeaks: { peaksMin: Float32Array; peaksMax: Float32Array; rms: Float32Array };
  processedPeaks: { peaksMin: Float32Array; peaksMax: Float32Array; rms: Float32Array };
  silences: SilenceRegion[];
  speech: SpeechRegion[];
  stats: AudioAnalysisStats;
}

export default function App() {
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<'original' | 'processed'>('processed');
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [selectedSilenceId, setSelectedSilenceId] = useState<string | undefined>();
  const [vuLevels, setVuLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  // Settings
  const [settings, setSettings] = useState({
    minDuration: 0.5, // Standard requested threshold: > 0.5 seconds
    thresholdDb: -40,
    paddingMs: 40,
    truncateMode: 'strip' as 'strip' | 'shorten',
    truncateDurationMs: 200,
    normalize: true,
    crossfadeMs: 5,
  });

  // Audio Context & Web Audio Nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const originalAudioBufferRef = useRef<AudioBuffer | null>(null);
  const processedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Stop currently playing source node
  const stopSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
  }, []);

  // Update playback time and VU meter
  const startPlaybackLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const analyser = analyserNodeRef.current;
    const dataArray = analyser ? new Float32Array(analyser.frequencyBinCount) : null;

    const step = () => {
      if (!ctx) return;

      const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
      const pos = pauseOffsetRef.current + elapsed;

      const currentDuration =
        activeTrack === 'original'
          ? audioState?.originalDuration ?? 0
          : audioState?.processedDuration ?? 0;

      if (pos >= currentDuration) {
        if (isLooping) {
          pauseOffsetRef.current = 0;
          playStartTimeRef.current = ctx.currentTime;
          setCurrentTime(0);
        } else {
          stopSource();
          setIsPlaying(false);
          pauseOffsetRef.current = 0;
          setCurrentTime(0);
          setVuLevels({ left: 0, right: 0 });
          return;
        }
      } else {
        setCurrentTime(pos);
      }

      // Read VU meter
      if (analyser && dataArray) {
        analyser.getFloatTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const level = Math.min(1, rms * 3.5);
        setVuLevels({ left: level, right: level * 0.95 });
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [playbackRate, activeTrack, audioState, isLooping, stopSource]);

  // Start playback from current offset
  const playAudio = useCallback(
    (offset?: number) => {
      const ctx = getAudioContext();
      stopSource();

      const buffer =
        activeTrack === 'original'
          ? originalAudioBufferRef.current
          : processedAudioBufferRef.current;

      if (!buffer) return;

      const startPos = offset !== undefined ? offset : pauseOffsetRef.current;
      pauseOffsetRef.current = startPos;
      playStartTimeRef.current = ctx.currentTime;

      // Audio Graph: Source -> Gain -> Analyser -> Destination
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.loop = false; // We handle looping in animation loop for accurate timer

      const gain = ctx.createGain();
      gain.gain.value = volume;
      gainNodeRef.current = gain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserNodeRef.current = analyser;

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      source.start(0, Math.max(0, startPos));
      sourceNodeRef.current = source;
      setIsPlaying(true);

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      startPlaybackLoop();
    },
    [activeTrack, getAudioContext, playbackRate, stopSource, volume, startPlaybackLoop]
  );

  const pauseAudio = useCallback(() => {
    stopSource();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    pauseOffsetRef.current = currentTime;
    setIsPlaying(false);
    setVuLevels({ left: 0, right: 0 });
  }, [currentTime, stopSource]);

  const togglePlay = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  const handleSeek = (time: number) => {
    pauseOffsetRef.current = time;
    setCurrentTime(time);
    if (isPlaying) {
      playAudio(time);
    }
  };

  const handleSwitchTrack = (track: 'original' | 'processed') => {
    if (track === activeTrack) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) pauseAudio();

    setActiveTrack(track);

    // Approximate playhead position in the other track
    if (audioState) {
      const fromDur = activeTrack === 'original' ? audioState.originalDuration : audioState.processedDuration;
      const toDur = track === 'original' ? audioState.originalDuration : audioState.processedDuration;
      const ratio = fromDur > 0 ? currentTime / fromDur : 0;
      const targetTime = Math.min(toDur, ratio * toDur);
      pauseOffsetRef.current = targetTime;
      setCurrentTime(targetTime);
    }

    if (wasPlaying) {
      setTimeout(() => playAudio(), 50);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVol;
    }
  };

  const handlePlaybackRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = newRate;
    }
  };

  // Helper: converts channel arrays into an AudioBuffer
  const channelsToAudioBuffer = (
    ctx: AudioContext,
    channels: Float32Array[],
    sampleRate: number
  ): AudioBuffer => {
    const numChannels = channels.length;
    const numSamples = channels[0].length;
    const audioBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      audioBuffer.getChannelData(c).set(channels[c]);
    }
    return audioBuffer;
  };

  // Process raw audio channels with silence detection
  const processLoadedChannels = useCallback(
    (
      rawChannels: Float32Array[],
      sampleRate: number,
      filename: string
    ) => {
      setIsAnalyzing(true);
      const ctx = getAudioContext();

      const truncateDuration =
        settings.truncateMode === 'shorten' ? settings.truncateDurationMs / 1000 : 0;

      // Detect silences > minDuration (default 0.5s)
      const { silences, speech, stats } = detectSilenceRegions(rawChannels, sampleRate, {
        thresholdDb: settings.thresholdDb,
        minSilenceDuration: settings.minDuration,
        paddingDuration: settings.paddingMs / 1000,
        truncateSilenceDuration: truncateDuration,
      });

      // Render spliced processed channels
      const processedChannels = renderProcessedAudio(rawChannels, sampleRate, speech, {
        normalize: settings.normalize,
        crossfadeMs: settings.crossfadeMs,
        truncateSilenceDuration: truncateDuration,
      });

      // Compute visual peaks for both
      const originalPeaks = computeWaveformPeaks(rawChannels[0], 800);
      const processedPeaks = computeWaveformPeaks(processedChannels[0], 800);

      // Create Web Audio buffers
      const origBuffer = channelsToAudioBuffer(ctx, rawChannels, sampleRate);
      const procBuffer = channelsToAudioBuffer(ctx, processedChannels, sampleRate);

      originalAudioBufferRef.current = origBuffer;
      processedAudioBufferRef.current = procBuffer;

      setAudioState({
        filename,
        originalChannels: rawChannels,
        processedChannels,
        sampleRate,
        originalDuration: origBuffer.duration,
        processedDuration: procBuffer.duration,
        originalPeaks,
        processedPeaks,
        silences,
        speech,
        stats,
      });

      setIsAnalyzing(false);
      setIsLoading(false);
    },
    [getAudioContext, settings]
  );

  // Handle uploaded audio file
  const handleFileSelected = async (file: File) => {
    setIsLoading(true);
    pauseAudio();

    try {
      const ctx = getAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      const numChannels = decodedBuffer.numberOfChannels;
      const channels: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        channels.push(decodedBuffer.getChannelData(c));
      }

      processLoadedChannels(channels, decodedBuffer.sampleRate, file.name);
    } catch (err) {
      console.error('Failed to decode audio file:', err);
      setIsLoading(false);
    }
  };

  // Handle sample preset selected
  const handlePresetSelected = (preset: SamplePreset) => {
    setIsLoading(true);
    pauseAudio();

    setTimeout(() => {
      const { channels, sampleRate, filename } = preset.generate(44100);
      processLoadedChannels(channels, sampleRate, filename);
    }, 50);
  };

  // Toggle individual silence
  const handleToggleSilence = (silenceId: string) => {
    if (!audioState) return;

    const updatedSilences = audioState.silences.map((s) =>
      s.id === silenceId ? { ...s, active: !s.active } : s
    );

    const truncateDuration =
      settings.truncateMode === 'shorten' ? settings.truncateDurationMs / 1000 : 0;

    const { speech, stats } = recalculateWithToggledSilences(
      updatedSilences,
      audioState.originalChannels[0].length,
      audioState.sampleRate,
      truncateDuration
    );

    // Re-render processed audio
    const processedChannels = renderProcessedAudio(
      audioState.originalChannels,
      audioState.sampleRate,
      speech,
      {
        normalize: settings.normalize,
        crossfadeMs: settings.crossfadeMs,
        truncateSilenceDuration: truncateDuration,
      }
    );

    const ctx = getAudioContext();
    const procBuffer = channelsToAudioBuffer(ctx, processedChannels, audioState.sampleRate);
    processedAudioBufferRef.current = procBuffer;
    const processedPeaks = computeWaveformPeaks(processedChannels[0], 800);

    setAudioState({
      ...audioState,
      silences: updatedSilences,
      speech,
      stats,
      processedChannels,
      processedDuration: procBuffer.duration,
      processedPeaks,
    });
  };

  const handleSelectAllSilences = (active: boolean) => {
    if (!audioState) return;
    const updatedSilences = audioState.silences.map((s) => ({ ...s, active }));
    const truncateDuration =
      settings.truncateMode === 'shorten' ? settings.truncateDurationMs / 1000 : 0;

    const { speech, stats } = recalculateWithToggledSilences(
      updatedSilences,
      audioState.originalChannels[0].length,
      audioState.sampleRate,
      truncateDuration
    );

    const processedChannels = renderProcessedAudio(
      audioState.originalChannels,
      audioState.sampleRate,
      speech,
      {
        normalize: settings.normalize,
        crossfadeMs: settings.crossfadeMs,
        truncateSilenceDuration: truncateDuration,
      }
    );

    const ctx = getAudioContext();
    const procBuffer = channelsToAudioBuffer(ctx, processedChannels, audioState.sampleRate);
    processedAudioBufferRef.current = procBuffer;
    const processedPeaks = computeWaveformPeaks(processedChannels[0], 800);

    setAudioState({
      ...audioState,
      silences: updatedSilences,
      speech,
      stats,
      processedChannels,
      processedDuration: procBuffer.duration,
      processedPeaks,
    });
  };

  // Preview specific silence
  const handlePreviewSilence = (silence: SilenceRegion) => {
    setSelectedSilenceId(silence.id);
    setActiveTrack('original');
    const startOffset = Math.max(0, silence.start - 0.2);
    pauseOffsetRef.current = startOffset;
    setCurrentTime(startOffset);
    playAudio(startOffset);
  };

  // Re-apply settings
  const handleApplySettings = () => {
    if (!audioState) return;
    processLoadedChannels(
      audioState.originalChannels,
      audioState.sampleRate,
      audioState.filename
    );
  };

  // High-Quality Multi-Format Export (WAV, FLAC, MP3 320kbps)
  const handleExportAudio = ({
    format,
    bitDepth,
    mp3Kbps,
    normalize,
    filename,
  }: {
    format: ExportFormat;
    bitDepth: 16 | 24 | 32;
    mp3Kbps: number;
    normalize: boolean;
    filename: string;
  }) => {
    if (!audioState) return;

    // Render with final export parameters
    const finalChannels = renderProcessedAudio(
      audioState.originalChannels,
      audioState.sampleRate,
      audioState.speech,
      {
        normalize,
        crossfadeMs: settings.crossfadeMs,
        truncateSilenceDuration:
          settings.truncateMode === 'shorten' ? settings.truncateDurationMs / 1000 : 0,
      }
    );

    let blob: Blob;
    if (format === 'wav') {
      blob = audioBuffersToWavBlob(finalChannels, audioState.sampleRate, bitDepth);
    } else if (format === 'flac') {
      blob = audioBuffersToFlacBlob(finalChannels, audioState.sampleRate);
    } else {
      blob = audioBuffersToMp3Blob(finalChannels, audioState.sampleRate, mp3Kbps);
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    pauseAudio();
    setAudioState(null);
    setCurrentTime(0);
    pauseOffsetRef.current = 0;
  };

  // Auto-load preset on start or via query parameter (?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldAutostart = params.get('autostart') === '1';

    // Automatically load the default AI Podcast Monologue preset so user lands into active studio
    if (SAMPLE_PRESETS.length > 0) {
      const preset = SAMPLE_PRESETS[0];
      const { channels, sampleRate, filename } = preset.generate(44100);
      processLoadedChannels(channels, sampleRate, filename);

      if (shouldAutostart) {
        setTimeout(() => {
          playAudio(0);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* App Header */}
      <Header
        onOpenExport={() => setIsExportModalOpen(true)}
        onReset={handleReset}
        hasAudio={!!audioState}
        sampleRate={audioState?.sampleRate}
        channelsCount={audioState?.originalChannels.length}
        filename={audioState?.filename}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!audioState ? (
          <AudioUploader
            onFileSelected={handleFileSelected}
            onPresetSelected={handlePresetSelected}
            isLoading={isLoading}
          />
        ) : (
          <div className="space-y-6">
            {/* Top Stats Overview */}
            <AnalysisStatsCard
              stats={audioState.stats}
              thresholdDuration={settings.minDuration}
            />

            {/* Interactive Waveform Visualizer */}
            <WaveformViewer
              originalPeaks={audioState.originalPeaks}
              processedPeaks={audioState.processedPeaks}
              originalDuration={audioState.originalDuration}
              processedDuration={audioState.processedDuration}
              silenceRegions={audioState.silences}
              speechRegions={audioState.speech}
              currentTime={currentTime}
              isPlaying={isPlaying}
              activeTrack={activeTrack}
              onSeek={handleSeek}
              onSelectSilence={(silence) => setSelectedSilenceId(silence.id)}
            />

            {/* Audio Player Controls & VU meters */}
            <AudioPlayerControls
              isPlaying={isPlaying}
              activeTrack={activeTrack}
              currentTime={currentTime}
              duration={
                activeTrack === 'original'
                  ? audioState.originalDuration
                  : audioState.processedDuration
              }
              volume={volume}
              playbackRate={playbackRate}
              isLooping={isLooping}
              onTogglePlay={togglePlay}
              onSwitchTrack={handleSwitchTrack}
              onSeek={handleSeek}
              onChangeVolume={handleVolumeChange}
              onChangePlaybackRate={handlePlaybackRateChange}
              onToggleLoop={() => setIsLooping(!isLooping)}
              vuLevelLeft={vuLevels.left}
              vuLevelRight={vuLevels.right}
            />

            {/* Controls & Silence Cut Manager Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <SilenceSettingsPanel
                  settings={settings}
                  onChangeSettings={setSettings}
                  onApply={handleApplySettings}
                  isAnalyzing={isAnalyzing}
                />
              </div>

              <div className="lg:col-span-5">
                <SilenceSegmentList
                  silences={audioState.silences}
                  onToggleSilence={handleToggleSilence}
                  onPreviewSilence={handlePreviewSilence}
                  onSelectAll={handleSelectAllSilences}
                  selectedSilenceId={selectedSilenceId}
                  thresholdDuration={settings.minDuration}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Export High-Quality Audio Modal (WAV Lossless, FLAC Lossless, MP3 320kbps) */}
      {audioState && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onExport={handleExportAudio}
          originalFilename={audioState.filename}
          sampleRate={audioState.sampleRate}
          channelsCount={audioState.originalChannels.length}
          processedDuration={audioState.processedDuration}
          silences={audioState.silences}
          speech={audioState.speech}
        />
      )}
    </div>
  );
}
