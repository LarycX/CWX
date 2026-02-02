import MorseDecoder from "morse-pro/lib/morse-pro-decoder";

class CwDecoderEngine {
	constructor() {
		this.reset();
	}

	reset() {
		this.isRecording = false;
		this.lastEventAt = 0;
		this.unitEstimateMs = 0;
		this.allowGapEstimate = true;
		this.manualGapQuantize = false;
		this.toneHistory = [];
		this.toneHistoryLimit = 20;
		this.charGapUnits = 3;
		this.wordGapUnits = 10;
		const callback = this.messageCallback || (() => {});
		this.decoder = new MorseDecoder({
			wpm: 20,
			messageCallback: callback
		});
		this.decoder.noiseThreshold = 0;
	}

	setMessageCallback(cb) {
		this.messageCallback = cb || (() => {});
		if (this.decoder) {
			this.decoder.messageCallback = this.messageCallback;
		}
	}

	setGapEstimateEnabled(enabled) {
		this.allowGapEstimate = Boolean(enabled);
	}

	setManualGapQuantizeEnabled(enabled) {
		this.manualGapQuantize = Boolean(enabled);
	}

	quantizeGapMs(gapMs, unitMs) {
		if (!gapMs || !unitMs) return gapMs;
		const ratio = gapMs / unitMs;
		let targetUnits = 1;
		if (ratio < 1.8) {
			targetUnits = 1;
		} else if (ratio < 6) {
			targetUnits = this.charGapUnits;
		} else {
			targetUnits = this.wordGapUnits;
		}
		return targetUnits * unitMs;
	}

	ensureRecordingSession() {
		if (this.isRecording) return;
		this.isRecording = true;
		this.lastEventAt = 0;
	}

	updateUnitEstimate(gapMs, fallbackUnitMs) {
		if (gapMs <= 0) return;
		const base = this.unitEstimateMs || fallbackUnitMs;
		if (!base) return;
		let estimate = 0;
		if (gapMs >= base * 0.5 && gapMs <= base * 2.2) {
			estimate = gapMs;
		} else if (gapMs > base * 2.2 && gapMs <= base * 4.5) {
			estimate = gapMs / this.charGapUnits;
		} else if (gapMs > base * 4.5 && gapMs <= base * 14) {
			estimate = gapMs / this.wordGapUnits;
		}
		if (!estimate) return;
		this.applyUnitEstimate(estimate, 0.25, fallbackUnitMs);
	}

	getUnitEstimateMs(fallbackUnitMs) {
		return this.unitEstimateMs || fallbackUnitMs;
	}

	getCharGapMs(fallbackUnitMs) {
		const unit = this.getUnitEstimateMs(fallbackUnitMs);
		return unit ? unit * this.charGapUnits : 0;
	}

	getWordGapMs(fallbackUnitMs) {
		const unit = this.getUnitEstimateMs(fallbackUnitMs);
		return unit ? unit * this.wordGapUnits : 0;
	}

	updateUnitEstimateFromTone(toneMs, fallbackUnitMs) {
		if (!toneMs) return;
		const base = this.unitEstimateMs || fallbackUnitMs;
		if (!base) return;
		let estimate = 0;
		if (toneMs <= base * 2) {
			estimate = toneMs;
		} else if (toneMs <= base * 4) {
			estimate = toneMs / 3;
		}
		if (!estimate) return;
		this.applyUnitEstimate(estimate, 0.2, fallbackUnitMs);
	}

	applyUnitEstimate(estimate, alpha = 0.2, fallbackUnitMs = 0) {
		if (!estimate) return;
		let next = this.unitEstimateMs
			? this.unitEstimateMs * (1 - alpha) + estimate * alpha
			: estimate;
		if (fallbackUnitMs) {
			const minUnit = Math.max(20, fallbackUnitMs * 0.6);
			const maxUnit = fallbackUnitMs * 2.4;
			next = Math.min(Math.max(next, minUnit), maxUnit);
		}
		this.unitEstimateMs = next;
	}

	pushToneHistory(toneMs) {
		if (!toneMs) return;
		this.toneHistory.push(toneMs);
		if (this.toneHistory.length > this.toneHistoryLimit) {
			this.toneHistory.shift();
		}
	}

	computeKMeansThreshold(toneMs, fallbackUnitMs) {
		const samples = this.toneHistory.slice();
		if (toneMs) samples.push(toneMs);
		if (samples.length < 6) {
			return fallbackUnitMs ? fallbackUnitMs * 2 : 0;
		}
		const sorted = samples.slice().sort((a, b) => a - b);
		let c1 = sorted[0];
		let c2 = sorted[sorted.length - 1];
		for (let i = 0; i < 8; i += 1) {
			let sum1 = 0;
			let sum2 = 0;
			let count1 = 0;
			let count2 = 0;
			for (let j = 0; j < sorted.length; j += 1) {
				const v = sorted[j];
				if (Math.abs(v - c1) <= Math.abs(v - c2)) {
					sum1 += v;
					count1 += 1;
				} else {
					sum2 += v;
					count2 += 1;
				}
			}
			if (count1) c1 = sum1 / count1;
			if (count2) c2 = sum2 / count2;
		}
		if (c1 > c2) {
			const tmp = c1;
			c1 = c2;
			c2 = tmp;
		}
		return (c1 + c2) / 2;
	}

	classifyMarkFromTone(toneMs, fallbackUnitMs) {
		const base = this.unitEstimateMs || fallbackUnitMs;
		if (!base || !toneMs) {
			return { mark: '.', unitMs: fallbackUnitMs || toneMs || 0 };
		}
		const threshold = this.computeKMeansThreshold(toneMs, fallbackUnitMs);
		const mark = threshold && toneMs > threshold ? '-' : '.';
		const estimate = mark === '-' ? toneMs / 3 : toneMs;
		this.applyUnitEstimate(estimate, 0.25, fallbackUnitMs);
		this.pushToneHistory(toneMs);
		return { mark, unitMs: this.unitEstimateMs || fallbackUnitMs };
	}

	recordMark(mark, startAt, unitMs, wpm, toneMsOverride = null) {
		this.ensureRecordingSession();
		if (this.decoder && this.decoder.wpm !== wpm) {
			this.decoder.setWPM(wpm);
		}
		if (this.lastEventAt) {
			const gapMs = Math.max(0, startAt - this.lastEventAt);
			if (gapMs > 0) {
				const adjustedGapMs = this.manualGapQuantize
					? this.quantizeGapMs(gapMs, unitMs)
					: gapMs;
				this.updateUnitEstimate(adjustedGapMs, unitMs);
				this.decoder.addTiming(-adjustedGapMs);
				this.lastEventAt = startAt;
			}
		}
		const markUnits = mark === "-" ? 3 : 1;
		const toneMs = toneMsOverride || unitMs * markUnits;
		this.decoder.addTiming(toneMs);
		this.lastEventAt = startAt + toneMs;
		return null;
	}

	addSilence(gapMs, unitMs, wpm) {
		if (!this.isRecording || gapMs <= 0) {
			return;
		}
		if (this.decoder && this.decoder.wpm !== wpm) {
			this.decoder.setWPM(wpm);
		}
		const adjustedGapMs = this.manualGapQuantize
			? this.quantizeGapMs(gapMs, unitMs)
			: gapMs;
		if (this.allowGapEstimate) {
			this.updateUnitEstimate(adjustedGapMs, unitMs);
		}
		this.decoder.addTiming(-adjustedGapMs);
		if (this.lastEventAt) {
			this.lastEventAt += adjustedGapMs;
		}
	}

	stopRecordingAndDecode(unitMs, wpm) {
		if (!this.isRecording) {
			return { text: "", withSpace: false };
		}
		this.isRecording = false;
		const gapMs = this.getWordGapMs(unitMs) || unitMs * this.wordGapUnits;
		this.addSilence(gapMs, unitMs, wpm);
		this.decoder.flush();
		this.lastEventAt = 0;
		return { text: "", withSpace: false };
	}
}

export default CwDecoderEngine;
