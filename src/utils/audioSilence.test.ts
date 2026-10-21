import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSilenceRegions,
  recalculateWithToggledSilences,
  renderProcessedAudio,
  audioBuffersToWavBlob,
  generateSyntheticAiVoiceAudio,
  dbToLinear,
  linearToDb,
} from './audioSilence';

test('dbToLinear and linearToDb round-trip conversions', () => {
  const db = -20;
  const linear = dbToLinear(db);
  assert.ok(Math.abs(linear - 0.1) < 0.001);
  const backToDb = linearToDb(linear);
  assert.ok(Math.abs(backToDb - (-20)) < 0.001);

  // Very small linear value shouldn't return NaN or -Infinity
  assert.equal(linearToDb(0), -140);
});

test('detectSilenceRegions correctly detects pauses > 0.5s and ignores < 0.5s', () => {
  const sampleRate = 8000; // Small sample rate for fast testing
  const totalSeconds = 5;
  const channel = new Float32Array(totalSeconds * sampleRate);

  // Generate pattern:
  // 0.0s - 1.0s: Loud tone (speech)
  // 1.0s - 1.8s: Silence (0.8s > 0.5s) -> SHOULD BE DETECTED
  // 1.8s - 2.8s: Loud tone (speech)
  // 2.8s - 3.1s: Silence (0.3s < 0.5s) -> SHOULD BE IGNORED
  // 3.1s - 5.0s: Loud tone (speech)

  function fillSine(startSec: number, endSec: number) {
    const sStart = Math.floor(startSec * sampleRate);
    const sEnd = Math.floor(endSec * sampleRate);
    for (let i = sStart; i < sEnd; i++) {
      channel[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
  }

  fillSine(0.0, 1.0);
  // 1.0 - 1.8 left as 0.0 (silent)
  fillSine(1.8, 2.8);
  // 2.8 - 3.1 left as 0.0 (silent)
  fillSine(3.1, 5.0);

  const result = detectSilenceRegions([channel], sampleRate, {
    thresholdDb: -30,
    minSilenceDuration: 0.5,
    paddingDuration: 0.02,
  });

  // Should detect exactly 1 silence region (the 0.8s gap)
  assert.equal(result.silences.length, 1);
  const detectedSilence = result.silences[0];

  // Boundaries should be around 1.02s to 1.78s due to 0.02s padding
  assert.ok(detectedSilence.start >= 1.0 && detectedSilence.start <= 1.05);
  assert.ok(detectedSilence.end >= 1.75 && detectedSilence.end <= 1.82);
  assert.ok(detectedSilence.duration >= 0.7);

  // Stats should accurately reflect original vs processed duration
  assert.ok(result.stats.totalSilenceRemoved > 0.6);
  assert.ok(result.stats.processedDuration < result.stats.originalDuration);
});

test('recalculateWithToggledSilences allows user to toggle silence removal', () => {
  const sampleRate = 8000;
  const totalSamples = 8000 * 4;

  const mockSilences = [
    {
      id: 'silence-1',
      start: 1.0,
      end: 2.0,
      duration: 1.0,
      sampleStart: 8000,
      sampleEnd: 16000,
      active: true,
      averageDb: -60,
    },
    {
      id: 'silence-2',
      start: 2.5,
      end: 3.5,
      duration: 1.0,
      sampleStart: 20000,
      sampleEnd: 28000,
      active: false, // user disabled removing this
      averageDb: -60,
    },
  ];

  const { speech, stats } = recalculateWithToggledSilences(
    mockSilences,
    totalSamples,
    sampleRate,
    0
  );

  // Only active silences should be cut: total silence removed = 1.0s
  assert.equal(stats.silenceCount, 1);
  assert.equal(stats.totalSilenceRemoved, 1.0);
  assert.equal(stats.processedDuration, 3.0);
  assert.equal(speech.length, 2);
});

test('renderProcessedAudio applies crossfades and cuts silence accurately', () => {
  const sampleRate = 8000;
  const orig = new Float32Array(8000 * 3); // 3 seconds
  for (let i = 0; i < orig.length; i++) {
    orig[i] = 0.5;
  }

  // 2 speech regions: 0.0-1.0s and 2.0-3.0s (1.0s silence removed)
  const speechRegions = [
    { id: '1', start: 0, end: 1, duration: 1, sampleStart: 0, sampleEnd: 8000 },
    { id: '2', start: 2, end: 3, duration: 1, sampleStart: 16000, sampleEnd: 24000 },
  ];

  const processed = renderProcessedAudio([orig], sampleRate, speechRegions, {
    crossfadeMs: 5,
    normalize: false,
  });

  assert.equal(processed.length, 1);
  // Resulting samples should be exactly 8000 + 8000 = 16000 samples (2.0s)
  assert.equal(processed[0].length, 16000);
});

test('audioBuffersToWavBlob creates valid RIFF WAV with standard headers', async () => {
  const sampleRate = 44100;
  const channel = new Float32Array(4410); // 0.1s
  channel[0] = 0.5;

  const wavBlob = audioBuffersToWavBlob([channel], sampleRate, 16);
  assert.equal(wavBlob.type, 'audio/wav');
  assert.ok(wavBlob.size > 44);

  // Read header
  const buffer = await wavBlob.arrayBuffer();
  const view = new DataView(buffer);

  // "RIFF"
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(riff, 'RIFF');

  // "WAVE"
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(wave, 'WAVE');

  // Channels = 1
  assert.equal(view.getUint16(22, true), 1);
  // SampleRate = 44100
  assert.equal(view.getUint32(24, true), 44100);
  // BitsPerSample = 16
  assert.equal(view.getUint16(34, true), 16);
});

test('generateSyntheticAiVoiceAudio creates multi-channel audio with detectable >0.5s silences', () => {
  const sampleRate = 16000;
  const audio = generateSyntheticAiVoiceAudio(sampleRate);

  assert.equal(audio.channels.length, 2);
  assert.ok(audio.channels[0].length > sampleRate * 7);

  const { silences } = detectSilenceRegions(audio.channels, sampleRate, {
    thresholdDb: -40,
    minSilenceDuration: 0.5,
  });

  // Should detect the planned AI pauses
  assert.ok(silences.length >= 2, `Expected at least 2 silences, found ${silences.length}`);
  for (const s of silences) {
    assert.ok(s.duration >= 0.45);
  }
});
