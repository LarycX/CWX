<template>
	<view class="page">
		<view class="content">
		<hero-header />

		<!-- spectrum-card removed temporarily -->

		<decoder-card
			:decoder-text="decoderText"
			:wpm="wpm"
			:tone-freq="toneFreq"
			@wpm-change="onWpmChange"
			@tone-change="onToneChange"
		/>

		</view>
		<control-card
			class="control-bottom"
			:key-mode="keyMode"
			@mode-change="onKeyModeChange"
			@start="startAutoRepeat"
			@stop="stopAutoRepeat"
			@mark="enqueueMark"
			@manual-start="onManualStart"
			@manual-end="onManualEnd"
		/>

	</view>
</template>

<script>
	import HeroHeader from './components/HeroHeader.vue'
	import ControlCard from './components/ControlCard.vue'
	import DecoderCard from './components/DecoderCard.vue'
	import CwDecoderEngine from './logic/cwDecoder'
	import {
		buildBandSegments,
		buildTicks,
		computeFrequencyFromScroll as calcFrequencyFromScroll,
		scrollLeftForFrequency as calcScrollLeftForFrequency
	} from './logic/spectrum'
	import { buildMarkSamples, encodeWav } from './logic/audio'
	import { createSignal, randomBandFrequency } from './logic/signal'
	import MorseCWWave from 'morse-pro/lib/morse-pro-cw-wave'

	const SIGNAL_DURATION = 1400
	const TICK_MS = 120
	const WATERFALL_ROW_MS = 160
	const WATERFALL_ROWS = 36
	const BAND_GAP_PX = 160
	const MIN_WPM = 5
	const MAX_WPM = 30
	const SAMPLE_RATE = 8000

	export default {
		components: {
			HeroHeader,
			ControlCard,
			DecoderCard
		},
		data() {
			return {
				bands: [{
						label: '3 MHz',
						min: 3.01,
						max: 3.2
					},
					{
						label: '7 MHz',
						min: 7.01,
						max: 7.2
					},
					{
						label: '10 MHz',
						min: 10.01,
						max: 10.2
					},
					{
						label: '40 MHz',
						min: 40.01,
						max: 40.2
					}
				],
				currentFrequency: 3.01,
				rulerScrollLeft: 0,
				rulerViewportWidth: 0,
				signals: [],
				waterfallRows: [],
				decoderText: '',
				decoderQueue: [],
				cwDecoder: null,
				recordStopTimer: null,
				decoderQueueTimer: null,
				keyMode: 'auto',
				manualDownAt: 0,
				wpm: 20,
				toneFreq: 700,
				inputQueue: [],
				repeatTimers: {
					'.': null,
					'-': null
				},
				keyDown: {
					'.': false,
					'-': false
				},
				isKeying: false,
				nextAvailableAt: 0,
				lastScheduledEndAt: 0,
				lastInputEndAt: 0,
				scheduledTimers: [],
				morseWave: null,
				webAudioCtx: null,
				dotBuffer: null,
				dashBuffer: null,
				useWebAudio: false,
				manualOsc: null,
				manualGain: null,
				manualLooping: false,
				dotAudioCtx: null,
				dashAudioCtx: null,
				audioReady: false,
				dotPath: '',
				dashPath: '',
				keyListenerBound: false,
				intervalId: null,
				noiseId: null,
				waterfallId: null,
				charGapTimer: null
			}
		},
		computed: {
			currentBand() {
				const direct = this.bands.find((band) => this.currentFrequency >= band.min && this.currentFrequency <= band
					.max)
				if (direct) {
					return direct
				}
				return this.bands[0]
			},
			bandSegments() {
				return buildBandSegments(this.bands, this.pxPerMHz, BAND_GAP_PX)
			},
			totalBandWidth() {
				if (this.bandSegments.length === 0) {
					return 0
				}
				return this.bandSegments[this.bandSegments.length - 1].endX
			},
			pxPerMHz() {
				return 20000
			},
			rulerContentWidth() {
				return Math.round(this.totalBandWidth)
			},
			rulerSpacer() {
				return Math.round(this.rulerViewportWidth / 2)
			},
			rulerContentStyle() {
				return `width:${this.rulerContentWidth + this.rulerSpacer * 2}px;height:200rpx;`
			},
			signalsInBand() {
				const band = this.currentBand
				return this.signals.filter((signal) => signal.freq >= band.min && signal.freq <= band.max)
			},
			ticks() {
				return buildTicks(this.bandSegments, this.rulerSpacer, this.pxPerMHz)
			}
		},
		onLoad() {
			this.cwDecoder = new CwDecoderEngine()
			this.cwDecoder.setMessageCallback((data) => {
				if (!data || typeof data.message !== 'string') {
					return
				}
				this.pushDecoderText(data.message)
			})
			this.resetFrequency()
			this.intervalId = setInterval(this.tickSignals, TICK_MS)
			this.noiseId = setInterval(this.spawnNoiseSignal, 800)
			this.waterfallId = setInterval(this.addWaterfallRow, WATERFALL_ROW_MS)
			this.decoderQueueTimer = setInterval(this.shiftDecoderQueue, 5000)
			this.setupAudio()
			this.bindKeyboard()
		},
		onReady() {
			this.measureRuler()
		},
		onUnload() {
			if (this.intervalId) {
				clearInterval(this.intervalId)
			}
			if (this.noiseId) {
				clearInterval(this.noiseId)
			}
			if (this.waterfallId) {
				clearInterval(this.waterfallId)
			}
			if (this.decoderQueueTimer) {
				clearInterval(this.decoderQueueTimer)
			}
			this.teardownAudio()
			this.unbindKeyboard()
		},
		methods: {
			getUnitMs() {
				return Math.max(40, Math.round(1200 / this.wpm))
			},
			resetFrequency() {
				this.currentFrequency = this.bands[0].min
				this.decoderText = ''
				this.initDecoderQueue()
				this.rulerScrollLeft = 0
				this.waterfallRows = []
				if (this.cwDecoder) {
					this.cwDecoder.reset()
				}
			},
			onRulerScroll(event) {
				const scrollLeft = event.detail.scrollLeft || 0
				this.rulerScrollLeft = scrollLeft
				this.updateFrequencyFromScroll(scrollLeft)
			},
			onWaterfallScroll(event) {
				this.onRulerScroll(event)
			},
			measureRuler() {
				const query = uni.createSelectorQuery().in(this)
				query.select('.ruler-scroll').boundingClientRect((rect) => {
					if (!rect) {
						return
					}
					this.rulerViewportWidth = rect.width || 0
					this.rulerScrollLeft = this.scrollLeftForFrequency(this.currentFrequency)
				}).exec()
			},
			bindKeyboard() {
				if (this.keyListenerBound || typeof document === 'undefined') {
					return
				}
				this.keyListenerBound = true
				document.addEventListener('keydown', this.onKeydown)
				document.addEventListener('keyup', this.onKeyup)
				window.addEventListener('blur', this.onKeyup)
			},
			unbindKeyboard() {
				if (!this.keyListenerBound || typeof document === 'undefined') {
					return
				}
				document.removeEventListener('keydown', this.onKeydown)
				document.removeEventListener('keyup', this.onKeyup)
				window.removeEventListener('blur', this.onKeyup)
				this.keyListenerBound = false
			},
			onKeydown(event) {
				if (!event || !event.key) {
					return
				}
				if (event.key !== '.' && event.key !== '-') {
					return
				}
				if (event.repeat) {
					event.preventDefault()
					return
				}
				this.startAutoRepeat(event.key)
				event.preventDefault()
			},
			onKeyup(event) {
				if (!event || !event.key) {
					this.stopAllAutoRepeat()
					return
				}
				if (event.key === '.' || event.key === '-') {
					this.stopAutoRepeat(event.key)
					event.preventDefault()
				}
			},
			startAutoRepeat(mark) {
				if (mark !== '.' && mark !== '-') {
					return
				}
				if (this.keyMode !== 'auto') {
					return
				}
				if (this.repeatTimers[mark]) {
					return
				}
				this.keyDown[mark] = true
				// Fire immediately, then schedule subsequent repeats off the timeline tail.
				this.handleMarkInput(mark, Date.now(), true)
				this.scheduleRepeatTick(mark)
			},
			scheduleRepeatTick(mark) {
				if (mark !== '.' && mark !== '-') {
					return
				}
				if (!this.keyDown[mark]) {
					return
				}
				const now = Date.now()
				// Align the next enqueue with the scheduler's timeline tail.
				const nextAt = Math.max(now, this.nextAvailableAt || 0)
				const delayMs = Math.max(16, nextAt - now)
				const timerId = setTimeout(() => {
					this.repeatTimers[mark] = null
					if (!this.keyDown[mark]) {
						return
					}
					this.handleMarkInput(mark, Date.now(), true)
					this.scheduleRepeatTick(mark)
				}, delayMs)
				this.repeatTimers[mark] = timerId
			},
			stopAutoRepeat(mark) {
				if (mark !== '.' && mark !== '-') {
					return
				}
				if (this.keyMode !== 'auto') {
					return
				}
				this.keyDown[mark] = false
				const timerId = this.repeatTimers[mark]
				if (timerId) {
					clearTimeout(timerId)
				}
				this.repeatTimers[mark] = null
				// When the user releases the key, re-arm gap timers based on the
				// current schedule tail.
				this.rescheduleGapTimers(this.getUnitMs())
			},
			stopAllAutoRepeat() {
				this.stopAutoRepeat('.')
				this.stopAutoRepeat('-')
			},
			onKeyModeChange(mode) {
				this.keyMode = mode === 'manual' ? 'manual' : 'auto'
				this.stopAllAutoRepeat()
				this.manualDownAt = 0
				this.stopManualTone()
			},
			onManualStart() {
				if (this.keyMode !== 'manual') {
					return
				}
				this.manualDownAt = Date.now()
				this.startManualTone()
			},
			onManualEnd() {
				if (this.keyMode !== 'manual') {
					return
				}
				if (!this.manualDownAt) {
					return
				}
				const duration = Date.now() - this.manualDownAt
				const startAt = this.manualDownAt
				this.manualDownAt = 0
				this.stopManualTone()
				const fallbackUnit = this.getUnitMs()
				const unitMs = this.cwDecoder ? this.cwDecoder.getUnitEstimateMs(fallbackUnit) : fallbackUnit
				const dotDelta = Math.abs(duration - unitMs)
				const dashDelta = Math.abs(duration - unitMs * 3)
				const mark = dashDelta < dotDelta ? '-' : '.'
				if (this.cwDecoder) {
					this.cwDecoder.updateUnitEstimateFromTone(duration, fallbackUnit)
				}
				this.handleMarkInput(mark, startAt, false)
			},
			startManualTone() {
				this.isKeying = true
				if (this.useWebAudio && this.webAudioCtx) {
					const osc = this.webAudioCtx.createOscillator()
					const gain = this.webAudioCtx.createGain()
					osc.type = 'sine'
					osc.frequency.value = this.toneFreq
					gain.gain.value = 0.6
					osc.connect(gain)
					gain.connect(this.webAudioCtx.destination)
					if (this.webAudioCtx.resume) {
						this.webAudioCtx.resume()
					}
					osc.start(0)
					this.manualOsc = osc
					this.manualGain = gain
					return
				}
				if (this.dotAudioCtx) {
					this.manualLooping = true
					this.dotAudioCtx.loop = true
					this.dotAudioCtx.stop()
					this.dotAudioCtx.seek(0)
					this.dotAudioCtx.play()
				}
			},
			stopManualTone() {
				if (this.manualOsc) {
					try {
						this.manualOsc.stop()
					} catch (e) {
						// ignore
					}
					this.manualOsc.disconnect()
					if (this.manualGain) {
						this.manualGain.disconnect()
					}
					this.manualOsc = null
					this.manualGain = null
				}
				if (this.dotAudioCtx && this.manualLooping) {
					this.dotAudioCtx.loop = false
					this.dotAudioCtx.stop()
					this.manualLooping = false
				}
				this.isKeying = false
			},
			handleMarkInput(mark, startAt, playAudio) {
				const unitMs = this.getUnitMs()
				if (this.cwDecoder) {
					const flushed = this.cwDecoder.recordMark(mark, startAt, unitMs, this.wpm)
					this.applyDecodedResult(flushed)
				}
				const markUnits = mark === '-' ? 3 : 1
				const durationMs = unitMs * (markUnits + 1)
				this.lastInputEndAt = startAt + durationMs
				this.rescheduleGapTimers(unitMs)
				if (playAudio) {
					this.enqueueMark(mark, { playAudio })
				}
			},
			enqueueMark(mark, options = {}) {
				if (this.inputQueue.length < 40) {
					this.inputQueue.push({
						mark,
						playAudio: options.playAudio !== false
					})
				}
				this.processQueue()
			},
			onWpmChange(event) {
				const value = event.detail.value
				this.wpm = Math.min(MAX_WPM, Math.max(MIN_WPM, Number(value)))
				this.clearScheduledTimers()
				if (!this.useWebAudio) {
					this.morseWave = new MorseCWWave({
						wpm: this.wpm,
						frequency: this.toneFreq,
						sampleRate: SAMPLE_RATE
					})
				}
				// Rebuild tone files so duration matches the new WPM.
				this.audioReady = false
				this.dotPath = ''
				this.dashPath = ''
				if (this.dotAudioCtx) {
					this.dotAudioCtx.stop()
				}
				if (this.dashAudioCtx) {
					this.dashAudioCtx.stop()
				}
				this.prepareToneFiles()
			},
			onToneChange(event) {
				const value = Number(event.detail.value)
				this.toneFreq = Math.max(300, Math.min(1200, value))
				this.clearScheduledTimers()
				if (!this.useWebAudio) {
					this.morseWave = new MorseCWWave({
						wpm: this.wpm,
						frequency: this.toneFreq,
						sampleRate: SAMPLE_RATE
					})
				}
				// Rebuild tone files so pitch matches the new tone frequency.
				this.audioReady = false
				this.dotPath = ''
				this.dashPath = ''
				if (this.dotAudioCtx) {
					this.dotAudioCtx.stop()
				}
				if (this.dashAudioCtx) {
					this.dashAudioCtx.stop()
				}
				this.prepareToneFiles()
			},
			setupAudio() {
				if (this.dotAudioCtx || this.dashAudioCtx || this.webAudioCtx || typeof uni === 'undefined') {
					return
				}
				if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
					this.useWebAudio = true
					this.webAudioCtx = wx.createWebAudioContext()
					this.prepareToneFiles()
					return
				}
				if (uni.createInnerAudioContext) {
					this.morseWave = new MorseCWWave({
						wpm: this.wpm,
						frequency: this.toneFreq,
						sampleRate: SAMPLE_RATE
					})
					this.dotAudioCtx = uni.createInnerAudioContext()
					this.dashAudioCtx = uni.createInnerAudioContext()
					this.dotAudioCtx.obeyMuteSwitch = false
					this.dashAudioCtx.obeyMuteSwitch = false
					const releaseKey = () => {
						this.isKeying = false
					}
					this.dotAudioCtx.onEnded(releaseKey)
					this.dashAudioCtx.onEnded(releaseKey)
					this.dotAudioCtx.onError(releaseKey)
					this.dashAudioCtx.onError(releaseKey)
					this.prepareToneFiles()
				}
			},
			clearScheduledTimers() {
				this.stopAllAutoRepeat()
				this.keyDown['.'] = false
				this.keyDown['-'] = false
				this.stopManualTone()
				if (this.recordStopTimer) {
					clearTimeout(this.recordStopTimer)
					this.recordStopTimer = null
				}
				if (this.charGapTimer) {
					clearTimeout(this.charGapTimer)
					this.charGapTimer = null
				}
				for (let i = 0; i < this.scheduledTimers.length; i += 1) {
					clearTimeout(this.scheduledTimers[i])
				}
				this.scheduledTimers = []
				this.inputQueue = []
				this.nextAvailableAt = 0
				this.lastScheduledEndAt = 0
				this.lastInputEndAt = 0
				this.isKeying = false
				if (this.cwDecoder) {
					this.cwDecoder.reset()
				}
				this.initDecoderQueue()
				this.decoderText = ''
			},
			teardownAudio() {
				this.clearScheduledTimers()
				this.stopManualTone()
				if (this.webAudioCtx) {
					if (this.webAudioCtx.close) {
						this.webAudioCtx.close()
					}
					this.webAudioCtx = null
				}
				this.dotBuffer = null
				this.dashBuffer = null
				this.useWebAudio = false
				if (this.dotAudioCtx) {
					this.dotAudioCtx.stop()
					this.dotAudioCtx.destroy()
					this.dotAudioCtx = null
				}
				if (this.dashAudioCtx) {
					this.dashAudioCtx.stop()
					this.dashAudioCtx.destroy()
					this.dashAudioCtx = null
				}
				this.morseWave = null
				this.audioReady = false
				this.dotPath = ''
				this.dashPath = ''
			},
			prepareToneFiles() {
				if (this.useWebAudio && this.webAudioCtx) {
					const unitMs = this.getUnitMs()
					const dotSamples = buildMarkSamples('.', unitMs, SAMPLE_RATE, this.toneFreq)
					const dashSamples = buildMarkSamples('-', unitMs, SAMPLE_RATE, this.toneFreq)
					const dotBuffer = this.webAudioCtx.createBuffer(1, dotSamples.length, SAMPLE_RATE)
					const dashBuffer = this.webAudioCtx.createBuffer(1, dashSamples.length, SAMPLE_RATE)
					dotBuffer.getChannelData(0).set(new Float32Array(dotSamples))
					dashBuffer.getChannelData(0).set(new Float32Array(dashSamples))
					this.dotBuffer = dotBuffer
					this.dashBuffer = dashBuffer
					this.audioReady = true
					return
				}
				if (typeof wx === 'undefined' || !wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
					this.audioReady = false
					return
				}
				const fs = wx.getFileSystemManager()
				const unitMs = this.getUnitMs()
				const dotSamples = buildMarkSamples('.', unitMs, SAMPLE_RATE, this.toneFreq)
				const dashSamples = buildMarkSamples('-', unitMs, SAMPLE_RATE, this.toneFreq)
				const dotPath = `${wx.env.USER_DATA_PATH}/cw_dot_${this.wpm}_${this.toneFreq}.wav`
				const dashPath = `${wx.env.USER_DATA_PATH}/cw_dash_${this.wpm}_${this.toneFreq}.wav`
				const writeWav = (path, samples, done) => {
					fs.writeFile({
						filePath: path,
						data: encodeWav(samples, SAMPLE_RATE),
						success: () => done(true),
						fail: () => done(false)
					})
				}
				let successCount = 0
				const total = 2
				const markReady = () => {
					if (successCount === total) {
						this.dotPath = dotPath
						this.dashPath = dashPath
						if (this.dotAudioCtx) {
							this.dotAudioCtx.src = dotPath
						}
						if (this.dashAudioCtx) {
							this.dashAudioCtx.src = dashPath
						}
						this.audioReady = true
					}
				}
				writeWav(dotPath, dotSamples, (ok) => {
					if (ok) {
						successCount += 1
					}
					markReady()
				})
				writeWav(dashPath, dashSamples, (ok) => {
					if (ok) {
						successCount += 1
					}
					markReady()
				})
			},
			processQueue() {
				if (this.inputQueue.length === 0) {
					return
				}
				while (this.inputQueue.length > 0) {
					const entry = this.inputQueue.shift()
					if (!entry) {
						continue
					}
					const mark = typeof entry === 'string' ? entry : entry.mark
					const playAudio = typeof entry === 'string' ? true : entry.playAudio
					this.scheduleMark(mark, playAudio)
				}
			},
			scheduleMark(mark, playAudio = true) {
				const unitMs = this.getUnitMs()
				const now = Date.now()
				let startAt = Math.max(now, this.nextAvailableAt || 0)
				// If we've been idle for a long gap, treat this as a new recording session.
				if (this.lastInputEndAt && !this.keyDown['.'] && !this.keyDown['-']) {
					const idleGapMs = startAt - this.lastInputEndAt
					const wordGapMs = this.cwDecoder ? this.cwDecoder.getWordGapMs(unitMs) : unitMs * 10
					if (idleGapMs >= wordGapMs) {
						this.stopRecordingAndDecode(unitMs)
						startAt = now
					}
				}
				const markUnits = mark === '-' ? 3 : 1
				const toneMs = unitMs * markUnits
				const gapMs = unitMs
				const durationMs = toneMs + gapMs
				const endAt = startAt + durationMs
				this.nextAvailableAt = endAt
				this.lastScheduledEndAt = endAt
				// Make the UI feel immediate on mobile.
				this.sendCW(mark)
				const startDelay = Math.max(0, startAt - now)
				if (playAudio) {
					const startTimer = setTimeout(() => {
						this.playMarkNow(mark, unitMs, durationMs)
					}, startDelay)
					this.scheduledTimers.push(startTimer)
				}
			},
			rescheduleGapTimers(unitMs) {
				if (!this.lastInputEndAt) {
					return
				}
				if (this.recordStopTimer) {
					clearTimeout(this.recordStopTimer)
					this.recordStopTimer = null
				}
				if (this.charGapTimer) {
					clearTimeout(this.charGapTimer)
					this.charGapTimer = null
				}
				// Do not stop/decode while the user is still holding a key.
				if (this.keyDown['.'] || this.keyDown['-'] || !this.cwDecoder || !this.cwDecoder.isRecording) {
					return
				}
				const scheduledEndAt = this.lastInputEndAt
				const now = Date.now()
				const charGapMs = this.cwDecoder.getCharGapMs(unitMs) || unitMs * 3
				const charGapAt = scheduledEndAt + Math.max(0, charGapMs - unitMs)
				const charDelay = Math.max(0, charGapAt - now)
				this.charGapTimer = setTimeout(() => {
					if (this.lastInputEndAt !== scheduledEndAt) {
						return
					}
					if (this.keyDown['.'] || this.keyDown['-']) {
						return
					}
					this.cwDecoder.addSilence(charGapMs, unitMs, this.wpm)
				}, charDelay)
				// lastInputEndAt already includes the 1-unit intra-character gap,
				// so waiting the remaining units yields a full word gap.
				const wordGapMs = this.cwDecoder.getWordGapMs(unitMs) || unitMs * 10
				const stopAt = scheduledEndAt + Math.max(0, wordGapMs - unitMs)
				const stopDelay = Math.max(0, stopAt - now)
				this.recordStopTimer = setTimeout(() => {
					if (this.lastInputEndAt !== scheduledEndAt) {
						return
					}
					if (this.keyDown['.'] || this.keyDown['-']) {
						return
					}
					this.stopRecordingAndDecode(unitMs)
				}, stopDelay)
			},
			playMarkNow(mark, unitMs, durationMs) {
				this.isKeying = true
				const releaseTimer = setTimeout(() => {
					this.isKeying = false
				}, durationMs)
				this.scheduledTimers.push(releaseTimer)
				if (this.useWebAudio && this.webAudioCtx && this.audioReady) {
					const buffer = mark === '-' ? this.dashBuffer : this.dotBuffer
					if (!buffer) {
						return
					}
					const source = this.webAudioCtx.createBufferSource()
					source.buffer = buffer
					source.connect(this.webAudioCtx.destination)
					if (this.webAudioCtx.resume) {
						this.webAudioCtx.resume()
					}
					source.start(0)
					return
				}
				if (!this.audioReady || !this.dotAudioCtx || !this.dashAudioCtx) {
					return
				}
				const audioCtx = mark === '-' ? this.dashAudioCtx : this.dotAudioCtx
				audioCtx.stop()
				audioCtx.seek(0)
				audioCtx.play()
			},
			appendDecodedText(decodedText, withSpace) {
				const text = (decodedText || '').trim()
				if (!text) {
					return
				}
				const payload = `${withSpace ? ' ' : ''}${text}`
				for (let i = 0; i < payload.length; i += 1) {
					for (let j = 0; j < this.decoderQueue.length - 1; j += 1) {
						this.decoderQueue[j] = this.decoderQueue[j + 1]
					}
					this.decoderQueue[this.decoderQueue.length - 1] = payload[i]
				}
				this.decoderText = this.decoderQueue.join('')
			},
			pushDecoderText(text) {
				if (!text) {
					return
				}
				for (let i = 0; i < text.length; i += 1) {
					this.pushDecoderChar(text[i])
				}
			},
			pushDecoderChar(char) {
				for (let i = 0; i < this.decoderQueue.length - 1; i += 1) {
					this.decoderQueue[i] = this.decoderQueue[i + 1]
				}
				this.decoderQueue[this.decoderQueue.length - 1] = char
				this.decoderText = this.decoderQueue.join('')
			},
			initDecoderQueue() {
				this.decoderQueue = new Array(20).fill(' ')
			},
			shiftDecoderQueue() {
				if (!this.decoderQueue.length) {
					return
				}
				for (let i = 0; i < this.decoderQueue.length - 1; i += 1) {
					this.decoderQueue[i] = this.decoderQueue[i + 1]
				}
				this.decoderQueue[this.decoderQueue.length - 1] = ' '
				this.decoderText = this.decoderQueue.join('')
			},
			applyDecodedResult(result) {
				if (!result || !result.text) {
					return
				}
				this.appendDecodedText(result.text, result.withSpace)
			},
			stopRecordingAndDecode(unitMs) {
				if (!this.cwDecoder) {
					return
				}
				this.applyDecodedResult(this.cwDecoder.stopRecordingAndDecode(unitMs, this.wpm))
			},
			updateFrequencyFromScroll(scrollLeft) {
				this.currentFrequency = calcFrequencyFromScroll({
					scrollLeft,
					rulerViewportWidth: this.rulerViewportWidth,
					rulerSpacer: this.rulerSpacer,
					totalBandWidth: this.totalBandWidth,
					bandSegments: this.bandSegments,
					pxPerMHz: this.pxPerMHz
				})
			},
			scrollLeftForFrequency(freq) {
				return calcScrollLeftForFrequency({
					freq,
					bandSegments: this.bandSegments,
					rulerSpacer: this.rulerSpacer,
					rulerViewportWidth: this.rulerViewportWidth,
					pxPerMHz: this.pxPerMHz
				})
			},
			addWaterfallRow() {
				const now = Date.now()
				const points = this.signals.map((signal) => ({
					id: `wf-${now}-${signal.id}`,
					freq: signal.freq,
					strength: signal.strength,
					source: signal.source
				}))
				const noiseCount = Math.floor(Math.random() * 3)
				for (let i = 0; i < noiseCount; i += 1) {
					points.push({
						id: `wf-noise-${now}-${i}`,
						freq: randomBandFrequency(this.bands),
						strength: 0.2 + Math.random() * 0.4,
						source: 'others'
					})
				}
				this.waterfallRows.unshift({
					id: `row-${now}-${Math.random().toString(16).slice(2)}`,
					points
				})
				this.waterfallRows = this.waterfallRows.slice(0, WATERFALL_ROWS)
			},
			sendCW(mark) {
				const signal = createSignal({
					idPrefix: 'me',
					freq: this.currentFrequency,
					strengthMin: 0.7,
					strengthMax: 1.0,
					durationMs: SIGNAL_DURATION,
					source: 'me'
				})
				this.signals.push(signal)
			},
			spawnNoiseSignal() {
				const now = Date.now()
				const signal = createSignal({
					idPrefix: 'noise',
					freq: randomBandFrequency(this.bands),
					strengthMin: 0.4,
					strengthMax: 0.9,
					durationMs: SIGNAL_DURATION,
					source: 'others',
					now
				})
				this.signals.push(signal)
			},
			tickSignals() {
				const now = Date.now()
				this.signals = this.signals.filter((signal) => signal.expiresAt > now)
			},
			tickStyle(tick) {
				return `left:${tick.x}px;`
			},
			rulerSignalStyle(signal) {
				const band = this.bandSegments.find((segment) => signal.freq >= segment.min && signal.freq <= segment.max)
				const segment = band || this.bandSegments[0]
				const left = this.rulerSpacer + segment.startX + (signal.freq - segment.min) * this.pxPerMHz
				const height = 24 + signal.strength * 70
				return `left:${left}px;height:${height}px;`
			},
			waterfallRowStyle(index) {
				const top = index * 6
				return `top:${top}rpx;`
			},
			waterfallPointStyle(point) {
				const band = this.bandSegments.find((segment) => point.freq >= segment.min && point.freq <= segment.max)
				const segment = band || this.bandSegments[0]
				const left = this.rulerSpacer + segment.startX + (point.freq - segment.min) * this.pxPerMHz
				const opacity = 0.25 + point.strength * 0.6
				return `left:${left}px;opacity:${opacity};`
			}
		}
	}
</script>

<style>
	.page {
		min-height: 100vh;
		padding: 30rpx;
		background: radial-gradient(circle at top, #1f1f2b 0%, #121219 45%, #0a0a0f 100%);
		color: #f2f2f2;
		font-family: "Menlo", "Consolas", "Courier New", monospace;
		display: flex;
		flex-direction: column;
	}

	.content {
		flex: 1;
	}

	.control-bottom {
		margin-top: auto;
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16rpx);
	}
</style>
