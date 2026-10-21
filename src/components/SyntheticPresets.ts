/**
 * Pre-configured synthetic audio sample generators for testing and instant preview.
 */
import { dbToLinear } from '../utils/audioSilence';

export interface SamplePreset {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  durationEstimate: string;
  generate: (sampleRate?: number) => {
    channels: Float32Array[];
    sampleRate: number;
    filename: string;
  };
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'ai-podcast',
    title: 'AI Podcast Host & Thought Pauses',
    subtitle: 'Simulates an AI podcast speaker with natural 0.8s-1.4s thinking pauses',
    tags: ['Podcast', '3 Long Pauses (>0.5s)', 'Warm Voice'],
    durationEstimate: '9.2s',
    generate: (sampleRate = 44100) => {
      const totalDuration = 9.2;
      const totalSamples = Math.floor(totalDuration * sampleRate);
      const left = new Float32Array(totalSamples);
      const right = new Float32Array(totalSamples);

      // Speech sections:
      // 0.2 - 2.0s: Speech 1
      // 2.0 - 3.2s: Silence (1.2s > 0.5s)
      // 3.2 - 5.0s: Speech 2
      // 5.0 - 5.9s: Silence (0.9s > 0.5s)
      // 5.9 - 7.5s: Speech 3
      // 7.5 - 8.8s: Silence (1.3s > 0.5s)
      // 8.8 - 9.1s: Short Outro
      const speechSegs = [
        { start: 0.2, end: 2.0, basePitch: 120 },
        { start: 3.2, end: 5.0, basePitch: 135 },
        { start: 5.9, end: 7.5, basePitch: 125 },
        { start: 8.8, end: 9.1, basePitch: 115 },
      ];

      for (const seg of speechSegs) {
        const sStart = Math.floor(seg.start * sampleRate);
        const sEnd = Math.floor(seg.end * sampleRate);
        const dur = seg.end - seg.start;

        for (let s = sStart; s < sEnd; s++) {
          const t = (s - sStart) / sampleRate;
          const env =
            Math.min(1, t / 0.05) *
            Math.min(1, (dur - t) / 0.05) *
            (0.7 + 0.3 * Math.sin(2 * Math.PI * 4 * t));

          const f0 = seg.basePitch + 6 * Math.sin(2 * Math.PI * 1.8 * t);
          const vocal =
            0.5 * Math.sin(2 * Math.PI * f0 * t) +
            0.3 * Math.sin(2 * Math.PI * 2 * f0 * t) +
            0.15 * Math.sin(2 * Math.PI * 3 * f0 * t) +
            0.05 * (Math.random() * 2 - 1);

          left[s] = vocal * env * 0.75;
          right[s] = vocal * env * 0.72;
        }
      }

      // Gentle studio noise floor
      const noiseLevel = dbToLinear(-65);
      for (let s = 0; s < totalSamples; s++) {
        const n = (Math.random() * 2 - 1) * noiseLevel;
        left[s] += n;
        right[s] += n;
      }

      return {
        channels: [left, right],
        sampleRate,
        filename: 'AI_Podcast_Monologue.wav',
      };
    },
  },
  {
    id: 'ai-tts-lecture',
    title: 'AI Audio Lecture & Slide Transitions',
    subtitle: 'TTS generated course lecture with long slide transitions (1.1s, 1.5s pauses)',
    tags: ['TTS Course', '2 Big Gaps (>0.5s)', 'Clear Audio'],
    durationEstimate: '8.0s',
    generate: (sampleRate = 44100) => {
      const totalDuration = 8.0;
      const totalSamples = Math.floor(totalDuration * sampleRate);
      const left = new Float32Array(totalSamples);
      const right = new Float32Array(totalSamples);

      // 0.1 - 2.2s: Speech 1
      // 2.2 - 3.7s: Silence (1.5s > 0.5s)
      // 3.7 - 5.8s: Speech 2
      // 5.8 - 6.9s: Silence (1.1s > 0.5s)
      // 6.9 - 7.9s: Speech 3
      const speechSegs = [
        { start: 0.1, end: 2.2, basePitch: 160 },
        { start: 3.7, end: 5.8, basePitch: 165 },
        { start: 6.9, end: 7.9, basePitch: 155 },
      ];

      for (const seg of speechSegs) {
        const sStart = Math.floor(seg.start * sampleRate);
        const sEnd = Math.floor(seg.end * sampleRate);
        const dur = seg.end - seg.start;

        for (let s = sStart; s < sEnd; s++) {
          const t = (s - sStart) / sampleRate;
          const env =
            Math.min(1, t / 0.04) *
            Math.min(1, (dur - t) / 0.04) *
            (0.8 + 0.2 * Math.sin(2 * Math.PI * 5 * t));

          const f0 = seg.basePitch + 5 * Math.sin(2 * Math.PI * 2 * t);
          const vocal =
            0.55 * Math.sin(2 * Math.PI * f0 * t) +
            0.25 * Math.sin(2 * Math.PI * 2 * f0 * t) +
            0.15 * Math.sin(2 * Math.PI * 4 * f0 * t);

          left[s] = vocal * env * 0.7;
          right[s] = vocal * env * 0.7;
        }
      }

      const noiseLevel = dbToLinear(-70);
      for (let s = 0; s < totalSamples; s++) {
        const n = (Math.random() * 2 - 1) * noiseLevel;
        left[s] += n;
        right[s] += n;
      }

      return {
        channels: [left, right],
        sampleRate,
        filename: 'AI_Lecture_Voice.wav',
      };
    },
  },
  {
    id: 'ai-voice-clone',
    title: 'AI Voice Clone Monologue',
    subtitle: 'High-speed synthetic voice with awkward hesitations and trailing dead air',
    tags: ['Voice Clone', 'Multiple Pauses', 'Stereo'],
    durationEstimate: '7.5s',
    generate: (sampleRate = 44100) => {
      const totalDuration = 7.5;
      const totalSamples = Math.floor(totalDuration * sampleRate);
      const left = new Float32Array(totalSamples);
      const right = new Float32Array(totalSamples);

      // Speech: 0.1-1.6s, gap: 1.6-2.5 (0.9s), speech: 2.5-4.2, gap: 4.2-5.0 (0.8s), speech: 5.0-6.4, gap: 6.4-7.4 (1.0s)
      const speechSegs = [
        { start: 0.1, end: 1.6, basePitch: 140 },
        { start: 2.5, end: 4.2, basePitch: 145 },
        { start: 5.0, end: 6.4, basePitch: 138 },
      ];

      for (const seg of speechSegs) {
        const sStart = Math.floor(seg.start * sampleRate);
        const sEnd = Math.floor(seg.end * sampleRate);
        const dur = seg.end - seg.start;

        for (let s = sStart; s < sEnd; s++) {
          const t = (s - sStart) / sampleRate;
          const env =
            Math.min(1, t / 0.03) *
            Math.min(1, (dur - t) / 0.03) *
            (0.7 + 0.3 * Math.cos(2 * Math.PI * 4.5 * t));

          const f0 = seg.basePitch + 10 * Math.sin(2 * Math.PI * 2.2 * t);
          const vocal =
            0.5 * Math.sin(2 * Math.PI * f0 * t) +
            0.3 * Math.sin(2 * Math.PI * 2 * f0 * t) +
            0.15 * Math.sin(2 * Math.PI * 3 * f0 * t);

          left[s] = vocal * env * 0.72;
          right[s] = vocal * env * 0.72;
        }
      }

      const noiseLevel = dbToLinear(-68);
      for (let s = 0; s < totalSamples; s++) {
        const n = (Math.random() * 2 - 1) * noiseLevel;
        left[s] += n;
        right[s] += n;
      }

      return {
        channels: [left, right],
        sampleRate,
        filename: 'AI_VoiceClone_Take1.wav',
      };
    },
  },
];
