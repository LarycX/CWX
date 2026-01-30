<template>
	<view class="spectrum-card">
		<view class="spectrum-header">
			<text class="section-title">Spectrum</text>
			<text class="freq-readout">{{ currentFrequency.toFixed(3) }} MHz</text>
		</view>

		<view class="ruler-wrap">
			<view class="center-indicator"></view>
			<scroll-view
				class="ruler-scroll"
				scroll-x
				:scroll-left="rulerScrollLeft"
				@scroll="$emit('ruler-scroll', $event)"
				:show-scrollbar="false"
			>
				<view class="ruler-content" :style="rulerContentStyle">
					<view class="ruler-base"></view>
					<view
						v-for="tick in ticks"
						:key="tick.id"
						class="tick"
						:class="tick.type === 'major' ? 'tick-major' : 'tick-minor'"
						:style="tickStyle(tick)"
					>
						<text v-if="tick.label" class="tick-label">{{ tick.label }}</text>
					</view>
					<view
						v-for="signal in signalsInBand"
						:key="signal.id"
						class="ruler-signal"
						:class="signal.source === 'me' ? 'signal-me' : 'signal-others'"
						:style="rulerSignalStyle(signal)"
					></view>
				</view>
			</scroll-view>
		</view>

		<view class="waterfall">
			<scroll-view
				class="waterfall-scroll"
				scroll-x
				:scroll-left="rulerScrollLeft"
				@scroll="$emit('waterfall-scroll', $event)"
				:show-scrollbar="false"
			>
				<view class="waterfall-content" :style="rulerContentStyle">
					<view
						v-for="(row, index) in waterfallRows"
						:key="row.id"
						class="waterfall-row"
						:style="waterfallRowStyle(index)"
					>
						<view
							v-for="point in row.points"
							:key="point.id"
							class="waterfall-point"
							:class="point.source === 'me' ? 'waterfall-me' : 'waterfall-others'"
							:style="waterfallPointStyle(point)"
						></view>
					</view>
				</view>
			</scroll-view>
		</view>

		<view class="spectrum-footer">
			<view class="scale">
				<text>{{ currentBand.min.toFixed(2) }} MHz</text>
				<text>{{ currentBand.max.toFixed(2) }} MHz</text>
			</view>
			<text class="legend">Swipe the ruler to tune. Signals fade in ~1.4s.</text>
		</view>
	</view>
</template>

<script>
	export default {
		props: {
			currentFrequency: {
				type: Number,
				required: true
			},
			currentBand: {
				type: Object,
				required: true
			},
			rulerScrollLeft: {
				type: Number,
				required: true
			},
			rulerContentStyle: {
				type: String,
				required: true
			},
			ticks: {
				type: Array,
				required: true
			},
			signalsInBand: {
				type: Array,
				required: true
			},
			waterfallRows: {
				type: Array,
				required: true
			},
			tickStyle: {
				type: Function,
				required: true
			},
			rulerSignalStyle: {
				type: Function,
				required: true
			},
			waterfallRowStyle: {
				type: Function,
				required: true
			},
			waterfallPointStyle: {
				type: Function,
				required: true
			}
		}
	}
</script>

<style scoped>
	.spectrum-card {
		margin-top: 26rpx;
		padding: 24rpx;
		border-radius: 22rpx;
		background: linear-gradient(160deg, #1d1d28 0%, #14141c 100%);
		border: 1px solid #2a2a36;
	}

	.spectrum-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16rpx;
	}

	.section-title {
		font-size: 28rpx;
		font-weight: 600;
	}

	.freq-readout {
		font-size: 24rpx;
		color: #ffb347;
		letter-spacing: 1rpx;
	}

	.ruler-wrap {
		position: relative;
		height: 220rpx;
		border-radius: 18rpx;
		overflow: hidden;
		background: linear-gradient(180deg, #0f1016 0%, #151521 100%);
		border: 1px solid #242433;
	}

	.ruler-scroll {
		height: 100%;
	}

	.ruler-content {
		position: relative;
		height: 100%;
	}

	.ruler-base {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 36rpx;
		height: 2rpx;
		background: rgba(255, 255, 255, 0.12);
	}

	.center-indicator {
		position: absolute;
		left: 50%;
		top: 16rpx;
		bottom: 16rpx;
		width: 2rpx;
		background: rgba(255, 179, 71, 0.9);
		box-shadow: 0 0 12rpx rgba(255, 179, 71, 0.5);
		z-index: 2;
	}

	.waterfall {
		position: relative;
		margin-top: 16rpx;
		height: 220rpx;
		border-radius: 16rpx;
		overflow: hidden;
		background: linear-gradient(180deg, #0d0f1b 0%, #0a0a12 100%);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.waterfall-scroll {
		height: 100%;
	}

	.waterfall-content {
		position: relative;
		height: 100%;
	}

	.waterfall-row {
		position: absolute;
		left: 0;
		right: 0;
		height: 6rpx;
	}

	.waterfall-point {
		position: absolute;
		top: 0;
		width: 12rpx;
		height: 6rpx;
		border-radius: 6rpx;
		transform: translateX(-50%);
	}

	.waterfall-me {
		background: linear-gradient(90deg, #ffb347, #ff6f3c);
		box-shadow: 0 0 12rpx rgba(255, 111, 60, 0.6);
	}

	.waterfall-others {
		background: linear-gradient(90deg, #4dd0e1, #2a6be9);
		box-shadow: 0 0 12rpx rgba(45, 133, 255, 0.45);
	}

	.tick {
		position: absolute;
		bottom: 36rpx;
		width: 2rpx;
		background: rgba(255, 255, 255, 0.18);
	}

	.tick-major {
		height: 40rpx;
		background: rgba(255, 255, 255, 0.4);
	}

	.tick-minor {
		height: 22rpx;
	}

	.tick-label {
		position: absolute;
		bottom: 44rpx;
		left: -24rpx;
		width: 90rpx;
		font-size: 18rpx;
		color: #b7b7c6;
		text-align: center;
	}

	.ruler-signal {
		position: absolute;
		bottom: 0;
		width: 12rpx;
		border-radius: 6rpx 6rpx 0 0;
		opacity: 0.85;
		animation: pulse 1.4s ease-out;
	}

	.signal-me {
		background: linear-gradient(180deg, #ffb347, #ff6f3c);
	}

	.signal-others {
		background: linear-gradient(180deg, #4dd0e1, #2a6be9);
	}

	.spectrum-footer {
		margin-top: 14rpx;
		font-size: 20rpx;
		color: #9b9bb0;
	}

	.scale {
		display: flex;
		justify-content: space-between;
	}

	.legend {
		display: block;
		margin-top: 8rpx;
	}

	@keyframes pulse {
		0% {
			transform: scaleY(0.2);
			opacity: 0.2;
		}

		100% {
			transform: scaleY(1);
			opacity: 0.9;
		}
	}
</style>
