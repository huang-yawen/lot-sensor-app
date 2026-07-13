<template>
  <view class="page safe-area-bottom">
    <view class="header">
      <text class="title">传感器历史数据</text>
      <navigator class="jump-link" url="/pages/menuCenter/menuCenter">统一入口</navigator>
    </view>

    <view class="filter-card">
      <view class="filter-row">
        <text class="label">开始日期</text>
        <picker mode="date" :value="startDatePart" @change="onStartDatePartChange">
          <view class="picker-value">
            <text>{{ startDatePart || '请选择' }}</text>
          </view>
        </picker>
        <picker mode="time" :value="startTimePart" @change="onStartTimePartChange">
          <view class="picker-value">
            <text>{{ startTimePart || '请选择' }}</text>
          </view>
        </picker>
      </view>

      <view class="filter-row">
        <text class="label">结束日期</text>
        <picker mode="date" :value="endDatePart" @change="onEndDatePartChange">
          <view class="picker-value">
            <text>{{ endDatePart || '请选择' }}</text>
          </view>
        </picker>
        <picker mode="time" :value="endTimePart" @change="onEndTimePartChange">
          <view class="picker-value">
            <text>{{ endTimePart || '请选择' }}</text>
          </view>
        </picker>
      </view>

      <view class="action-row">
        <button class="btn" type="primary" size="mini" @click="handleSearch(1)">
          查询
        </button>
        <button class="btn" size="mini" @click="resetSearch">重置</button>
        <button class="btn btn-recognize" :disabled="selectedIds.length === 0 || recognizing" @click="handleRecognize">
          {{ recognizing ? '识别中...' : '智能识别' }}
        </button>
      </view>
    </view>

    <view class="state" v-if="store.loading">
      <text>加载中...</text>
    </view>
    <view class="state" v-else-if="!dataList.length">
      <text>暂无数据</text>
    </view>

    <scroll-view class="list" scroll-y="true" v-else>
      <view class="data-card" v-for="(item, index) in dataList" :key="index" @click="toggleSelect(item.id)">
        <view class="card-header-row">
          <checkbox :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect(item.id)" style="transform: scale(0.8);" />
          <text class="card-index">#{{ index + 1 }}</text>
        </view>
        <view class="row" v-for="[key, value] in visibleEntries(item, visibility)" :key="key">
          <text class="key">{{ key }}：</text>
          <text class="value">{{ renderText(value) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="pagination">
      <button
        class="page-btn"
        size="mini"
        :disabled="store.currentPage <= 1 || store.loading"
        @click="prevPage"
      >
        上一页
      </button>
      <text class="page-text">第 {{ store.currentPage }} 页</text>
      <button
        class="page-btn"
        size="mini"
        :disabled="!hasNextPage || store.loading"
        @click="nextPage"
      >
        下一页
      </button>
    </view>
	
	<view class="chart-section">
	    <LineBar :data="data" :pageSize="pageSize" :fieldUnits="store.fieldUnits"/>
	</view>

    <!-- 识别结果弹窗 -->
    <view class="modal-mask" v-if="showResult" @click="showResult = false"></view>
    <view class="modal" v-if="showResult">
      <view class="modal-header">
        <text class="modal-title">智能识别结果</text>
        <text class="close" @click="showResult = false">×</text>
      </view>
      <view class="modal-body">
        <view class="summary-bar">
          <text class="summary-tag">总计：{{ resultData?.summary?.total || 0 }} 条</text>
          <text class="summary-tag ok">正常：{{ resultData?.summary?.normal || 0 }} 条</text>
          <text class="summary-tag err">异常：{{ resultData?.summary?.abnormal || 0 }} 条</text>
        </view>
        <scroll-view scroll-y="true" style="max-height: 400px; margin-top: 12px;">
          <view class="result-item" v-for="item in (resultData?.results || [])" :key="item.id">
            <view class="result-row">
              <text class="result-label">数据ID：</text>
              <text class="result-val">{{ item.id }}</text>
            </view>
            <view class="result-row">
              <text class="result-label">判定结果：</text>
              <text class="result-val" :class="item.result === '正常' ? 'green' : 'red'">{{ item.result }}</text>
            </view>
            <view class="result-row">
              <text class="result-label">置信度：</text>
              <text class="result-val">{{ (item.confidence * 100).toFixed(0) }}%</text>
            </view>
            <view class="result-row">
              <text class="result-label">详情：</text>
              <text class="result-val">{{ item.detail }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="modal-footer">
        <button class="btn" size="mini" @click="showResult = false">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from "vue"
import { onLoad, onPullDownRefresh, onUnload } from "@dcloudio/uni-app"
import { paginationStore } from "../../stores/paginationStore"
import { displayStore } from "../../stores/displayStore"
import { shouldHideField, visibleEntries } from "../../utils/fieldVisibility"
import { connect as wsConnect, on as wsOn, close as wsClose } from "../../utils/websocket"
import { post } from "../../utils/request"
import LineBar from "../../components/LineBar.vue"

const store = paginationStore()
const visibility = displayStore()
const keyword = ref("")
const hideDeviceSelector = computed(() => shouldHideField("设备编号ID", visibility))

// 勾选 & 识别
const selectedIds = ref([])
const recognizing = ref(false)
const showResult = ref(false)
const resultData = ref(null)

const startDatePart = ref("")
const startTimePart = ref("")
const endDatePart = ref("")
const endTimePart = ref("")

const startDate = computed(() => {
  if (!startDatePart.value || !startTimePart.value) return ""
  return `${startDatePart.value} ${startTimePart.value}`
})
const endDate = computed(() => {
  if (!endDatePart.value || !endTimePart.value) return ""
  return `${endDatePart.value} ${endTimePart.value}`
})

const validateDateRange = () => {
  if (!startDate.value || !endDate.value) return true
  return new Date(startDate.value) <= new Date(endDate.value)
}

const data=computed(()=>store.paginationData.slice(0,5))
const pageSize=computed(()=>store.pageSize||5)

const dataList = computed(() => {
  return Array.isArray(store.paginationData) ? store.paginationData : []
})

const hasNextPage = computed(() => {
  const current = Number(store.currentPage || 1)
  const size = Number(store.pageSize || 5)
  const total = Number(store.total || 0)
  return current * size < total
})

const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const handleRecognize = async () => {
  if (selectedIds.value.length === 0) {
    uni.showToast({ title: '请先勾选数据', icon: 'none' })
    return
  }
  recognizing.value = true
  try {
    const res = await post('/intelligent/recognize', { type: 'sensor', ids: selectedIds.value })
    if (res.data.success) {
      resultData.value = res.data.data
      showResult.value = true
    } else {
      uni.showToast({ title: res.data.message || '识别失败', icon: 'none' })
    }
  } catch (err) {
    console.error('[SensorHistory] 识别失败:', err)
    uni.showToast({ title: '识别请求失败', icon: 'none' })
  } finally {
    recognizing.value = false
  }
}

const buildParams = (page = 1) => {
  return {
    type: "sensor",
    currentPage: page,
    pageSize: Number(store.pageSize || 5),
    keyword: keyword.value,
    startTime: startDate.value || undefined,
    endTime: endDate.value || undefined,
  }
}

const fetchList = async (page = 1) => {
  await store.fetchPaginationData(buildParams(page))
}

const handleSearch = async (page = 1) => {
  if (!validateDateRange()) {
    uni.showToast({
      title: '开始时间不能大于结束时间',
      icon: 'none'
    })
    return
  }
  await fetchList(page)
}

const resetSearch = async () => {
  keyword.value = ""
  startDatePart.value = ""
  startTimePart.value = ""
  endDatePart.value = ""
  endTimePart.value = ""
  await fetchList(1)
}

const prevPage = async () => {
  if (store.currentPage <= 1) return
  await fetchList(Number(store.currentPage) - 1)
}

const nextPage = async () => {
  if (!hasNextPage.value) return
  await fetchList(Number(store.currentPage) + 1)
}

const onStartDatePartChange = (event) => {
  startDatePart.value = event.detail.value
}

const onStartTimePartChange = (event) => {
  startTimePart.value = event.detail.value
}

const onEndDatePartChange = (event) => {
  endDatePart.value = event.detail.value
}

const onEndTimePartChange = (event) => {
  endTimePart.value = event.detail.value
}

const renderText = (val) => {
  if (val === null || val === undefined) return ""
  return String(val)
}

let wsUnsubscribe = null

onLoad(async () => {
  await fetchList(1)

  wsConnect({
    onMessage: (data) => {
      if (data.type === 'sensor_data') {
        fetchList(Number(store.currentPage || 1))
      }
    }
  })

  wsUnsubscribe = wsOn('sensor_data', () => {
    fetchList(Number(store.currentPage || 1))
  })
})

onPullDownRefresh(async () => {
  await fetchList(Number(store.currentPage || 1))
  uni.stopPullDownRefresh()
})

onUnload(() => {
  if (wsUnsubscribe) {
    wsUnsubscribe()
    wsUnsubscribe = null
  }
  wsClose()
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
}

.jump-link {
  font-size: 24rpx;
  color: #2563eb;
  background: #eaf2ff;
  border: 2rpx solid #bfdbfe;
  border-radius: 12rpx;
  padding: 10rpx 16rpx;
  line-height: 1;
}

.filter-card {
  background: #ffffff;
  border-radius: 20rpx;
  border: 2rpx solid #dbeafe;
  padding: 20rpx;
  margin-bottom: 20rpx;
}
.chart-section{
	margin-top: 30rpx;
}
.filter-row {
  margin-bottom: 16rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
  margin-bottom: 10rpx;
}

.input,
.picker-value {
  height: 76rpx;
  background: #ffffff;
  border: 2rpx solid #dbeafe;
  border-radius: 16rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #1f2937;
  display: flex;
  align-items: center;
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;
}

.btn {
  margin: 0;
  flex: 1;
}

.btn-recognize {
  background: #f59e0b;
  color: #fff;
  border-color: #d97706;
}

.btn-recognize[disabled] {
  opacity: 0.5;
}

.state {
  height: 220rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #9ca3af;
  font-size: 28rpx;
}

.list {
  max-height: calc(100vh - 560rpx);
}

.data-card {
  background: #ffffff;
  border: 2rpx solid #dbeafe;
  border-radius: 20rpx;
  padding: 18rpx 22rpx;
  margin-bottom: 16rpx;
}

.card-header-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.card-index {
  font-size: 24rpx;
  color: #9ca3af;
}

.row {
  display: flex;
  justify-content: space-between;
  border-bottom: 2rpx dashed #edf2f7;
  padding: 12rpx 0;
}

.row:last-child {
  border-bottom: 0;
}

.key {
  font-size: 26rpx;
  color: #2563eb;
  margin-right: 16rpx;
}

.value {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #374151;
}

.pagination {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-btn {
  margin: 0;
  width: 180rpx;
}

.page-text {
  font-size: 26rpx;
  color: #4b5563;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
}

.modal {
  position: fixed;
  left: 40rpx;
  right: 40rpx;
  top: 120rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  z-index: 1000;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
}

.close {
  font-size: 44rpx;
  line-height: 1;
  color: #9ca3af;
}

.modal-body {
  flex: 1;
  overflow: hidden;
}

.summary-bar {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.summary-tag {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  background: #f3f4f6;
  color: #4b5563;
}

.summary-tag.ok {
  background: #d1fae5;
  color: #065f46;
}

.summary-tag.err {
  background: #fee2e2;
  color: #991b1b;
}

.result-item {
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 14rpx;
  margin-bottom: 12rpx;
}

.result-row {
  display: flex;
  padding: 6rpx 0;
}

.result-label {
  font-size: 26rpx;
  color: #6b7280;
  width: 140rpx;
  flex-shrink: 0;
}

.result-val {
  font-size: 26rpx;
  color: #1f2937;
  flex: 1;
}

.result-val.green {
  color: #059669;
  font-weight: 600;
}

.result-val.red {
  color: #dc2626;
  font-weight: 600;
}

.modal-footer {
  margin-top: 16rpx;
}
</style>