/**
 * High-Quality Audio Exporter supporting WAV (Lossless), FLAC (Lossless), and MP3 (320 kbps CBR).
 */
import { Mp3Encoder } from '@breezystack/lamejs';

export type ExportFormat = 'wav' | 'flac' | 'mp3';

/**
 * Encodes Float32Array audio channels into a broadcast standard WAV Blob
 * Supports 16-bit PCM, 24-bit PCM, or 32-bit Float PCM.
 */
export function audioBuffersToWavBlob(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 24
): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // file size - 8
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  const audioFormat = bitDepth === 32 ? 3 : 1; // 1 = PCM, 3 = IEEE Float
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave audio samples
  let offset = 44;

  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1, Math.min(1, sample));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1, Math.min(1, sample));
        const int24 = sample < 0 ? sample * 0x800000 : sample * 0x7fffff;
        const intVal = Math.floor(int24);
        view.setUint8(offset, intVal & 0xff);
        view.setUint8(offset + 1, (intVal >> 8) & 0xff);
        view.setUint8(offset + 2, (intVal >> 16) & 0xff);
        offset += 3;
      }
    }
  } else {
    // 32-bit float
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c][i], true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Encodes audio channels into an MP3 Blob at high bitrate (default 320 kbps CBR).
 */
export function audioBuffersToMp3Blob(
  channels: Float32Array[],
  sampleRate: number,
  kbps: number = 320
): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  // Convert Float32Array [-1.0, 1.0] to Int16Array
  const leftInt16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channels[0][i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  let rightInt16: Int16Array | undefined = undefined;
  if (numChannels > 1) {
    rightInt16 = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, channels[1][i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  // Encode in 1152 sample frames (standard MP3 granule size)
  const chunkSize = 1152;
  for (let i = 0; i < numSamples; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    const rightChunk = rightInt16 ? rightInt16.subarray(i, i + chunkSize) : undefined;
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const flushBuf = encoder.flush();
  if (flushBuf && flushBuf.length > 0) {
    mp3Data.push(flushBuf);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

// CRC lookup tables for FLAC frames
const CRC8_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let curr = i;
  for (let j = 0; j < 8; j++) {
    if (curr & 0x80) curr = ((curr << 1) ^ 0x07) & 0xff;
    else curr = (curr << 1) & 0xff;
  }
  CRC8_TABLE[i] = curr;
}

function calcFlacCrc8(arr: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < arr.length; i++) {
    crc = CRC8_TABLE[crc ^ arr[i]];
  }
  return crc;
}

const CRC16_TABLE = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let curr = i << 8;
  for (let j = 0; j < 8; j++) {
    if (curr & 0x8000) curr = ((curr << 1) ^ 0x8005) & 0xffff;
    else curr = (curr << 1) & 0xffff;
  }
  CRC16_TABLE[i] = curr;
}

function calcFlacCrc16(arr: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < arr.length; i++) {
    crc = (CRC16_TABLE[((crc >> 8) ^ arr[i]) & 0xff] ^ ((crc << 8) & 0xffff)) & 0xffff;
  }
  return crc;
}

/**
 * Encodes audio channels into a standard lossless FLAC Blob (RFC 9582 compliant).
 * Preserves uncompressed bit-perfect PCM samples inside standard SUBFRAME_VERBATIM FLAC frames.
 */
export function audioBuffersToFlacBlob(
  channels: Float32Array[],
  sampleRate: number
): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bitsPerSample = 16;
  const blockSize = 4096;

  const parts: Uint8Array[] = [];

  // 1. FLAC Stream Marker ("fLaC")
  parts.push(new Uint8Array([0x66, 0x4c, 0x61, 0x43]));

  // 2. STREAMINFO metadata block (last metadata block: 0x80, length 34 = 0x000022)
  const streamInfo = new Uint8Array(4 + 34);
  const sView = new DataView(streamInfo.buffer);
  streamInfo[0] = 0x80; // is_last = 1, type = 0 (STREAMINFO)
  streamInfo[1] = 0x00;
  streamInfo[2] = 0x00;
  streamInfo[3] = 34;

  // min_blocksize (16 bits)
  sView.setUint16(4, Math.min(blockSize, numSamples), false);
  // max_blocksize (16 bits)
  sView.setUint16(6, Math.min(blockSize, numSamples), false);
  // min_framesize (24 bits = 0)
  // max_framesize (24 bits = 0)

  // sample_rate (20 bits) + (channels - 1) (3 bits) + (bps - 1) (5 bits) + total_samples (36 bits)
  streamInfo[14] = (sampleRate >> 12) & 0xff;
  streamInfo[15] = (sampleRate >> 4) & 0xff;
  streamInfo[16] =
    ((sampleRate & 0x0f) << 4) |
    (((numChannels - 1) & 0x07) << 1) |
    (((bitsPerSample - 1) >> 4) & 0x01);
  streamInfo[17] =
    (((bitsPerSample - 1) & 0x0f) << 4) |
    (Math.floor(numSamples / 0x100000000) & 0x0f);
  sView.setUint32(18, numSamples >>> 0, false);
  // md5 signature (16 bytes = 0x00)

  parts.push(streamInfo);

  // 3. Audio Frames
  let sampleOffset = 0;
  let frameNumber = 0;

  while (sampleOffset < numSamples) {
    const curBlockSize = Math.min(blockSize, numSamples - sampleOffset);
    const isVariableBlock = curBlockSize !== blockSize;

    // Frame header construction
    const headerBytes: number[] = [];
    headerBytes.push(0xff); // sync code high 8 bits
    headerBytes.push(0xf8); // sync code low 6 bits (111110) + reserved 0 + blocking 0

    // block size bits (4 bits) + sample rate bits (4 bits)
    const bsBits = isVariableBlock ? 0b0111 : 0b1100;
    const srBits = 0b0000;
    headerBytes.push((bsBits << 4) | srBits);

    // channel assignment (4 bits) + sample size (3 bits) + reserved (1 bit)
    const chBits = numChannels === 2 ? 0b0001 : 0b0000;
    const bdBits = 0b000;
    headerBytes.push((chBits << 4) | (bdBits << 1));

    // frame number (UTF-8 encoding)
    if (frameNumber < 0x80) {
      headerBytes.push(frameNumber);
    } else if (frameNumber < 0x800) {
      headerBytes.push(0xc0 | (frameNumber >> 6));
      headerBytes.push(0x80 | (frameNumber & 0x3f));
    } else {
      headerBytes.push(0xe0 | (frameNumber >> 12));
      headerBytes.push(0x80 | ((frameNumber >> 6) & 0x3f));
      headerBytes.push(0x80 | (frameNumber & 0x3f));
    }

    if (isVariableBlock) {
      headerBytes.push((curBlockSize - 1) >> 8);
      headerBytes.push((curBlockSize - 1) & 0xff);
    }

    // CRC8 of header
    const headerCrc = calcFlacCrc8(Uint8Array.from(headerBytes));
    headerBytes.push(headerCrc);

    // Subframe buffer: header + subframes + CRC16
    const totalFrameBytes =
      headerBytes.length + numChannels * (1 + curBlockSize * 2) + 2;
    const frameBuffer = new Uint8Array(totalFrameBytes);
    const fView = new DataView(frameBuffer.buffer);

    frameBuffer.set(headerBytes, 0);
    let fOffset = headerBytes.length;

    for (let c = 0; c < numChannels; c++) {
      // Subframe header: 1 bit 0, 6 bits 000001 (SUBFRAME_VERBATIM), 1 bit wasted 0 -> 0x02
      frameBuffer[fOffset++] = 0x02;
      const ch = channels[c];
      for (let s = 0; s < curBlockSize; s++) {
        let sample = ch[sampleOffset + s];
        sample = Math.max(-1, Math.min(1, sample));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        fView.setInt16(fOffset, int16, false); // Big endian
        fOffset += 2;
      }
    }

    // CRC16 of entire frame excluding CRC16 field
    const frameData = frameBuffer.subarray(0, fOffset);
    const frameCrc16 = calcFlacCrc16(frameData);
    fView.setUint16(fOffset, frameCrc16, false);

    parts.push(frameBuffer);

    sampleOffset += curBlockSize;
    frameNumber++;
  }

  return new Blob(parts as unknown as BlobPart[], { type: 'audio/flac' });
}
