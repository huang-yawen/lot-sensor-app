<template>
  <view class="page safe-area-bottom">
    <view class="header">
      <text class="title">指令配置中心</text>
    <navigator class="jump-link" url="/pages/menuCenter/menuCenter">返回上一级</navigator>
    </view>

    <!-- ========== 全局指令配置（多设备时取消注释） ========== -->
    
    <!-- <view class="section-card">
      <text class="section-title">全局指令配置</text>
      <view class="state" v-if="loading">加载中...</view>
      <view class="state" v-else-if="!sourceNodes.length">暂无指令结构数据</view>
      <view v-else>
        <DirectNodeMobile
          v-for="node in sourceNodes"
          :key="`global-${node.id}`"
          :node="node"
          :form-data="globalFormData"
          :target-id="'null'"
          :on-update="handleUpdate"
        />
      </view>
    </view> -->
   

    <!-- ========== 设备指令配置（单设备/多设备通用） ========== -->
    <view class="section-card">
      <view class="section-head-row">
        <text class="section-title">设备指令配置</text>
      </view>

      <view class="picker-row" v-if="!hideDevicePicker">
        <text class="picker-label">电车编号ID</text>
        <picker
          class="picker"
          mode="selector"
          :range="ids"
          :value="selectedIndex"
          @change="onDeviceChange"
        >
          <view class="picker-value">
            <text>{{ selectedDeviceId || "请选择设备" }}</text>
          </view>
        </picker>
      </view>

      <view class="state" v-if="!selectedDeviceId">请选择设备以配置指令</view>
      <view class="state" v-else-if="loading">加载中...</view>
      <view v-else>
        <DirectNodeMobile
          v-for="node in sourceNodes"
          :key="`device-${selectedDeviceId}-${node.id}`"
          :node="node"
          :form-data="deviceFormData"
          :target-id="selectedDeviceId"
          :on-update="handleUpdate"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from "vue"
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app"
import DirectNodeMobile from "../../components/DirectNodeMobile.vue"
import { directStore } from "../../stores/directStore"
import { deviceStore } from "../../stores/deviceStore"
import { displayStore } from "../../stores/displayStore"
import { shouldHideField } from "../../utils/fieldVisibility"

const direct = directStore()
const device = deviceStore()
const visibility = displayStore()

// ============================================================
// 单设备/多设备模式
// 从后端 /directRender 接口的 singleDeviceMode 字段获取
// 修改 server/.env 中的 SINGLE_DEVICE_MODE 即可全局切换
// ============================================================
const loading = ref(false)
const singleDeviceMode = ref(true) // 默认单设备模式，从后端获取后更新
const selectedDeviceId = ref("")
const hideDevicePicker = computed(() => {
  // 单设备模式：隐藏下拉框
  if (singleDeviceMode.value) return true
  // 多设备模式：根据字段可见性配置决定
  return shouldHideField("电车编号ID", visibility)
})

const globalFormData = reactive({})
const deviceFormData = reactive({})

const ids = computed(() => {
  return Array.isArray(device.ids) ? device.ids.map((item) => String(item)) : []
})

const selectedIndex = computed(() => {
  if (!selectedDeviceId.value) return 0
  const idx = ids.value.findIndex((item) => item === selectedDeviceId.value)
  return idx >= 0 ? idx : 0
})

const sourceNodes = computed(() => {
  const list = Array.isArray(direct.data) ? direct.data : []
  return [...list].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  )
})

const clearFormData = (target) => {
  Object.keys(target).forEach((key) => {
    delete target[key]
  })
}

const defaultNodeValue = (node) => {
  let def = ""
  if (node?.f_value) {
    def = node.f_value.split("|")[0]?.split(":")[1] ?? ""
  }
  if (String(node?.f_type) === "2" || String(node?.f_type) === "3") {
    return Number(def || node?.min || 0)
  }
  return def
}

const initNode = (node, renderData, targetForm) => {
  if (!node) return

  const dbItem = renderData.find(
    (item) => String(item.config_id) === String(node.id),
  )
  targetForm[node.id] =
    dbItem && dbItem.value !== null && dbItem.value !== undefined
      ? dbItem.value
      : defaultNodeValue(node)

  if (node.children) {
    Object.values(node.children)
      .flat()
      .forEach((child) => initNode(child, renderData, targetForm))
  }
}

const initializeForm = async (targetId, targetForm) => {
  const result = await direct.handleRender(targetId)
  // 从后端获取单设备模式配置
  if (result.singleDeviceMode !== undefined) {
    singleDeviceMode.value = result.singleDeviceMode
  }
  const latestRenderData = result.data || []
  clearFormData(targetForm)

  sourceNodes.value.forEach((node) => {
    initNode(node, latestRenderData, targetForm)
  })
}

const initializeBaseData = async () => {
  await Promise.all([
    device.fetchDeviceData({ currentPage: 1, pageSize: 999 }),
    direct.fetchDirectData(),
  ])
}

const handleUpdate = async (id, value, targetId = "null") => {
  try {
    // 总是传 d_no，后端根据 SINGLE_DEVICE_MODE 决定是否使用
    // targetId 为 "null" 字符串时，传 d_no: "null" 表示全局指令
    // targetId 为设备号时，传 d_no: 设备号
    const params = { id, value, d_no: targetId || "null" }
    console.log('[CommandConfig] handleUpdate params:', JSON.stringify(params))
    await direct.handleUpdateData(params)
  } catch (error) {
    uni.showToast({ title: "保存失败，请稍后重试", icon: "none" })
  }
}

const onDeviceChange = async (event) => {
  const idx = Number(event.detail.value || 0)
  selectedDeviceId.value = ids.value[idx] || ""

  if (selectedDeviceId.value) {
    loading.value = true
    try {
      await initializeForm(selectedDeviceId.value, deviceFormData)
    } finally {
      loading.value = false
    }
  }
}

const reloadAll = async () => {
  loading.value = true
  try {
    await initializeBaseData()

    // 初始化全局指令表单（多设备模式下使用）
    await initializeForm("null", globalFormData)

    // 单设备模式：自动选中第一个设备
    if (singleDeviceMode.value && ids.value.length > 0 && !selectedDeviceId.value) {
      selectedDeviceId.value = ids.value[0]
    }

    // 如果已有选中的设备，初始化该设备的表单
    if (selectedDeviceId.value) {
      await initializeForm(selectedDeviceId.value, deviceFormData)
    }
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onLoad(async () => {
  await reloadAll()
})

onPullDownRefresh(async () => {
  await reloadAll()
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

.jump-link {
  font-size: 24rpx;
  color: #2563eb;
  background: #eaf2ff;
  border: 2rpx solid #bfdbfe;
  border-radius: 12rpx;
  padding: 10rpx 16rpx;
  line-height: 1;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
}

.section-card {
  background: #ffffff;
  border: 2rpx solid #dbeafe;
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.section-head-row {
  margin-bottom: 8rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #1f2937;
}

.picker-row {
  margin: 16rpx 0 20rpx;
}

.picker-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 26rpx;
  color: #4b5563;
}

.picker-value {
  height: 74rpx;
  border: 2rpx solid #dbeafe;
  border-radius: 14rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 18rpx;
  font-size: 26rpx;
  color: #1f2937;
}

.state {
  min-height: 100rpx;
  display: flex;
  align-items: center;
  color: #9ca3af;
  font-size: 26rpx;
}
</style>
