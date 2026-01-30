const pickMajorStep = (bandRange) => {
	if (bandRange <= 0.12) {
		return 0.01
	}
	if (bandRange <= 0.3) {
		return 0.05
	}
	return 0.1
}

const buildBandSegments = (bands, pxPerMHz, gapPx) => {
	let cursor = 0
	return bands.map((band) => {
		const width = (band.max - band.min) * pxPerMHz
		const segment = {
			...band,
			startX: cursor,
			endX: cursor + width,
			width
		}
		cursor += width + gapPx
		return segment
	})
}

const buildTicks = (bandSegments, rulerSpacer, pxPerMHz) => {
	const ticks = []
	let globalIndex = 0
	bandSegments.forEach((band) => {
		const majorStep = pickMajorStep(band.max - band.min)
		const minorStep = majorStep / 5
		const precision = majorStep < 0.01 ? 3 : 2
		const start = band.min
		const end = band.max + 0.000001
		let index = 0
		for (let freq = start; freq <= end; freq += minorStep) {
			const isMajor = index % 5 === 0
			const rounded = Number(freq.toFixed(5))
			const x = rulerSpacer + band.startX + (rounded - band.min) * pxPerMHz
			ticks.push({
				id: `tick-${globalIndex}`,
				x,
				type: isMajor ? 'major' : 'minor',
				label: isMajor ? rounded.toFixed(precision) : ''
			})
			index += 1
			globalIndex += 1
		}
	})
	return ticks
}

const snapFrequency = (band, freq) => {
	const step = 0.01
	const snapped = Math.round((freq - band.min) / step) * step + band.min
	return Math.min(band.max, Math.max(band.min, Number(snapped.toFixed(3))))
}

const computeFrequencyFromScroll = ({
	scrollLeft,
	rulerViewportWidth,
	rulerSpacer,
	totalBandWidth,
	bandSegments,
	pxPerMHz
}) => {
	const centerX = scrollLeft + rulerViewportWidth / 2
	const contentX = centerX - rulerSpacer
	if (contentX <= 0) {
		return snapFrequency(bandSegments[0], bandSegments[0].min)
	}
	if (contentX >= totalBandWidth) {
		const last = bandSegments[bandSegments.length - 1]
		return snapFrequency(last, last.max)
	}
	let closest = bandSegments[0]
	let minDistance = Infinity
	for (let i = 0; i < bandSegments.length; i += 1) {
		const band = bandSegments[i]
		if (contentX >= band.startX && contentX <= band.endX) {
			const offsetMHz = (contentX - band.startX) / pxPerMHz
			return snapFrequency(band, band.min + offsetMHz)
		}
		const distance = contentX < band.startX ? band.startX - contentX : contentX - band.endX
		if (distance < minDistance) {
			minDistance = distance
			closest = band
		}
	}
	const edge = contentX < closest.startX ? closest.startX : closest.endX
	const offsetMHz = (edge - closest.startX) / pxPerMHz
	return snapFrequency(closest, closest.min + offsetMHz)
}

const scrollLeftForFrequency = ({
	freq,
	bandSegments,
	rulerSpacer,
	rulerViewportWidth,
	pxPerMHz
}) => {
	const band = bandSegments.find((segment) => freq >= segment.min && freq <= segment.max)
	const segment = band || bandSegments[0]
	const x = rulerSpacer + segment.startX + (freq - segment.min) * pxPerMHz
	return Math.max(0, x - rulerViewportWidth / 2)
}

export {
	buildBandSegments,
	buildTicks,
	computeFrequencyFromScroll,
	pickMajorStep,
	snapFrequency,
	scrollLeftForFrequency
}
