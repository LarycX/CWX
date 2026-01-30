<template>
	<view class="control-card">
		<view class="keypad">
			<!-- #ifdef MP-WEIXIN -->
			<view
				class="key-btn dot"
				@touchstart.prevent="$emit('start', '.')"
				@touchend.prevent="$emit('stop', '.')"
				@touchcancel.prevent="$emit('stop', '.')"
			>
				<text>Dot</text>
			</view>
			<view
				class="key-btn dash"
				@touchstart.prevent="$emit('start', '-')"
				@touchend.prevent="$emit('stop', '-')"
				@touchcancel.prevent="$emit('stop', '-')"
			>
				<text>Dash</text>
			</view>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view class="key-btn dot" @tap="$emit('mark', '.')">
				<text>Dot</text>
			</view>
			<view class="key-btn dash" @tap="$emit('mark', '-')">
				<text>Dash</text>
			</view>
			<!-- #endif -->
		</view>
	</view>
</template>

<script>
	export default {}
</script>

<style scoped>
	.control-card {
		margin-top: 26rpx;
		padding: 24rpx;
		border-radius: 22rpx;
		background: linear-gradient(160deg, #1d1d28 0%, #14141c 100%);
		border: 1px solid #2a2a36;
	}

	.keypad {
		display: flex;
		gap: 16rpx;
	}

	.key-btn {
		flex: 1;
		padding: 30rpx 0;
		border-radius: 20rpx;
		text-align: center;
		font-size: 34rpx;
		font-weight: 600;
		color: #111117;
	}

	.key-btn.dot {
		background: linear-gradient(140deg, #ffb347, #ffd194);
	}

	.key-btn.dash {
		background: linear-gradient(140deg, #4dd0e1, #74b9ff);
	}
</style>
