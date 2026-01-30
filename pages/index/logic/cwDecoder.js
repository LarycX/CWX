import MorseDecoder from "morse-pro/lib/morse-pro-decoder";

class CwDecoderEngine {
	constructor() {
		this.reset();
	}

	reset() {
		this.isRecording = false;
		this.lastEventAt = 0;
		this.unitEstimateMs = 0;
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
		const alpha = 0.25;
		this.unitEstimateMs = this.unitEstimateMs
			? this.unitEstimateMs * (1 - alpha) + estimate * alpha
			: estimate;
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
		const alpha = 0.2;
		this.unitEstimateMs = this.unitEstimateMs
			? this.unitEstimateMs * (1 - alpha) + estimate * alpha
			: estimate;
	}

	recordMark(mark, startAt, unitMs, wpm) {
		this.ensureRecordingSession();
		if (this.decoder && this.decoder.wpm !== wpm) {
			this.decoder.setWPM(wpm);
		}
		if (this.lastEventAt) {
			const gapMs = Math.max(0, startAt - this.lastEventAt);
			if (gapMs > 0) {
				this.updateUnitEstimate(gapMs, unitMs);
				this.decoder.addTiming(-gapMs);
				this.lastEventAt = startAt;
			}
		}
		const markUnits = mark === "-" ? 3 : 1;
		const toneMs = unitMs * markUnits;
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
		this.updateUnitEstimate(gapMs, unitMs);
		this.decoder.addTiming(-gapMs);
		if (this.lastEventAt) {
			this.lastEventAt += gapMs;
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
