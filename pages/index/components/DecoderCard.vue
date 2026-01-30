<template>
	<view class="decoder-card">
		<view class="decoder-row">
			<text class="decoder-label">Decoder</text>
			<text class="decoder-text">{{ decoderText || '...' }}</text>
		</view>
		<view class="decoder-control">
			<text class="decoder-control-label">WPM: {{ wpm }}</text>
			<slider
				:min="5"
				:max="30"
				:step="1"
				:value="wpm"
				activeColor="#ffb347"
				backgroundColor="#2a2a2f"
				@change="$emit('wpm-change', $event)"
			/>
		</view>
		<view class="decoder-control">
			<text class="decoder-control-label">Tone: {{ toneFreq }} Hz</text>
			<slider
				:min="400"
				:max="1000"
				:step="10"
				:value="toneFreq"
				activeColor="#4dd0e1"
				backgroundColor="#2a2a2f"
				@change="$emit('tone-change', $event)"
			/>
		</view>
	</view>
</template>

<script>
	export default {
		props: {
			decoderText: {
				type: String,
				required: true
			},
			wpm: {
				type: Number,
				required: true
			},
			toneFreq: {
				type: Number,
				required: true
			}
		}
	}
</script>

<style scoped>
	.decoder-card {
		margin-top: 20rpx;
		padding: 18rpx 22rpx;
		border-radius: 18rpx;
		background: linear-gradient(160deg, #1c1c26, #12121a);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.decoder-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.decoder-label {
		font-size: 24rpx;
		color: #b7b7c6;
		text-transform: uppercase;
		letter-spacing: 1rpx;
	}

	.decoder-text {
		font-size: 26rpx;
		color: #ffb347;
	}

	.decoder-control {
		margin-top: 14rpx;
	}

	.decoder-control-label {
		display: block;
		margin-bottom: 8rpx;
		font-size: 22rpx;
		color: #9b9bb0;
	}
</style>
