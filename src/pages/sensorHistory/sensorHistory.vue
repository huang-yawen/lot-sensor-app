<template>
  <view class="page safe-area-bottom">
    <view class="header">
      <text class="title">传感器历史数据</text>
    <navigator class="jump-link" url="/pages/menuCenter/menuCenter">统一入口</navigator>
    </view>

    <view class="filter-card">
      <!-- <view class="filter-row">
        <text class="label">设备编号</text>
        <input
          class="input"
          v-model="keyword"
          placeholder="输入设备编号"
          confirm-type="search"
          @confirm="handleSearch(1)"
        />
      </view> -->

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
      </view>
    </view>

    <view class="state" v-if="store.loading">
      <text>加载中...</text>
    </view>
    <view class="state" v-else-if="!dataList.length">
      <text>暂无数据</text>
    </view>

    <scroll-view class="list" scroll-y="true" v-else>
      <view class="data-card" v-for="(item, index) in dataList" :key="index">
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
  </view>
</template>

<script setup>
import { computed, ref } from "vue"
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app"
import { paginationStore } from "../../stores/paginationStore"
import { displayStore } from "../../stores/displayStore"
import { shouldHideField, visibleEntries } from "../../utils/fieldVisibility"
import LineBar from "../../components/LineBar.vue"

const store = paginationStore()
const visibility = displayStore()
const keyword = ref("")
const hideDeviceSelector = computed(() => shouldHideField("设备编号ID", visibility))

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

onLoad(async () => {
  await fetchList(1)
})

onPullDownRefresh(async () => {
  await fetchList(Number(store.currentPage || 1))
  uni.stopPullDownRefresh()
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
  text-align: right;
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
</style>
