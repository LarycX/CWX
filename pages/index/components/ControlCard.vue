<template>
	<view class="control-card">
		<view class="mode-row">
			<text class="mode-label">电键类型</text>
			<view class="mode-toggle">
				<view
					class="mode-btn"
					:class="keyMode === 'auto' ? 'mode-btn-active' : ''"
					@tap="$emit('mode-change', 'auto')"
				>
					自动键
				</view>
				<view
					class="mode-btn"
					:class="keyMode === 'manual' ? 'mode-btn-active' : ''"
					@tap="$emit('mode-change', 'manual')"
				>
					手动键
				</view>
			</view>
		</view>
		<view v-if="keyMode === 'auto'" class="mode-row">
			<text class="mode-label">交换点划</text>
			<switch
				:checked="swapKeys"
				color="#ffb347"
				@change="$emit('swap-change', $event)"
			/>
		</view>
		<view class="keypad">
			<!-- #ifdef MP-WEIXIN -->
			<view
				v-if="keyMode === 'manual'"
				class="key-btn manual"
				@touchstart.prevent="$emit('manual-start')"
				@touchend.prevent="$emit('manual-end')"
				@touchcancel.prevent="$emit('manual-end')"
			>
				<text>Press</text>
			</view>
			<template v-else>
				<view
					v-if="swapKeys"
					class="key-btn dash"
					@touchstart.prevent="$emit('start', '-')"
					@touchend.prevent="$emit('stop', '-')"
					@touchcancel.prevent="$emit('stop', '-')"
				>
					<image class="key-icon" src="/static/dash.svg" mode="aspectFit" />
				</view>
				<view
					v-if="swapKeys"
					class="key-btn dot"
					@touchstart.prevent="$emit('start', '.')"
					@touchend.prevent="$emit('stop', '.')"
					@touchcancel.prevent="$emit('stop', '.')"
				>
					<image class="key-icon" src="/static/dot.svg" mode="aspectFit" />
				</view>
				<view
					v-if="!swapKeys"
					class="key-btn dot"
					@touchstart.prevent="$emit('start', '.')"
					@touchend.prevent="$emit('stop', '.')"
					@touchcancel.prevent="$emit('stop', '.')"
				>
					<image class="key-icon" src="/static/dot.svg" mode="aspectFit" />
				</view>
				<view
					v-if="!swapKeys"
					class="key-btn dash"
					@touchstart.prevent="$emit('start', '-')"
					@touchend.prevent="$emit('stop', '-')"
					@touchcancel.prevent="$emit('stop', '-')"
				>
					<image class="key-icon" src="/static/dash.svg" mode="aspectFit" />
				</view>
			</template>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view
				v-if="keyMode === 'manual'"
				class="key-btn manual"
				@touchstart.prevent="$emit('manual-start')"
				@touchend.prevent="$emit('manual-end')"
				@mousedown.prevent="$emit('manual-start')"
				@mouseup.prevent="$emit('manual-end')"
				@mouseleave.prevent="$emit('manual-end')"
			>
				<text>Press</text>
			</view>
			<template v-else>
				<view v-if="swapKeys" class="key-btn dash" @tap="$emit('mark', '-')">
					<image class="key-icon" src="/static/dash.svg" mode="aspectFit" />
				</view>
				<view v-if="swapKeys" class="key-btn dot" @tap="$emit('mark', '.')">
					<image class="key-icon" src="/static/dot.svg" mode="aspectFit" />
				</view>
				<view v-if="!swapKeys" class="key-btn dot" @tap="$emit('mark', '.')">
					<image class="key-icon" src="/static/dot.svg" mode="aspectFit" />
				</view>
				<view v-if="!swapKeys" class="key-btn dash" @tap="$emit('mark', '-')">
					<image class="key-icon" src="/static/dash.svg" mode="aspectFit" />
				</view>
			</template>
			<!-- #endif -->
		</view>
	</view>
</template>

<script>
	export default {
		props: {
			keyMode: {
				type: String,
				default: "auto",
			},
			swapKeys: {
				type: Boolean,
				default: false,
			},
		},
	};
</script>

<style scoped>
	.control-card {
		margin-top: 26rpx;
		padding: 24rpx;
		border-radius: 22rpx;
		background: linear-gradient(160deg, #1d1d28 0%, #14141c 100%);
		border: 1px solid #2a2a36;
	}

	.mode-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18rpx;
	}

	.mode-label {
		font-size: 22rpx;
		color: #b7b7c6;
		text-transform: uppercase;
		letter-spacing: 1rpx;
	}

	.mode-toggle {
		display: flex;
		gap: 8rpx;
		padding: 6rpx;
		border-radius: 999rpx;
		background: #101018;
		border: 1px solid #2a2a36;
	}

	.mode-btn {
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		font-size: 20rpx;
		color: #9b9bb0;
	}

	.mode-btn-active {
		background: #ffb347;
		color: #111117;
		font-weight: 600;
	}

	.keypad {
		display: flex;
		gap: 16rpx;
	}

	.key-btn {
		flex: 1;
		aspect-ratio: 1 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 22rpx;
		text-align: center;
		font-size: 48rpx;
		font-weight: 800;
		color: #111117;
	}

	.key-icon {
		width: 58rpx;
		height: 58rpx;
	}

	.key-btn.dot {
		background: linear-gradient(140deg, #ffb347, #ffd194);
	}

	.key-btn.dash {
		background: linear-gradient(140deg, #4dd0e1, #74b9ff);
	}

	.key-btn.manual {
		background: linear-gradient(140deg, #ffd166, #ff9f1c);
	}
</style>
