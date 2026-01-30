"use strict";
const common_vendor = require("../../common/vendor.js");
const pages_index_logic_cwDecoder = require("./logic/cwDecoder.js");
const pages_index_logic_spectrum = require("./logic/spectrum.js");
const pages_index_logic_audio = require("./logic/audio.js");
const pages_index_logic_signal = require("./logic/signal.js");
const HeroHeader = () => "./components/HeroHeader.js";
const ControlCard = () => "./components/ControlCard.js";
const DecoderCard = () => "./components/DecoderCard.js";
const SIGNAL_DURATION = 1400;
const TICK_MS = 120;
const WATERFALL_ROW_MS = 160;
const WATERFALL_ROWS = 36;
const BAND_GAP_PX = 160;
const MIN_WPM = 5;
const MAX_WPM = 30;
const SAMPLE_RATE = 8e3;
const _sfc_main = {
  components: {
    HeroHeader,
    ControlCard,
    DecoderCard
  },
  data() {
    return {
      bands: [
        {
          label: "3 MHz",
          min: 3.01,
          max: 3.2
        },
        {
          label: "7 MHz",
          min: 7.01,
          max: 7.2
        },
        {
          label: "10 MHz",
          min: 10.01,
          max: 10.2
        },
        {
          label: "40 MHz",
          min: 40.01,
          max: 40.2
        }
      ],
      currentFrequency: 3.01,
      rulerScrollLeft: 0,
      rulerViewportWidth: 0,
      signals: [],
      waterfallRows: [],
      decoderText: "",
      decoderQueue: [],
      cwDecoder: null,
      recordStopTimer: null,
      decoderQueueTimer: null,
      wpm: 20,
      toneFreq: 700,
      inputQueue: [],
      repeatTimers: {
        ".": null,
        "-": null
      },
      keyDown: {
        ".": false,
        "-": false
      },
      isKeying: false,
      nextAvailableAt: 0,
      lastScheduledEndAt: 0,
      scheduledTimers: [],
      morseWave: null,
      webAudioCtx: null,
      dotBuffer: null,
      dashBuffer: null,
      useWebAudio: false,
      dotAudioCtx: null,
      dashAudioCtx: null,
      audioReady: false,
      dotPath: "",
      dashPath: "",
      keyListenerBound: false,
      intervalId: null,
      noiseId: null,
      waterfallId: null,
      charGapTimer: null
    };
  },
  computed: {
    currentBand() {
      const direct = this.bands.find((band) => this.currentFrequency >= band.min && this.currentFrequency <= band.max);
      if (direct) {
        return direct;
      }
      return this.bands[0];
    },
    bandSegments() {
      return pages_index_logic_spectrum.buildBandSegments(this.bands, this.pxPerMHz, BAND_GAP_PX);
    },
    totalBandWidth() {
      if (this.bandSegments.length === 0) {
        return 0;
      }
      return this.bandSegments[this.bandSegments.length - 1].endX;
    },
    pxPerMHz() {
      return 2e4;
    },
    rulerContentWidth() {
      return Math.round(this.totalBandWidth);
    },
    rulerSpacer() {
      return Math.round(this.rulerViewportWidth / 2);
    },
    rulerContentStyle() {
      return `width:${this.rulerContentWidth + this.rulerSpacer * 2}px;height:200rpx;`;
    },
    signalsInBand() {
      const band = this.currentBand;
      return this.signals.filter((signal) => signal.freq >= band.min && signal.freq <= band.max);
    },
    ticks() {
      return pages_index_logic_spectrum.buildTicks(this.bandSegments, this.rulerSpacer, this.pxPerMHz);
    }
  },
  onLoad() {
    this.cwDecoder = new pages_index_logic_cwDecoder.CwDecoderEngine();
    this.resetFrequency();
    this.intervalId = setInterval(this.tickSignals, TICK_MS);
    this.noiseId = setInterval(this.spawnNoiseSignal, 800);
    this.waterfallId = setInterval(this.addWaterfallRow, WATERFALL_ROW_MS);
    this.decoderQueueTimer = setInterval(this.shiftDecoderQueue, 5e3);
    this.setupAudio();
    this.bindKeyboard();
  },
  onReady() {
    this.measureRuler();
  },
  onUnload() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.noiseId) {
      clearInterval(this.noiseId);
    }
    if (this.waterfallId) {
      clearInterval(this.waterfallId);
    }
    if (this.decoderQueueTimer) {
      clearInterval(this.decoderQueueTimer);
    }
    this.teardownAudio();
    this.unbindKeyboard();
  },
  methods: {
    getUnitMs() {
      return Math.max(40, Math.round(1200 / this.wpm));
    },
    resetFrequency() {
      this.currentFrequency = this.bands[0].min;
      this.decoderText = "";
      this.initDecoderQueue();
      this.rulerScrollLeft = 0;
      this.waterfallRows = [];
      if (this.cwDecoder) {
        this.cwDecoder.reset();
      }
    },
    onRulerScroll(event) {
      const scrollLeft = event.detail.scrollLeft || 0;
      this.rulerScrollLeft = scrollLeft;
      this.updateFrequencyFromScroll(scrollLeft);
    },
    onWaterfallScroll(event) {
      this.onRulerScroll(event);
    },
    measureRuler() {
      const query = common_vendor.index.createSelectorQuery().in(this);
      query.select(".ruler-scroll").boundingClientRect((rect) => {
        if (!rect) {
          return;
        }
        this.rulerViewportWidth = rect.width || 0;
        this.rulerScrollLeft = this.scrollLeftForFrequency(this.currentFrequency);
      }).exec();
    },
    bindKeyboard() {
      if (this.keyListenerBound || typeof document === "undefined") {
        return;
      }
      this.keyListenerBound = true;
      document.addEventListener("keydown", this.onKeydown);
      document.addEventListener("keyup", this.onKeyup);
      window.addEventListener("blur", this.onKeyup);
    },
    unbindKeyboard() {
      if (!this.keyListenerBound || typeof document === "undefined") {
        return;
      }
      document.removeEventListener("keydown", this.onKeydown);
      document.removeEventListener("keyup", this.onKeyup);
      window.removeEventListener("blur", this.onKeyup);
      this.keyListenerBound = false;
    },
    onKeydown(event) {
      if (!event || !event.key) {
        return;
      }
      if (event.key !== "." && event.key !== "-") {
        return;
      }
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      this.startAutoRepeat(event.key);
      event.preventDefault();
    },
    onKeyup(event) {
      if (!event || !event.key) {
        this.stopAllAutoRepeat();
        return;
      }
      if (event.key === "." || event.key === "-") {
        this.stopAutoRepeat(event.key);
        event.preventDefault();
      }
    },
    startAutoRepeat(mark) {
      if (mark !== "." && mark !== "-") {
        return;
      }
      if (this.repeatTimers[mark]) {
        return;
      }
      this.keyDown[mark] = true;
      this.enqueueMark(mark);
      this.scheduleRepeatTick(mark);
    },
    scheduleRepeatTick(mark) {
      if (mark !== "." && mark !== "-") {
        return;
      }
      if (!this.keyDown[mark]) {
        return;
      }
      const now = Date.now();
      const nextAt = Math.max(now, this.nextAvailableAt || 0);
      const delayMs = Math.max(16, nextAt - now);
      const timerId = setTimeout(() => {
        this.repeatTimers[mark] = null;
        if (!this.keyDown[mark]) {
          return;
        }
        this.enqueueMark(mark);
        this.scheduleRepeatTick(mark);
      }, delayMs);
      this.repeatTimers[mark] = timerId;
    },
    stopAutoRepeat(mark) {
      if (mark !== "." && mark !== "-") {
        return;
      }
      this.keyDown[mark] = false;
      const timerId = this.repeatTimers[mark];
      if (timerId) {
        clearTimeout(timerId);
      }
      this.repeatTimers[mark] = null;
      this.rescheduleGapTimers(this.getUnitMs());
    },
    stopAllAutoRepeat() {
      this.stopAutoRepeat(".");
      this.stopAutoRepeat("-");
    },
    enqueueMark(mark) {
      if (this.inputQueue.length < 40) {
        this.inputQueue.push(mark);
      }
      this.processQueue();
    },
    onWpmChange(event) {
      const value = event.detail.value;
      this.wpm = Math.min(MAX_WPM, Math.max(MIN_WPM, Number(value)));
      this.clearScheduledTimers();
      if (!this.useWebAudio) {
        this.morseWave = new common_vendor.MorseCWWave({
          wpm: this.wpm,
          frequency: this.toneFreq,
          sampleRate: SAMPLE_RATE
        });
      }
      this.audioReady = false;
      this.dotPath = "";
      this.dashPath = "";
      if (this.dotAudioCtx) {
        this.dotAudioCtx.stop();
      }
      if (this.dashAudioCtx) {
        this.dashAudioCtx.stop();
      }
      this.prepareToneFiles();
    },
    onToneChange(event) {
      const value = Number(event.detail.value);
      this.toneFreq = Math.max(300, Math.min(1200, value));
      this.clearScheduledTimers();
      if (!this.useWebAudio) {
        this.morseWave = new common_vendor.MorseCWWave({
          wpm: this.wpm,
          frequency: this.toneFreq,
          sampleRate: SAMPLE_RATE
        });
      }
      this.audioReady = false;
      this.dotPath = "";
      this.dashPath = "";
      if (this.dotAudioCtx) {
        this.dotAudioCtx.stop();
      }
      if (this.dashAudioCtx) {
        this.dashAudioCtx.stop();
      }
      this.prepareToneFiles();
    },
    setupAudio() {
      if (this.dotAudioCtx || this.dashAudioCtx || this.webAudioCtx || typeof common_vendor.index === "undefined") {
        return;
      }
      if (typeof common_vendor.wx$1 !== "undefined" && common_vendor.wx$1.createWebAudioContext) {
        this.useWebAudio = true;
        this.webAudioCtx = common_vendor.wx$1.createWebAudioContext();
        this.prepareToneFiles();
        return;
      }
      if (common_vendor.index.createInnerAudioContext) {
        this.morseWave = new common_vendor.MorseCWWave({
          wpm: this.wpm,
          frequency: this.toneFreq,
          sampleRate: SAMPLE_RATE
        });
        this.dotAudioCtx = common_vendor.index.createInnerAudioContext();
        this.dashAudioCtx = common_vendor.index.createInnerAudioContext();
        this.dotAudioCtx.obeyMuteSwitch = false;
        this.dashAudioCtx.obeyMuteSwitch = false;
        const releaseKey = () => {
          this.isKeying = false;
        };
        this.dotAudioCtx.onEnded(releaseKey);
        this.dashAudioCtx.onEnded(releaseKey);
        this.dotAudioCtx.onError(releaseKey);
        this.dashAudioCtx.onError(releaseKey);
        this.prepareToneFiles();
      }
    },
    clearScheduledTimers() {
      this.stopAllAutoRepeat();
      this.keyDown["."] = false;
      this.keyDown["-"] = false;
      if (this.recordStopTimer) {
        clearTimeout(this.recordStopTimer);
        this.recordStopTimer = null;
      }
      if (this.charGapTimer) {
        clearTimeout(this.charGapTimer);
        this.charGapTimer = null;
      }
      for (let i = 0; i < this.scheduledTimers.length; i += 1) {
        clearTimeout(this.scheduledTimers[i]);
      }
      this.scheduledTimers = [];
      this.inputQueue = [];
      this.nextAvailableAt = 0;
      this.lastScheduledEndAt = 0;
      this.isKeying = false;
      if (this.cwDecoder) {
        this.cwDecoder.reset();
      }
      this.initDecoderQueue();
      this.decoderText = "";
    },
    teardownAudio() {
      this.clearScheduledTimers();
      if (this.webAudioCtx) {
        if (this.webAudioCtx.close) {
          this.webAudioCtx.close();
        }
        this.webAudioCtx = null;
      }
      this.dotBuffer = null;
      this.dashBuffer = null;
      this.useWebAudio = false;
      if (this.dotAudioCtx) {
        this.dotAudioCtx.stop();
        this.dotAudioCtx.destroy();
        this.dotAudioCtx = null;
      }
      if (this.dashAudioCtx) {
        this.dashAudioCtx.stop();
        this.dashAudioCtx.destroy();
        this.dashAudioCtx = null;
      }
      this.morseWave = null;
      this.audioReady = false;
      this.dotPath = "";
      this.dashPath = "";
    },
    prepareToneFiles() {
      if (this.useWebAudio && this.webAudioCtx) {
        const unitMs2 = this.getUnitMs();
        const dotSamples2 = pages_index_logic_audio.buildMarkSamples(".", unitMs2, SAMPLE_RATE, this.toneFreq);
        const dashSamples2 = pages_index_logic_audio.buildMarkSamples("-", unitMs2, SAMPLE_RATE, this.toneFreq);
        const dotBuffer = this.webAudioCtx.createBuffer(1, dotSamples2.length, SAMPLE_RATE);
        const dashBuffer = this.webAudioCtx.createBuffer(1, dashSamples2.length, SAMPLE_RATE);
        dotBuffer.getChannelData(0).set(new Float32Array(dotSamples2));
        dashBuffer.getChannelData(0).set(new Float32Array(dashSamples2));
        this.dotBuffer = dotBuffer;
        this.dashBuffer = dashBuffer;
        this.audioReady = true;
        return;
      }
      if (typeof common_vendor.wx$1 === "undefined" || !common_vendor.wx$1.getFileSystemManager || !common_vendor.wx$1.env || !common_vendor.wx$1.env.USER_DATA_PATH) {
        this.audioReady = false;
        return;
      }
      const fs = common_vendor.wx$1.getFileSystemManager();
      const unitMs = this.getUnitMs();
      const dotSamples = pages_index_logic_audio.buildMarkSamples(".", unitMs, SAMPLE_RATE, this.toneFreq);
      const dashSamples = pages_index_logic_audio.buildMarkSamples("-", unitMs, SAMPLE_RATE, this.toneFreq);
      const dotPath = `${common_vendor.wx$1.env.USER_DATA_PATH}/cw_dot_${this.wpm}_${this.toneFreq}.wav`;
      const dashPath = `${common_vendor.wx$1.env.USER_DATA_PATH}/cw_dash_${this.wpm}_${this.toneFreq}.wav`;
      const writeWav = (path, samples, done) => {
        fs.writeFile({
          filePath: path,
          data: pages_index_logic_audio.encodeWav(samples, SAMPLE_RATE),
          success: () => done(true),
          fail: () => done(false)
        });
      };
      let successCount = 0;
      const total = 2;
      const markReady = () => {
        if (successCount === total) {
          this.dotPath = dotPath;
          this.dashPath = dashPath;
          if (this.dotAudioCtx) {
            this.dotAudioCtx.src = dotPath;
          }
          if (this.dashAudioCtx) {
            this.dashAudioCtx.src = dashPath;
          }
          this.audioReady = true;
        }
      };
      writeWav(dotPath, dotSamples, (ok) => {
        if (ok) {
          successCount += 1;
        }
        markReady();
      });
      writeWav(dashPath, dashSamples, (ok) => {
        if (ok) {
          successCount += 1;
        }
        markReady();
      });
    },
    processQueue() {
      if (this.inputQueue.length === 0) {
        return;
      }
      while (this.inputQueue.length > 0) {
        const mark = this.inputQueue.shift();
        this.scheduleMark(mark);
      }
    },
    scheduleMark(mark) {
      const unitMs = this.getUnitMs();
      const now = Date.now();
      let startAt = Math.max(now, this.nextAvailableAt || 0);
      if (this.lastScheduledEndAt && !this.keyDown["."] && !this.keyDown["-"]) {
        const idleGapMs = startAt - this.lastScheduledEndAt;
        if (idleGapMs >= unitMs * 10) {
          this.stopRecordingAndDecode(unitMs);
          startAt = now;
        }
      }
      const markUnits = mark === "-" ? 3 : 1;
      const toneMs = unitMs * markUnits;
      const gapMs = unitMs;
      const durationMs = toneMs + gapMs;
      const endAt = startAt + durationMs;
      this.nextAvailableAt = endAt;
      this.lastScheduledEndAt = endAt;
      this.sendCW(mark);
      if (this.cwDecoder) {
        this.cwDecoder.recordMark(mark, startAt, unitMs);
      }
      const startDelay = Math.max(0, startAt - now);
      const startTimer = setTimeout(() => {
        this.playMarkNow(mark, unitMs, durationMs);
      }, startDelay);
      this.scheduledTimers.push(startTimer);
      this.rescheduleGapTimers(unitMs);
    },
    rescheduleGapTimers(unitMs) {
      if (!this.lastScheduledEndAt) {
        return;
      }
      if (this.recordStopTimer) {
        clearTimeout(this.recordStopTimer);
        this.recordStopTimer = null;
      }
      if (this.charGapTimer) {
        clearTimeout(this.charGapTimer);
        this.charGapTimer = null;
      }
      if (this.keyDown["."] || this.keyDown["-"] || !this.cwDecoder || !this.cwDecoder.isRecording) {
        return;
      }
      const scheduledEndAt = this.lastScheduledEndAt;
      const now = Date.now();
      const charGapAt = scheduledEndAt + unitMs * 2;
      const charDelay = Math.max(0, charGapAt - now);
      this.charGapTimer = setTimeout(() => {
        if (this.lastScheduledEndAt !== scheduledEndAt) {
          return;
        }
        if (this.keyDown["."] || this.keyDown["-"]) {
          return;
        }
        this.applyDecodedResult(this.cwDecoder.flushChar(false));
      }, charDelay);
      const stopAt = scheduledEndAt + unitMs * 9;
      const stopDelay = Math.max(0, stopAt - now);
      this.recordStopTimer = setTimeout(() => {
        if (this.lastScheduledEndAt !== scheduledEndAt) {
          return;
        }
        if (this.keyDown["."] || this.keyDown["-"]) {
          return;
        }
        this.stopRecordingAndDecode(unitMs);
      }, stopDelay);
    },
    playMarkNow(mark, unitMs, durationMs) {
      this.isKeying = true;
      const releaseTimer = setTimeout(() => {
        this.isKeying = false;
      }, durationMs);
      this.scheduledTimers.push(releaseTimer);
      if (this.useWebAudio && this.webAudioCtx && this.audioReady) {
        const buffer = mark === "-" ? this.dashBuffer : this.dotBuffer;
        if (!buffer) {
          return;
        }
        const source = this.webAudioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.webAudioCtx.destination);
        if (this.webAudioCtx.resume) {
          this.webAudioCtx.resume();
        }
        source.start(0);
        return;
      }
      if (!this.audioReady || !this.dotAudioCtx || !this.dashAudioCtx) {
        return;
      }
      const audioCtx = mark === "-" ? this.dashAudioCtx : this.dotAudioCtx;
      audioCtx.stop();
      audioCtx.seek(0);
      audioCtx.play();
    },
    appendDecodedText(decodedText, withSpace) {
      const text = (decodedText || "").trim();
      if (!text) {
        return;
      }
      const payload = `${withSpace ? " " : ""}${text}`;
      for (let i = 0; i < payload.length; i += 1) {
        for (let j = 0; j < this.decoderQueue.length - 1; j += 1) {
          this.decoderQueue[j] = this.decoderQueue[j + 1];
        }
        this.decoderQueue[this.decoderQueue.length - 1] = payload[i];
      }
      this.decoderText = this.decoderQueue.join("");
    },
    initDecoderQueue() {
      this.decoderQueue = new Array(20).fill(" ");
    },
    shiftDecoderQueue() {
      if (!this.decoderQueue.length) {
        return;
      }
      for (let i = 0; i < this.decoderQueue.length - 1; i += 1) {
        this.decoderQueue[i] = this.decoderQueue[i + 1];
      }
      this.decoderQueue[this.decoderQueue.length - 1] = " ";
      this.decoderText = this.decoderQueue.join("");
    },
    applyDecodedResult(result) {
      if (!result || !result.text) {
        return;
      }
      this.appendDecodedText(result.text, result.withSpace);
    },
    stopRecordingAndDecode(unitMs) {
      if (!this.cwDecoder) {
        return;
      }
      this.applyDecodedResult(this.cwDecoder.stopRecordingAndDecode());
    },
    updateFrequencyFromScroll(scrollLeft) {
      this.currentFrequency = pages_index_logic_spectrum.computeFrequencyFromScroll({
        scrollLeft,
        rulerViewportWidth: this.rulerViewportWidth,
        rulerSpacer: this.rulerSpacer,
        totalBandWidth: this.totalBandWidth,
        bandSegments: this.bandSegments,
        pxPerMHz: this.pxPerMHz
      });
    },
    scrollLeftForFrequency(freq) {
      return pages_index_logic_spectrum.scrollLeftForFrequency({
        freq,
        bandSegments: this.bandSegments,
        rulerSpacer: this.rulerSpacer,
        rulerViewportWidth: this.rulerViewportWidth,
        pxPerMHz: this.pxPerMHz
      });
    },
    addWaterfallRow() {
      const now = Date.now();
      const points = this.signals.map((signal) => ({
        id: `wf-${now}-${signal.id}`,
        freq: signal.freq,
        strength: signal.strength,
        source: signal.source
      }));
      const noiseCount = Math.floor(Math.random() * 3);
      for (let i = 0; i < noiseCount; i += 1) {
        points.push({
          id: `wf-noise-${now}-${i}`,
          freq: pages_index_logic_signal.randomBandFrequency(this.bands),
          strength: 0.2 + Math.random() * 0.4,
          source: "others"
        });
      }
      this.waterfallRows.unshift({
        id: `row-${now}-${Math.random().toString(16).slice(2)}`,
        points
      });
      this.waterfallRows = this.waterfallRows.slice(0, WATERFALL_ROWS);
    },
    sendCW(mark) {
      const signal = pages_index_logic_signal.createSignal({
        idPrefix: "me",
        freq: this.currentFrequency,
        strengthMin: 0.7,
        strengthMax: 1,
        durationMs: SIGNAL_DURATION,
        source: "me"
      });
      this.signals.push(signal);
    },
    spawnNoiseSignal() {
      const now = Date.now();
      const signal = pages_index_logic_signal.createSignal({
        idPrefix: "noise",
        freq: pages_index_logic_signal.randomBandFrequency(this.bands),
        strengthMin: 0.4,
        strengthMax: 0.9,
        durationMs: SIGNAL_DURATION,
        source: "others",
        now
      });
      this.signals.push(signal);
    },
    tickSignals() {
      const now = Date.now();
      this.signals = this.signals.filter((signal) => signal.expiresAt > now);
    },
    tickStyle(tick) {
      return `left:${tick.x}px;`;
    },
    rulerSignalStyle(signal) {
      const band = this.bandSegments.find((segment2) => signal.freq >= segment2.min && signal.freq <= segment2.max);
      const segment = band || this.bandSegments[0];
      const left = this.rulerSpacer + segment.startX + (signal.freq - segment.min) * this.pxPerMHz;
      const height = 24 + signal.strength * 70;
      return `left:${left}px;height:${height}px;`;
    },
    waterfallRowStyle(index) {
      const top = index * 6;
      return `top:${top}rpx;`;
    },
    waterfallPointStyle(point) {
      const band = this.bandSegments.find((segment2) => point.freq >= segment2.min && point.freq <= segment2.max);
      const segment = band || this.bandSegments[0];
      const left = this.rulerSpacer + segment.startX + (point.freq - segment.min) * this.pxPerMHz;
      const opacity = 0.25 + point.strength * 0.6;
      return `left:${left}px;opacity:${opacity};`;
    }
  }
};
if (!Array) {
  const _component_hero_header = common_vendor.resolveComponent("hero-header");
  const _component_control_card = common_vendor.resolveComponent("control-card");
  const _component_decoder_card = common_vendor.resolveComponent("decoder-card");
  (_component_hero_header + _component_control_card + _component_decoder_card)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o($options.startAutoRepeat),
    b: common_vendor.o($options.stopAutoRepeat),
    c: common_vendor.o($options.enqueueMark),
    d: common_vendor.o($options.onWpmChange),
    e: common_vendor.o($options.onToneChange),
    f: common_vendor.p({
      ["decoder-text"]: $data.decoderText,
      wpm: $data.wpm,
      ["tone-freq"]: $data.toneFreq
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
