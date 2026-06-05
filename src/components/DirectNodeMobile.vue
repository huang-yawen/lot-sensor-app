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
</style>