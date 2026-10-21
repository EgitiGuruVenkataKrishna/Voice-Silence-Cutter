import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audioBuffersToWavBlob,
  audioBuffersToMp3Blob,
  audioBuffersToFlacBlob,
} from './audioExport';
import { detectSilenceRegions } from './audioSilence';

test('audioBuffersToWavBlob creates lossless WAV in 16-bit, 24-bit, and 32-bit', async () => {
  const sampleRate = 44100;
  const numSamples = 1000;
  const channel = new Float32Array(numSamples);
  channel[0] = 0.5;

  const wav16 = audioBuffersToWavBlob([channel], sampleRate, 16);
  assert.equal(wav16.type, 'audio/wav');
  assert.equal(wav16.size, 44 + numSamples * 2);

  const wav24 = audioBuffersToWavBlob([channel], sampleRate, 24);
  assert.equal(wav24.size, 44 + numSamples * 3);

  const wav32 = audioBuffersToWavBlob([channel], sampleRate, 32);
  assert.equal(wav32.size, 44 + numSamples * 4);
});

test('audioBuffersToFlacBlob produces valid lossless FLAC with fLaC marker and STREAMINFO', async () => {
  const sampleRate = 44100;
  const numSamples = 44100; // 1 second
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    left[i] = 0.4 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    right[i] = 0.4 * Math.sin((2 * Math.PI * 880 * i) / sampleRate);
  }

  const flacBlob = audioBuffersToFlacBlob([left, right], sampleRate);
  assert.equal(flacBlob.type, 'audio/flac');
  assert.ok(flacBlob.size > 1000, `FLAC file should contain frames, got size ${flacBlob.size}`);

  const buffer = await flacBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check 'fLaC' signature
  assert.equal(bytes[0], 0x66);
  assert.equal(bytes[1], 0x4c);
  assert.equal(bytes[2], 0x61);
  assert.equal(bytes[3], 0x43);

  // Check STREAMINFO block header: is_last = 1 (0x80), type = 0
  assert.equal(bytes[4], 0x80);
  assert.equal(bytes[5], 0x00);
  assert.equal(bytes[6], 0x00);
  assert.equal(bytes[7], 34); // 34 bytes metadata
});

test('audioBuffersToMp3Blob produces high-quality MP3 at 320 kbps bitrate', async () => {
  const sampleRate = 44100;
  const numSamples = 44100; // 1 second
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    left[i] = 0.3 * Math.sin((2 * Math.PI * 523 * i) / sampleRate);
    right[i] = 0.3 * Math.sin((2 * Math.PI * 659 * i) / sampleRate);
  }

  const mp3Blob = audioBuffersToMp3Blob([left, right], sampleRate, 320);
  assert.equal(mp3Blob.type, 'audio/mp3');
  // 320 kbps for 1 sec is ~40,000 bytes
  assert.ok(mp3Blob.size >= 35000 && mp3Blob.size <= 45000, `Expected ~40KB for 1s 320kbps MP3, got ${mp3Blob.size}`);

  const buffer = await mp3Blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // First frame sync header 0xFF, 0xFB (MPEG-1 Layer 3, no CRC)
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1] & 0xfe, 0xfa); // 0xFA or 0xFB
});

test('detectSilenceRegions correctly supports thresholds between 0.1s and 5.0s', () => {
  const sampleRate = 8000;
  const channel = new Float32Array(sampleRate * 10); // 10 seconds

  // Fill speech at 0.0 - 1.0s, 1.25s - 2.5s, 6.0s - 8.0s
  function fillTone(s: number, e: number) {
    for (let i = Math.floor(s * sampleRate); i < Math.floor(e * sampleRate); i++) {
      channel[i] = 0.6 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
  }
  fillTone(0.0, 1.0);
  // Gap 1: 1.0s to 1.25s = 0.25s silence
  fillTone(1.25, 2.5);
  // Gap 2: 2.5s to 6.0s = 3.5s silence
  fillTone(6.0, 8.0);
  // Gap 3: 8.0s to 10.0s = 2.0s silence

  // 1. Test short threshold = 0.2s: should detect Gap 1 (0.25s), Gap 2 (3.5s), Gap 3 (2.0s) -> 3 gaps
  const resShort = detectSilenceRegions([channel], sampleRate, {
    thresholdDb: -30,
    minSilenceDuration: 0.2,
    paddingDuration: 0.01,
  });
  assert.equal(resShort.silences.length, 3);

  // 2. Test standard threshold = 0.5s: should ignore Gap 1 (0.25s < 0.5s), detect Gap 2 and Gap 3 -> 2 gaps
  const resDefault = detectSilenceRegions([channel], sampleRate, {
    thresholdDb: -30,
    minSilenceDuration: 0.5,
    paddingDuration: 0.01,
  });
  assert.equal(resDefault.silences.length, 2);

  // 3. Test long threshold = 3.0s: should only detect Gap 2 (3.5s > 3.0s) -> 1 gap
  const resLong = detectSilenceRegions([channel], sampleRate, {
    thresholdDb: -30,
    minSilenceDuration: 3.0,
    paddingDuration: 0.01,
  });
  assert.equal(resLong.silences.length, 1);
  assert.ok(resLong.silences[0].duration >= 3.0);
});
