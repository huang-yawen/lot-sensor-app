<template>
  <view class="dynamic-node" v-if="!shouldHideField(node?.t_name, visibility)">
    <view class="node-header">
      <text class="node-title">{{ node?.t_name || "未命名指令" }}</text>
    </view>

    <view class="node-component">
      <view v-if="nodeType === '1'" class="switch-wrap">
        <text class="switch-label">{{ inactiveText }}</text>
        <switch
          :checked="switchChecked"
          @change="onSwitchChange"
          color="#2563eb"
        />
        <text class="switch-label">{{ activeText }}</text>
      </view>

      <view v-else-if="nodeType === '2'" class="input-wrap">
        <input
          class="node-input"
          type="number"
          :value="stringValue"
          @input="onInputChange"
          @blur="onInputBlur"
        />
      </view>

      <view v-else-if="nodeType === '3'" class="slider-wrap">
        <slider
          :value="numberValue"
          :min="minValue"
          :max="maxValue"
          activeColor="#2563eb"
          block-size="20"
          @changing="onSliderChanging"
          @change="onSliderChange"
        />
        <text class="slider-value">{{ numberValue }}</text>
      </view>

      <view v-else-if="nodeType === '4'" class="time-picker-wrap">
        <picker
          mode="multiSelector"
          :range="timeColumns"
          :value="pickerIndex"
          @change="onTimeChange"
          @columnchange="onColumnChange"
        >
          <view class="time-picker-value">
            <text>{{ stringValue || "选择时间" }}</text>
          </view>
        </picker>
      </view>

      <!-- f_type=6: 校准时间组件（完整日期时间选择器） -->
      <view v-else-if="nodeType === '6'" class="calibrate-wrap">
        <!-- 模式指示 -->
        <view class="calibrate-mode-tip">
          <text class="mode-badge" :class="isManualMode ? 'mode-manual' : 'mode-auto'">
            {{ isManualMode ? '手动' : '自动' }}
          </text>
          <text class="mode-desc">{{ isManualMode ? '请选择校准时间' : '自动获取当前北京时间' }}</text>
        </view>

        <!-- 手动模式：显示完整日期时间选择器 -->
        <view v-if="isManualMode" class="datetime-picker-row">
          <!-- 年 -->
          <picker mode="selector" :range="years" :value="calYearIdx" @change="onCalYearChange" class="cal-picker">
            <view class="cal-picker-value">{{ calYearVal }}年</view>
          </picker>
          <!-- 月 -->
          <picker mode="selector" :range="months" :value="calMonthIdx" @change="onCalMonthChange" class="cal-picker">
            <view class="cal-picker-value">{{ calMonthVal }}月</view>
          </picker>
          <!-- 日 -->
          <picker mode="selector" :range="days" :value="calDayIdx" @change="onCalDayChange" class="cal-picker">
            <view class="cal-picker-value">{{ calDayVal }}日</view>
          </picker>
          <!-- 周 -->
          <picker mode="selector" :range="weeks" :value="calWeekIdx" @change="onCalWeekChange" class="cal-picker">
            <view class="cal-picker-value">{{ calWeekVal }}</view>
          </picker>
        </view>
        <view v-if="isManualMode" class="datetime-picker-row">
          <!-- 时 -->
          <picker mode="selector" :range="hours" :value="calHourIdx" @change="onCalHourChange" class="cal-picker">
            <view class="cal-picker-value">{{ calHourVal }}时</view>
          </picker>
          <!-- 分 -->
          <picker mode="selector" :range="minutes" :value="calMinIdx" @change="onCalMinChange" class="cal-picker">
            <view class="cal-picker-value">{{ calMinVal }}分</view>
          </picker>
          <!-- 秒 -->
          <picker mode="selector" :range="seconds" :value="calSecIdx" @change="onCalSecChange" class="cal-picker">
            <view class="cal-picker-value">{{ calSecVal }}秒</view>
          </picker>
        </view>

        <!-- 自动模式：显示当前北京时间（只读） -->
        <view v-else class="auto-time-display">
          <text class="auto-time-text">{{ beijingTimeStr }}</text>
        </view>

        <!-- 提交按钮（仅手动模式显示） -->
        <view class="cal-submit-row" v-if="isManualMode">
          <button class="cal-submit-btn" @click="onCalibrateSubmit" :disabled="calSubmitting">
            {{ calSubmitting ? '提交中...' : '校准时间' }}
          </button>
        </view>
      </view>

      <view v-else class="readonly-wrap">
        <input class="node-input" :value="stringValue" disabled />
      </view>
    </view>

    <view class="node-children" v-if="matchedChildGroups.length">
      <view v-for="[refKey, children] in matchedChildGroups" :key="refKey">
        <DirectNodeMobile
          v-for="child in sortNodes(children)"
          :key="child.id"
          :node="child"
          :form-data="formData"
          :target-id="targetId"
          :on-update="onUpdate"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch, onMounted } from "vue"
import { displayStore } from "../stores/displayStore"
import { shouldHideField } from "../utils/fieldVisibility"

defineOptions({ name: "DirectNodeMobile" })
const visibility = displayStore()

const props = defineProps({
  node: { type: Object, required: true },
  formData: { type: Object, required: true },
  targetId: { type: [Number, String], default: "null" },
  onUpdate: { type: Function, required: true },
})

const nodeType = computed(() => String(props.node?.f_type ?? "default"))

// ==================== 1. 初始化时分秒多列数据 ====================
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const seconds = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const timeColumns = [hours, minutes, seconds] // 传给 picker 的 :range

// 存储当前 picker 弹窗高亮选中的索引 [时, 分, 秒]
const pickerIndex = ref([0, 0, 0])

// ==================== 2. 解析和同步当前表单的值 ====================
const currentValue = computed(() => props.formData?.[props.node.id])
const stringValue = computed(() => String(currentValue.value ?? ""))

// 监听表单数据的变化，把 "12:30:15" 这种字符串转换为 picker 需要的索引 [12, 30, 15]
watch(stringValue, (newVal) => {
  if (newVal && newVal.includes(':')) {
    const parts = newVal.split(':')
    const hIdx = hours.indexOf(parts[0])
    const mIdx = minutes.indexOf(parts[1])
    const sIdx = seconds.indexOf(parts[2])
    pickerIndex.value = [
      hIdx !== -1 ? hIdx : 0,
      mIdx !== -1 ? mIdx : 0,
      sIdx !== -1 ? sIdx : 0
    ]
  } else {
    pickerIndex.value = [0, 0, 0]
  }
}, { immediate: true })

// ==================== 3. 事件处理 ====================
// 当用户滚动某一列时，实时更新高亮索引
const onColumnChange = (event) => {
  pickerIndex.value[event.detail.column] = event.detail.value
}

// 当用户点击“确定”时，拼接成 hh:mm:ss 提交
const onTimeChange = async (event) => {
  const selectedIndexes = event.detail.value
  const h = hours[selectedIndexes[0]] || '00'
  const m = minutes[selectedIndexes[1]] || '00'
  const s = seconds[selectedIndexes[2]] || '00'
  
  const finalTimeStr = `${h}:${m}:${s}`
  await commitValue(finalTimeStr)
}

// ==================== 以下为你原有的其余逻辑（保持不变） ====================
const parseOptions = (value) => {
  return (
    value?.split("|").map((item) => {
      const [label, val] = item.split(":")
      return { label: label || "", value: val || "" }
    }) || []
  )
}

const options = computed(() => parseOptions(props.node?.f_value))
const inactive = computed(() => options.value[0] || { label: "关", value: "off" })
const active = computed(() => options.value[1] || { label: "开", value: "on" })

const inactiveText = computed(() => String(inactive.value.label))
const activeText = computed(() => String(active.value.label))
const inactiveValue = computed(() => String(inactive.value.value))
const activeValue = computed(() => String(active.value.value))

const minValue = computed(() => Number(props.node?.min ?? 0))
const maxValue = computed(() => Number(props.node?.max ?? 100))
const numberValue = computed(() => Number(currentValue.value ?? minValue.value))

const switchChecked = computed(() => String(currentValue.value) === activeValue.value)

const setLocal = (value) => {
  props.formData[props.node.id] = value
}

const commitValue = async (value) => {
  setLocal(value)
  await props.onUpdate(props.node.id, value, props.targetId)
}

const onSwitchChange = async (event) => {
  const checked = !!event.detail.value
  const nextValue = checked ? activeValue.value : inactiveValue.value
  await commitValue(nextValue)
}

const onInputChange = (event) => {
  setLocal(event.detail.value)
}

const onInputBlur = async (event) => {
  const value = event.detail.value
  await commitValue(value)
}

const onSliderChanging = (event) => {
  setLocal(Number(event.detail.value))
}

const onSliderChange = async (event) => {
  const value = Number(event.detail.value)
  await commitValue(value)
}

// ==================== f_type=6: 校准时间组件逻辑 ====================

// 判断是否为手动模式：查找父级 formData 中 config_id=0 的值
// 控制模式 config_id=0，手动=off，自动=on
const isManualMode = computed(() => {
  // 尝试从 formData 中获取控制模式的值（config_id=0）
  const modeVal = props.formData?.[0]
  return String(modeVal) === 'off'
})

// 日期时间数据
const years = Array.from({ length: 11 }, (_, i) => String(2020 + i))
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 根据年月计算天数
function getDaysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate()
}

const days = computed(() => {
  const y = calYearVal.value || '2026'
  const m = calMonthVal.value || '06'
  const dayCount = getDaysInMonth(y, m)
  return Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0'))
})

// 校准时间的响应式状态
const calYearVal = ref('2026')
const calMonthVal = ref('06')
const calDayVal = ref('09')
const calWeekVal = ref('周二')
const calHourVal = ref('00')
const calMinVal = ref('00')
const calSecVal = ref('00')

const calYearIdx = computed(() => {
  const idx = years.indexOf(calYearVal.value)
  return idx >= 0 ? idx : 0
})
const calMonthIdx = computed(() => {
  const idx = months.indexOf(calMonthVal.value)
  return idx >= 0 ? idx : 0
})
const calDayIdx = computed(() => {
  const idx = days.value.indexOf(calDayVal.value)
  return idx >= 0 ? idx : 0
})
const calWeekIdx = computed(() => {
  const idx = weeks.indexOf(calWeekVal.value)
  return idx >= 0 ? idx : 0
})
const calHourIdx = computed(() => {
  const idx = hours.indexOf(calHourVal.value)
  return idx >= 0 ? idx : 0
})
const calMinIdx = computed(() => {
  const idx = minutes.indexOf(calMinVal.value)
  return idx >= 0 ? idx : 0
})
const calSecIdx = computed(() => {
  const idx = seconds.indexOf(calSecVal.value)
  return idx >= 0 ? idx : 0
})

// 初始化默认值为当前北京时间
function initBeijingTime() {
  const now = new Date()
  // 北京时间 = UTC+8
  const bjOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const bjTime = new Date(now.getTime() + (bjOffset + localOffset) * 60000)
  
  const y = String(bjTime.getFullYear())
  const m = String(bjTime.getMonth() + 1).padStart(2, '0')
  const d = String(bjTime.getDate()).padStart(2, '0')
  const w = weeks[bjTime.getDay()]
  const h = String(bjTime.getHours()).padStart(2, '0')
  const min = String(bjTime.getMinutes()).padStart(2, '0')
  const s = String(bjTime.getSeconds()).padStart(2, '0')
  
  calYearVal.value = y
  calMonthVal.value = m
  calDayVal.value = d
  calWeekVal.value = w
  calHourVal.value = h
  calMinVal.value = min
  calSecVal.value = s
}

// 当前北京时间字符串（自动模式显示用）
const beijingTimeStr = ref('')
let beijingTimer = null

function updateBeijingTimeStr() {
  const now = new Date()
  const bjOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const bjTime = new Date(now.getTime() + (bjOffset + localOffset) * 60000)
  
  const y = String(bjTime.getFullYear())
  const m = String(bjTime.getMonth() + 1).padStart(2, '0')
  const d = String(bjTime.getDate()).padStart(2, '0')
  const w = weeks[bjTime.getDay()]
  const h = String(bjTime.getHours()).padStart(2, '0')
  const min = String(bjTime.getMinutes()).padStart(2, '0')
  const s = String(bjTime.getSeconds()).padStart(2, '0')
  
  beijingTimeStr.value = `${y}-${m}-${d} ${w} ${h}:${min}:${s}`
}

onMounted(() => {
  initBeijingTime()
  updateBeijingTimeStr()
  // 每秒更新北京时间
  beijingTimer = setInterval(updateBeijingTimeStr, 1000)
})

// 选择器变更事件
const onCalYearChange = (e) => {
  calYearVal.value = years[e.detail.value]
}
const onCalMonthChange = (e) => {
  calMonthVal.value = months[e.detail.value]
}
const onCalDayChange = (e) => {
  calDayVal.value = days.value[e.detail.value]
}
const onCalWeekChange = (e) => {
  calWeekVal.value = weeks[e.detail.value]
}
const onCalHourChange = (e) => {
  calHourVal.value = hours[e.detail.value]
}
const onCalMinChange = (e) => {
  calMinVal.value = minutes[e.detail.value]
}
const onCalSecChange = (e) => {
  calSecVal.value = seconds[e.detail.value]
}

// 提交校准时间
const calSubmitting = ref(false)

const onCalibrateSubmit = async () => {
  if (calSubmitting.value) return
  calSubmitting.value = true
  
  try {
    // 手动模式：发送用户选择的时间（周：weeks索引0=周日→7，1=周一→1，...6=周六→6）
    const weekNum = calWeekIdx.value === 0 ? 7 : calWeekIdx.value
    const timeStr = `${calYearVal.value}-${calMonthVal.value}-${calDayVal.value}-${weekNum} ${calHourVal.value}:${calMinVal.value}:${calSecVal.value}`
    const payload = { set: timeStr }
    
    await props.onUpdate(props.node.id, JSON.stringify(payload), props.targetId)
    
    uni.showToast({ title: '校准时间已发送', icon: 'success' })
  } catch (err) {
    console.error('[Calibrate] 提交失败:', err)
    uni.showToast({ title: '发送失败', icon: 'none' })
  } finally {
    calSubmitting.value = false
  }
}

const match = (parentVal, refVal) => {
  if (refVal === "off&on") return true
  return String(parentVal) === String(refVal)
}

const matchedChildGroups = computed(() => {
  const parentVal = props.formData?.[props.node.id]
  const groups = props.node?.children || {}
  return Object.entries(groups).filter(([refKey]) => match(parentVal, refKey))
})

const sortNodes = (nodes) => {
  return [...nodes].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
}
</script>

<style>
/* 保持你原本的样式不变 */
.dynamic-node { margin-bottom: 16rpx; padding-left: 16rpx; border-left: 2rpx dashed #dbeafe; }
.node-header { margin-bottom: 10rpx; }
.node-title { font-size: 28rpx; color: #1f2937; font-weight: 500; }
.node-component { margin-bottom: 12rpx; }
.switch-wrap { display: flex; align-items: center; gap: 14rpx; }
.switch-label { font-size: 24rpx; color: #4b5563; }
.input-wrap, .readonly-wrap { width: 320rpx; }
.node-input { height: 68rpx; border: 2rpx solid #dbeafe; border-radius: 12rpx; background: #ffffff; padding: 0 16rpx; font-size: 26rpx; color: #1f2937; }
.slider-wrap { width: 100%; }
.slider-value { display: block; margin-top: 6rpx; font-size: 24rpx; color: #6b7280; }
.time-picker-wrap { width: 320rpx; }
.time-picker-value { height: 68rpx; border: 2rpx solid #dbeafe; border-radius: 12rpx; background: #ffffff; padding: 0 16rpx; font-size: 26rpx; color: #1f2937; display: flex; align-items: center; }
.node-children { margin-top: 8rpx; }

/* ==================== f_type=6: 校准时间组件样式 ==================== */
.calibrate-wrap {
  background: #f8faff;
  border: 2rpx solid #dbeafe;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 8rpx;
}

.calibrate-mode-tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.mode-badge {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.mode-manual {
  background: #fef3c7;
  color: #d97706;
  border: 2rpx solid #fcd34d;
}

.mode-auto {
  background: #d1fae5;
  color: #059669;
  border: 2rpx solid #6ee7b7;
}

.mode-desc {
  font-size: 24rpx;
  color: #6b7280;
}

.datetime-picker-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}

.cal-picker {
  flex: 1;
  min-width: 100rpx;
}

.cal-picker-value {
  height: 64rpx;
  border: 2rpx solid #dbeafe;
  border-radius: 12rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #1f2937;
}

.auto-time-display {
  background: #f0f9ff;
  border: 2rpx solid #bae6fd;
  border-radius: 12rpx;
  padding: 20rpx;
  text-align: center;
  margin-bottom: 12rpx;
}

.auto-time-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #0369a1;
  font-family: monospace;
}

.cal-submit-row {
  display: flex;
  justify-content: center;
  margin-top: 8rpx;
}

.cal-submit-btn {
  width: 60%;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 36rpx;
  border: none;
  text-align: center;
}

.cal-submit-btn[disabled] {
  opacity: 0.6;
}
</style>
