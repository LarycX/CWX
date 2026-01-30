"use strict";
const MORSE_TABLE = {
  ".-": "A",
  "-...": "B",
  "-.-.": "C",
  "-..": "D",
  ".": "E",
  "..-.": "F",
  "--.": "G",
  "....": "H",
  "..": "I",
  ".---": "J",
  "-.-": "K",
  ".-..": "L",
  "--": "M",
  "-.": "N",
  "---": "O",
  ".--.": "P",
  "--.-": "Q",
  ".-.": "R",
  "...": "S",
  "-": "T",
  "..-": "U",
  "...-": "V",
  ".--": "W",
  "-..-": "X",
  "-.--": "Y",
  "--..": "Z",
  "-----": "0",
  ".----": "1",
  "..---": "2",
  "...--": "3",
  "....-": "4",
  ".....": "5",
  "-....": "6",
  "--...": "7",
  "---..": "8",
  "----.": "9",
  ".-.-.-": ".",
  "--..--": ",",
  "..--..": "?",
  ".----.": "'",
  "-.-.--": "!",
  "-..-.": "/",
  "-.--.": "(",
  "-.--.-": ")",
  ".-...": "&",
  "---...": ":",
  "-.-.-.": ";",
  "-...-": "=",
  ".-.-.": "+",
  "-....-": "-",
  "..--.-": "_",
  ".-..-.": '"',
  "...-..-": "$",
  ".--.-.": "@"
};
const decodeMarks = (marks) => {
  if (!marks.length)
    return "";
  const key = marks.join("");
  return MORSE_TABLE[key] || "?";
};
class CwDecoderEngine {
  constructor() {
    this.reset();
  }
  reset() {
    this.isRecording = false;
    this.lastMarkEndAt = 0;
    this.currentMarks = [];
    this.lastDecodedAt = 0;
    this.nextWordSpacePending = false;
  }
  ensureRecordingSession() {
    if (this.isRecording)
      return;
    this.isRecording = true;
    this.currentMarks = [];
  }
  /**
   * 方案A：recordMark 只记录 tone，不再自动追加 1u gap。
   * gap 只来自：
   *  1) 调度 startAt 与 recordCursorMs 的差（lead silence）
   *  2) 外部显式 extendGap（字符/单词超时）
   */
  recordMark(mark, startAt, unitMs) {
    this.ensureRecordingSession();
    if (this.lastMarkEndAt) {
      const gapMs = Math.max(0, startAt - this.lastMarkEndAt);
      if (gapMs >= unitMs * 10) {
        this.nextWordSpacePending = true;
      }
    }
    const markUnits = mark === "-" ? 3 : 1;
    const toneMs = unitMs * markUnits;
    this.lastMarkEndAt = startAt + toneMs;
    this.currentMarks.push(mark);
  }
  flushChar(withSpace) {
    if (!this.currentMarks.length) {
      return { text: "", withSpace: false };
    }
    const decoded = decodeMarks(this.currentMarks);
    const shouldSpace = withSpace || this.nextWordSpacePending;
    this.currentMarks = [];
    if (decoded) {
      this.lastDecodedAt = Date.now();
      this.nextWordSpacePending = false;
    }
    return { text: decoded, withSpace: shouldSpace };
  }
  /**
   * stop 只做“收尾 flush”，不再依赖 gapExtraUnits。
   * 为了让最后一个字符稳定提交：确保尾部至少有 7u gap（单词结束语义）。
   */
  stopRecordingAndDecode() {
    if (!this.isRecording) {
      return { text: "", withSpace: false };
    }
    this.isRecording = false;
    this.lastMarkEndAt = 0;
    return this.flushChar(true);
  }
}
exports.CwDecoderEngine = CwDecoderEngine;
//# sourceMappingURL=../../../../.sourcemap/mp-weixin/pages/index/logic/cwDecoder.js.map
