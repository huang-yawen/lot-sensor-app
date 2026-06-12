<template>
  <view class="page safe-area-bottom">
    <view class="header">
    </view>

    <!-- 设备在线状态卡片 -->
    <view class="group">
      <text class="group-title">设备在线状态</text>
      <view class="device-grid">
        <view
          class="device-chip"
          v-for="device in deviceStatusList"
          :key="device.deviceId"
          :class="{ online: device.online, offline: !device.online }"
        >
          <text class="chip-dot"></text>
          <text class="chip-id">{{ device.deviceId }}</text>
        </view>
        <view v-if="deviceStatusList.length === 0" class="no-device">
          <text>暂无设备数据</text>
        </view>
      </view>
    </view>

    <view class="group">
      <text class="group-title">传感器数据</text>
      <navigator class="nav-item" url="/pages/sensorRealtime/sensorRealtime"
        >传感器实时数据</navigator
      >
      <navigator class="nav-item" url="/pages/sensorHistory/sensorHistory"
        >传感器历史数据</navigator
      >
    </view>
	
	<view class="group">
	  <text class="group-title">行为数据</text>
	  <navigator class="nav-item" url="/pages/behaviorRealtime/behaviorRealtime"
	    >行为实时数据</navigator
	  >
	  <navigator class="nav-item" url="/pages/behaviorHistory/behaviorHistory"
	    >行为历史数据</navigator
	  >
	  
	</view>

    <view class="group">
      <text class="group-title">设备控制</text>
      <!-- <navigator class="nav-item" url="/pages/deviceManage/deviceManage"
        >设备管理中心</navigator
      > -->
      <navigator class="nav-item" url="/pages/commandConfig/commandConfig"
        >指令配置中心</navigator
      >
    </view>
	<view class="group">
		<text class="group-title">设备检测</text>
		<navigator class="nav-item" url="/pages/errorHistory/errorHistory"
		  >设备状态监测记录</navigator
		>
	</view>
    <view class="group settings-group" style="visibility:hidden;">
      <text class="group-title">显示设置</text>
      <button
        class="setting-btn"
        :class="{ active: visibility.hideId }"
        size="mini"
        @click="visibility.toggleHideId"
      >
        {{ visibility.hideId ? "显示ID内容" : "隐藏ID内容" }}
      </button>
      <button
        class="setting-btn"
        :class="{ active: visibility.hideNumber }"
        size="mini"
        @click="visibility.toggleHideNumber"
      >
        {{ visibility.hideNumber ? "显示编号内容" : "隐藏编号内容" }}
      </button>
    </view>
  </view>
  
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import { displayStore } from "../../stores/displayStore"
import { connect, on, close } from "../../utils/websocket"

const visibility = displayStore()

// 设备在线状态列表
const deviceStatusList = ref([])

// WebSocket 取消订阅函数
let unsubscribe = null

onMounted(() => {
  // 连接 WebSocket
  connect()

  // 监听设备状态消息
  unsubscribe = on("device_status", (payload) => {
    if (Array.isArray(payload)) {
      deviceStatusList.value = payload
    }
  })
})

onUnmounted(() => {
  // 取消监听
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
<style>
.page {
  min-height: 100vh;
  background: #f5f8ff;
  padding: 24rpx;
  box-sizing: border-box;
}

.header {
  margin-bottom: 20rpx;
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 600;
  color: #1f2937;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #6b7280;
}

.group {
  background: #ffffff;
  border: 2rpx solid #dbeafe;
  border-radius: 20rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 20rpx;
}

.group-title {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 12rpx;
}

.nav-item {
  display: block;
  padding: 18rpx 16rpx;
  border-radius: 14rpx;
  background: #f8fbff;
  border: 2rpx solid #dbeafe;
  color: #2563eb;
  font-size: 28rpx;
  margin-bottom: 12rpx;
}

.nav-item:last-child {
  margin-bottom: 0;
}

.settings-group {
  margin-top: 28rpx;
}

.setting-btn {
  width: 100%;
  margin: 0 0 12rpx;
  color: #2563eb;
  background: #f8fbff;
  border: 2rpx solid #dbeafe;
}

.setting-btn.active {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
}

.setting-btn:last-child {
  margin-bottom: 0;
}

/* 设备状态 - 小圆片样式 */
.device-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.device-chip {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 14rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.device-chip.online {
  background: #d1fae5;
  color: #065f46;
  border: 2rpx solid #a7f3d0;
}

.device-chip.offline {
  background: #f3f4f6;
  color: #9ca3af;
  border: 2rpx solid #e5e7eb;
}

.chip-dot {
  display: inline-block;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.device-chip.online .chip-dot {
  background: #10b981;
  box-shadow: 0 0 6rpx rgba(16, 185, 129, 0.5);
}

.device-chip.offline .chip-dot {
  background: #d1d5db;
}

.chip-id {
  font-size: 22rpx;
}

.no-device {
  width: 100%;
  text-align: center;
  padding: 30rpx 0;
  color: #9ca3af;
  font-size: 26rpx;
}
</style>