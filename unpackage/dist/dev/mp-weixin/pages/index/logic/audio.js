"use strict";
const generateToneSamples = (durationMs, sampleRate, toneFreq) => {
  const totalSamples = Math.floor(durationMs / 1e3 * sampleRate);
  const samples = new Array(totalSamples);
  const amplitude = 0.6;
  const omega = 2 * Math.PI * toneFreq / sampleRate;
  for (let i = 0; i < totalSamples; i += 1) {
    samples[i] = Math.sin(omega * i) * amplitude;
  }
  return samples;
};
const buildMarkSamples = (mark, unitMs, sampleRate, toneFreq) => {
  const markUnits = mark === "-" ? 3 : 1;
  const toneMs = unitMs * markUnits;
  return generateToneSamples(toneMs, sampleRate, toneFreq);
};
const encodeWav = (samples, sampleRate) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset2, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset2 + i, text.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
    offset += 2;
  }
  return buffer;
};
exports.buildMarkSamples = buildMarkSamples;
exports.encodeWav = encodeWav;
//# sourceMappingURL=../../../../.sourcemap/mp-weixin/pages/index/logic/audio.js.map
