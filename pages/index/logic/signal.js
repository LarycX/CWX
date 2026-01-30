const randomBandFrequency = (bands) => {
	const band = bands[Math.floor(Math.random() * bands.length)]
	return band.min + Math.random() * (band.max - band.min)
}

const createSignal = ({
	idPrefix,
	freq,
	strengthMin,
	strengthMax,
	durationMs,
	source,
	now
}) => {
	const stamp = now || Date.now()
	const strength = strengthMin + Math.random() * (strengthMax - strengthMin)
	return {
		id: `${idPrefix}-${stamp}-${Math.random().toString(16).slice(2)}`,
		freq,
		strength,
		expiresAt: stamp + durationMs,
		source
	}
}

export { createSignal, randomBandFrequency }
