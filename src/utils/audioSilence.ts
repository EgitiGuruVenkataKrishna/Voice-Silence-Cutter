export {
  audioBuffersToWavBlob,
  audioBuffersToMp3Blob,
  audioBuffersToFlacBlob,
  type ExportFormat,
} from './audioExport';

export interface SilenceDetectionOptions {
  /** Silence threshold in decibels (e.g. -40 dB). Default: -40 */
  thresholdDb?: number;
  /** Minimum silence duration in seconds to trigger removal. Default: 0.5s (as specified) */
  minSilenceDuration?: number;
  /** Safety margin around speech in seconds (pre and post roll). Default: 0.04s */
  paddingDuration?: number;
  /**
   * Truncate mode: instead of completely removing silence, reduce it to this duration (in seconds).
   * 0 means completely strip the silence. Default: 0.
   */
  truncateSilenceDuration?: number;
}

export interface AudioRegion {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  duration: number; // in seconds
  sampleStart: number;
  sampleEnd: number;
}

export interface SilenceRegion extends AudioRegion {
  active: boolean; // whether user chose to remove this region
  averageDb: number;
}

export interface SpeechRegion extends AudioRegion {
  targetSilenceAfter?: number; // if silence truncation is enabled
}

export interface AudioAnalysisStats {
  originalDuration: number;
  processedDuration: number;
  totalSilenceRemoved: number;
  silenceCount: number;
  percentageSaved: number;
  avgSilenceLength: number;
  longestSilence: number;
}

/**
 * Converts a decibel level (-inf to 0) to linear amplitude (0.0 to 1.0)
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Converts linear amplitude to decibels
 */
export function linearToDb(linear: number): number {
  if (linear <= 1e-7) return -140;
  return 20 * Math.log10(linear);
}

/**
 * Analyzes audio channels to detect silences exceeding minSilenceDuration.
 */
export function detectSilenceRegions(
  channels: Float32Array[],
  sampleRate: number,
  options: SilenceDetectionOptions = {}
): {
  silences: SilenceRegion[];
  speech: SpeechRegion[];
  stats: AudioAnalysisStats;
} {
  const thresholdDb = options.thresholdDb ?? -40;
  const minDuration = options.minSilenceDuration ?? 0.5;
  const padding = options.paddingDuration ?? 0.04;
  const truncateTo = Math.max(0, options.truncateSilenceDuration ?? 0);

  const numChannels = channels.length;
  if (numChannels === 0 || channels[0].length === 0) {
    return {
      silences: [],
      speech: [],
      stats: {
        originalDuration: 0,
        processedDuration: 0,
        totalSilenceRemoved: 0,
        silenceCount: 0,
        percentageSaved: 0,
        avgSilenceLength: 0,
        longestSilence: 0,
      },
    };
  }

  const totalSamples = channels[0].length;
  const originalDuration = totalSamples / sampleRate;
  const thresholdLinear = dbToLinear(thresholdDb);

  // Analysis window: ~20ms frames with 10ms hop for high resolution
  const frameSize = Math.max(128, Math.floor(sampleRate * 0.02));
  const hopSize = Math.max(64, Math.floor(sampleRate * 0.01));
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1;

  // Compute RMS per frame across all channels
  const isSilentFrame = new Uint8Array(numFrames);
  const frameDb = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const startSample = f * hopSize;
    let sumSquares = 0;
    let count = 0;

    for (let c = 0; c < numChannels; c++) {
      const channel = channels[c];
      for (let i = 0; i < frameSize; i++) {
        const sample = channel[startSample + i];
        sumSquares += sample * sample;
        count++;
      }
    }

    const rms = Math.sqrt(sumSquares / count);
    frameDb[f] = linearToDb(rms);
    isSilentFrame[f] = rms < thresholdLinear ? 1 : 0;
  }

  // Find contiguous silent blocks in frame units
  const minFrames = Math.ceil((minDuration * sampleRate) / hopSize);
  const rawSilences: { startFrame: number; endFrame: number; avgDb: number }[] = [];

  let inSilence = false;
  let silenceStartFrame = 0;
  let silenceDbSum = 0;

  for (let f = 0; f < numFrames; f++) {
    if (isSilentFrame[f] === 1) {
      if (!inSilence) {
        inSilence = true;
        silenceStartFrame = f;
        silenceDbSum = 0;
      }
      silenceDbSum += frameDb[f];
    } else {
      if (inSilence) {
        const frameLength = f - silenceStartFrame;
        if (frameLength >= minFrames) {
          rawSilences.push({
            startFrame: silenceStartFrame,
            endFrame: f,
            avgDb: silenceDbSum / frameLength,
          });
        }
        inSilence = false;
      }
    }
  }

  // Check ending silence
  if (inSilence) {
    const frameLength = numFrames - silenceStartFrame;
    if (frameLength >= minFrames) {
      rawSilences.push({
        startFrame: silenceStartFrame,
        endFrame: numFrames,
        avgDb: silenceDbSum / frameLength,
      });
    }
  }

  // Convert raw silences into sample boundaries with padding consideration
  const paddingSamples = Math.floor(padding * sampleRate);
  const silences: SilenceRegion[] = [];

  for (let idx = 0; idx < rawSilences.length; idx++) {
    const raw = rawSilences[idx];
    let startSample = raw.startFrame * hopSize;
    let endSample = Math.min(totalSamples, raw.endFrame * hopSize + frameSize);

    // If silence is in between speech, respect pre-roll and post-roll safety padding
    // Silence starts after speech ends + padding
    if (startSample > 0) {
      startSample = Math.min(endSample, startSample + paddingSamples);
    }
    // Silence ends before speech starts - padding
    if (endSample < totalSamples) {
      endSample = Math.max(startSample, endSample - paddingSamples);
    }

    const duration = (endSample - startSample) / sampleRate;

    // Only keep if post-padding duration still satisfies the minimum duration
    if (duration >= minDuration * 0.85 && duration >= 0.05) {
      silences.push({
        id: `silence-${idx + 1}`,
        start: Number((startSample / sampleRate).toFixed(4)),
        end: Number((endSample / sampleRate).toFixed(4)),
        duration: Number(duration.toFixed(4)),
        sampleStart: startSample,
        sampleEnd: endSample,
        active: true,
        averageDb: Number(raw.avgDb.toFixed(1)),
      });
    }
  }

  // Derive speech regions (the inverse of active silences)
  const speech: SpeechRegion[] = [];
  let currentSample = 0;

  for (let i = 0; i < silences.length; i++) {
    const silence = silences[i];
    if (silence.sampleStart > currentSample) {
      const spStart = currentSample;
      const spEnd = silence.sampleStart;
      const spDuration = (spEnd - spStart) / sampleRate;
      if (spDuration > 0.01) {
        speech.push({
          id: `speech-${speech.length + 1}`,
          start: Number((spStart / sampleRate).toFixed(4)),
          end: Number((spEnd / sampleRate).toFixed(4)),
          duration: Number(spDuration.toFixed(4)),
          sampleStart: spStart,
          sampleEnd: spEnd,
          targetSilenceAfter: truncateTo,
        });
      }
    }
    currentSample = silence.sampleEnd;
  }

  // Trailing speech segment
  if (currentSample < totalSamples) {
    const spStart = currentSample;
    const spEnd = totalSamples;
    const spDuration = (spEnd - spStart) / sampleRate;
    if (spDuration > 0.01) {
      speech.push({
        id: `speech-${speech.length + 1}`,
        start: Number((spStart / sampleRate).toFixed(4)),
        end: Number((spEnd / sampleRate).toFixed(4)),
        duration: Number(spDuration.toFixed(4)),
        sampleStart: spStart,
        sampleEnd: spEnd,
      });
    }
  }

  // Calculate statistics
  let totalSilenceDuration = 0;
  let longestSilence = 0;
  for (const s of silences) {
    totalSilenceDuration += s.duration;
    if (s.duration > longestSilence) {
      longestSilence = s.duration;
    }
  }

  const effectiveCutDuration = silences.reduce((acc, s) => {
    const cutAmount = Math.max(0, s.duration - truncateTo);
    return acc + cutAmount;
  }, 0);

  const processedDuration = Math.max(0, originalDuration - effectiveCutDuration);
  const percentageSaved = originalDuration > 0
    ? Math.round((effectiveCutDuration / originalDuration) * 100)
    : 0;

  const stats: AudioAnalysisStats = {
    originalDuration: Number(originalDuration.toFixed(2)),
    processedDuration: Number(processedDuration.toFixed(2)),
    totalSilenceRemoved: Number(effectiveCutDuration.toFixed(2)),
    silenceCount: silences.length,
    percentageSaved,
    avgSilenceLength: silences.length > 0 ? Number((totalSilenceDuration / silences.length).toFixed(2)) : 0,
    longestSilence: Number(longestSilence.toFixed(2)),
  };

  return { silences, speech, stats };
}

/**
 * Re-calculates speech segments and stats based on a modified list of silences
 * (e.g. when user toggles individual silence regions to keep or remove).
 */
export function recalculateWithToggledSilences(
  silences: SilenceRegion[],
  totalSamples: number,
  sampleRate: number,
  truncateDuration: number = 0
): { speech: SpeechRegion[]; stats: AudioAnalysisStats } {
  const originalDuration = totalSamples / sampleRate;
  const activeSilences = silences.filter((s) => s.active).sort((a, b) => a.sampleStart - b.sampleStart);

  const speech: SpeechRegion[] = [];
  let currentSample = 0;

  for (let i = 0; i < activeSilences.length; i++) {
    const s = activeSilences[i];
    if (s.sampleStart > currentSample) {
      const spStart = currentSample;
      const spEnd = s.sampleStart;
      const spDuration = (spEnd - spStart) / sampleRate;
      if (spDuration > 0.005) {
        speech.push({
          id: `speech-${speech.length + 1}`,
          start: Number((spStart / sampleRate).toFixed(4)),
          end: Number((spEnd / sampleRate).toFixed(4)),
          duration: Number(spDuration.toFixed(4)),
          sampleStart: spStart,
          sampleEnd: spEnd,
          targetSilenceAfter: truncateDuration,
        });
      }
    }
    currentSample = s.sampleEnd;
  }

  if (currentSample < totalSamples) {
    const spStart = currentSample;
    const spEnd = totalSamples;
    const spDuration = (spEnd - spStart) / sampleRate;
    if (spDuration > 0.005) {
      speech.push({
        id: `speech-${speech.length + 1}`,
        start: Number((spStart / sampleRate).toFixed(4)),
        end: Number((spEnd / sampleRate).toFixed(4)),
        duration: Number(spDuration.toFixed(4)),
        sampleStart: spStart,
        sampleEnd: spEnd,
      });
    }
  }

  const effectiveCutDuration = activeSilences.reduce((acc, s) => {
    const cut = Math.max(0, s.duration - truncateDuration);
    return acc + cut;
  }, 0);

  const processedDuration = Math.max(0, originalDuration - effectiveCutDuration);
  const percentageSaved = originalDuration > 0
    ? Math.round((effectiveCutDuration / originalDuration) * 100)
    : 0;

  const totalActiveSilence = activeSilences.reduce((acc, s) => acc + s.duration, 0);

  const stats: AudioAnalysisStats = {
    originalDuration: Number(originalDuration.toFixed(2)),
    processedDuration: Number(processedDuration.toFixed(2)),
    totalSilenceRemoved: Number(effectiveCutDuration.toFixed(2)),
    silenceCount: activeSilences.length,
    percentageSaved,
    avgSilenceLength: activeSilences.length > 0 ? Number((totalActiveSilence / activeSilences.length).toFixed(2)) : 0,
    longestSilence: activeSilences.length > 0 ? Math.max(...activeSilences.map((s) => s.duration)) : 0,
  };

  return { speech, stats };
}

/**
 * Builds processed audio buffers by concatenating speech segments and optionally inserting
 * shortened silence, applying smooth micro-crossfades to eliminate audio clicks.
 */
export function renderProcessedAudio(
  originalChannels: Float32Array[],
  sampleRate: number,
  speechRegions: SpeechRegion[],
  options: {
    normalize?: boolean;
    crossfadeMs?: number;
    truncateSilenceDuration?: number;
  } = {}
): Float32Array[] {
  const numChannels = originalChannels.length;
  if (numChannels === 0 || speechRegions.length === 0) {
    return originalChannels.map((c) => new Float32Array(c.length));
  }

  const crossfadeSamples = Math.min(
    256,
    Math.floor(((options.crossfadeMs ?? 5) / 1000) * sampleRate)
  );
  const truncateSec = options.truncateSilenceDuration ?? 0;
  const truncateSamples = Math.floor(truncateSec * sampleRate);

  // Calculate target total length
  let totalLength = 0;
  for (let i = 0; i < speechRegions.length; i++) {
    const region = speechRegions[i];
    const len = region.sampleEnd - region.sampleStart;
    totalLength += len;
    if (i < speechRegions.length - 1 && truncateSamples > 0) {
      totalLength += truncateSamples;
    }
  }

  const outChannels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    outChannels.push(new Float32Array(totalLength));
  }

  let writePos = 0;

  for (let i = 0; i < speechRegions.length; i++) {
    const region = speechRegions[i];
    const regionLen = region.sampleEnd - region.sampleStart;
    const isFirst = i === 0;
    const isLast = i === speechRegions.length - 1;

    for (let c = 0; c < numChannels; c++) {
      const src = originalChannels[c];
      const dest = outChannels[c];

      // Copy samples
      for (let s = 0; s < regionLen; s++) {
        let sample = src[region.sampleStart + s];

        // Apply micro fade-in at region start if not the very start of file
        if (!isFirst && s < crossfadeSamples) {
          const fadeFactor = 0.5 * (1 - Math.cos((Math.PI * s) / crossfadeSamples));
          sample *= fadeFactor;
        }

        // Apply micro fade-out at region end if not the very end of file
        if (!isLast && s >= regionLen - crossfadeSamples) {
          const fadeIndex = s - (regionLen - crossfadeSamples);
          const fadeFactor = 0.5 * (1 + Math.cos((Math.PI * fadeIndex) / crossfadeSamples));
          sample *= fadeFactor;
        }

        dest[writePos + s] = sample;
      }
    }

    writePos += regionLen;

    // If truncating to a specific silence duration, advance silence space (it will be zeroed)
    if (!isLast && truncateSamples > 0) {
      writePos += truncateSamples;
    }
  }

  // Peak normalization if enabled
  if (options.normalize) {
    let peak = 0;
    for (let c = 0; c < numChannels; c++) {
      const ch = outChannels[c];
      for (let i = 0; i < ch.length; i++) {
        const abs = Math.abs(ch[i]);
        if (abs > peak) peak = abs;
      }
    }

    if (peak > 0.001 && peak < 0.99) {
      const gain = 0.98 / peak;
      for (let c = 0; c < numChannels; c++) {
        const ch = outChannels[c];
        for (let i = 0; i < ch.length; i++) {
          ch[i] *= gain;
        }
      }
    }
  }

  return outChannels;
}

/**
 * Computes min and max peaks for visual waveform rendering.
 */
export function computeWaveformPeaks(
  channel: Float32Array,
  targetPoints: number = 800
): { peaksMin: Float32Array; peaksMax: Float32Array; rms: Float32Array } {
  const points = Math.max(100, targetPoints);
  const peaksMin = new Float32Array(points);
  const peaksMax = new Float32Array(points);
  const rms = new Float32Array(points);

  const totalSamples = channel.length;
  if (totalSamples === 0) {
    return { peaksMin, peaksMax, rms };
  }

  const step = totalSamples / points;

  for (let i = 0; i < points; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(totalSamples, Math.floor((i + 1) * step));

    let min = 1.0;
    let max = -1.0;
    let sumSquares = 0;
    let count = 0;

    for (let j = start; j < end; j++) {
      const val = channel[j];
      if (val < min) min = val;
      if (val > max) max = val;
      sumSquares += val * val;
      count++;
    }

    if (count === 0) {
      peaksMin[i] = 0;
      peaksMax[i] = 0;
      rms[i] = 0;
    } else {
      peaksMin[i] = min === 1.0 ? 0 : min;
      peaksMax[i] = max === -1.0 ? 0 : max;
      rms[i] = Math.sqrt(sumSquares / count);
    }
  }

  return { peaksMin, peaksMax, rms };
}



/**
 * Generates an EDL (Edit Decision List) text file for Adobe Premiere, DaVinci Resolve, or Final Cut.
 */
export function generateEdlReport(
  filename: string,
  silences: SilenceRegion[],
  speech: SpeechRegion[]
): string {
  const lines: string[] = [
    `TITLE: ${filename} - Silence Removal Cut List`,
    `FCM: NON-DROP FRAME`,
    ``,
    `# SUMMARY`,
    `# Total Silences Detected (>0.5s): ${silences.length}`,
    `# Total Speech Segments: ${speech.length}`,
    ``,
    `# DETECTED SILENCE GAPS (>0.5s):`,
  ];

  silences.forEach((s, idx) => {
    lines.push(
      `Gap #${idx + 1}: ${s.start.toFixed(3)}s -> ${s.end.toFixed(3)}s (Duration: ${s.duration.toFixed(3)}s, Active: ${s.active ? 'CUT' : 'KEPT'})`
    );
  });

  lines.push(``);
  lines.push(`# SPEECH SEGMENTS PRESERVED:`);
  speech.forEach((sp, idx) => {
    lines.push(
      `Segment #${idx + 1}: ${sp.start.toFixed(3)}s -> ${sp.end.toFixed(3)}s (Duration: ${sp.duration.toFixed(3)}s)`
    );
  });

  return lines.join('\n');
}

/**
 * Creates high-fidelity synthetic AI voiceover sample audio in memory for instant testing
 * without needing an external file upload. Contains 3 speech paragraphs with pauses > 0.5s.
 */
export function generateSyntheticAiVoiceAudio(sampleRate: number = 44100): {
  channels: Float32Array[];
  sampleRate: number;
  description: string;
} {
  // We'll generate an expressive 8.5-second audio track simulating an AI voice model monologue
  // Segment 1: Speech (0.0s - 1.8s)
  // Silence 1: Pause (1.8s - 2.8s) -> 1.0s gap (>0.5s!)
  // Segment 2: Speech (2.8s - 4.5s)
  // Silence 2: Pause (4.5s - 5.7s) -> 1.2s gap (>0.5s!)
  // Segment 3: Speech (5.7s - 7.5s)
  // Silence 3: Trailing pause (7.5s - 8.3s) -> 0.8s gap (>0.5s!)

  const totalDuration = 8.4;
  const totalSamples = Math.floor(totalDuration * sampleRate);

  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);

  // Formant vocal frequencies (f0 ~ 130 Hz male/warm voice, harmonics at 260, 520, 1040, 2200)
  const segments = [
    { start: 0.1, end: 1.8, pitch: 135 },
    { start: 2.8, end: 4.5, pitch: 142 },
    { start: 5.7, end: 7.5, pitch: 130 },
  ];

  for (const seg of segments) {
    const startSample = Math.floor(seg.start * sampleRate);
    const endSample = Math.floor(seg.end * sampleRate);
    const duration = seg.end - seg.start;

    for (let s = startSample; s < endSample; s++) {
      const t = (s - startSample) / sampleRate;
      // Speech amplitude envelope: gentle attack, syllabic modulation at 4Hz, soft release
      const envelope =
        Math.min(1, t / 0.08) *
        Math.min(1, (duration - t) / 0.08) *
        (0.65 + 0.35 * Math.sin(2 * Math.PI * 4.2 * t));

      // Synthesize rich vocal timbre with fundamental and voice formants
      const f0 = seg.pitch + 8 * Math.sin(2 * Math.PI * 1.5 * t);
      const vocal =
        0.45 * Math.sin(2 * Math.PI * f0 * t) +
        0.30 * Math.sin(2 * Math.PI * 2 * f0 * t) +
        0.18 * Math.sin(2 * Math.PI * 3 * f0 * t) +
        0.12 * Math.sin(2 * Math.PI * 5 * f0 * t + 0.5) +
        0.05 * (Math.random() * 2 - 1); // aspiration breathiness

      const sample = vocal * envelope * 0.7;

      // Slight stereo spread
      leftChannel[s] = sample;
      rightChannel[s] = sample * 0.98;
    }
  }

  // Add subtle room tone / noise floor (-65dB) to simulate real microphone capture
  const roomToneFloor = dbToLinear(-68);
  for (let s = 0; s < totalSamples; s++) {
    const noise = (Math.random() * 2 - 1) * roomToneFloor;
    leftChannel[s] += noise;
    rightChannel[s] += noise;
  }

  return {
    channels: [leftChannel, rightChannel],
    sampleRate,
    description: "AI Voiceover Monologue (8.4s with 3 pauses > 0.5s)",
  };
}
