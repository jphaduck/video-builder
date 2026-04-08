const BITRATE_TABLE: Record<number, number[]> = {
  0: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};

const SAMPLE_RATE_TABLE: Record<number, number[]> = {
  3: [44100, 48000, 32000, 0],
  2: [22050, 24000, 16000, 0],
  0: [11025, 12000, 8000, 0],
};

function getId3TagSize(buffer: Buffer): number {
  if (buffer.length < 10 || buffer.toString("utf8", 0, 3) !== "ID3") {
    return 0;
  }

  return 10 + ((buffer[6] & 0x7f) << 21) + ((buffer[7] & 0x7f) << 14) + ((buffer[8] & 0x7f) << 7) + (buffer[9] & 0x7f);
}

function getSamplesPerFrame(versionBits: number): number {
  return versionBits === 3 ? 1152 : 576;
}

type Mp3Frame = {
  frameSize: number;
  durationSeconds: number;
};

function parseFrame(buffer: Buffer, offset: number): Mp3Frame | null {
  if (offset + 4 > buffer.length) {
    return null;
  }

  const header = buffer.readUInt32BE(offset);
  if ((header & 0xffe00000) !== 0xffe00000) {
    return null;
  }

  const versionBits = (header >> 19) & 0x3;
  const layerBits = (header >> 17) & 0x3;
  const bitrateIndex = (header >> 12) & 0xf;
  const sampleRateIndex = (header >> 10) & 0x3;
  const paddingBit = (header >> 9) & 0x1;

  if (layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }

  const bitrateTable = BITRATE_TABLE[versionBits === 3 ? 0 : 2];
  const sampleRates = SAMPLE_RATE_TABLE[versionBits];
  if (!bitrateTable || !sampleRates) {
    return null;
  }

  const bitrateKbps = bitrateTable[bitrateIndex];
  const sampleRate = sampleRates[sampleRateIndex];
  if (!bitrateKbps || !sampleRate) {
    return null;
  }

  const samplesPerFrame = getSamplesPerFrame(versionBits);
  const coefficient = versionBits === 3 ? 144 : 72;
  const frameSize = Math.floor((coefficient * bitrateKbps * 1000) / sampleRate) + paddingBit;
  if (frameSize <= 0) {
    return null;
  }

  return {
    frameSize,
    durationSeconds: samplesPerFrame / sampleRate,
  };
}

export function measureMp3DurationSeconds(buffer: Buffer): number {
  let offset = getId3TagSize(buffer);
  let durationSeconds = 0;
  let frameCount = 0;

  while (offset < buffer.length - 4) {
    const frame = parseFrame(buffer, offset);
    if (!frame) {
      offset += 1;
      continue;
    }

    durationSeconds += frame.durationSeconds;
    frameCount += 1;
    offset += frame.frameSize;
  }

  if (frameCount === 0) {
    throw new Error("Unable to measure MP3 duration from the generated audio buffer.");
  }

  return Number(durationSeconds.toFixed(3));
}
