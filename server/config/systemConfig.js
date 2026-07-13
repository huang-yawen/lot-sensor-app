/**
 * ============================================================
 *  系统全局配置中心
 *  ============================================================
 *  所有全局可调参数集中在此文件管理。
 *
 *  【使用方式】
 *  1. 修改后调用 POST /api/system-config 接口立即生效（热更新）
 *  2. GET /api/system-config/export 导出配置备份
 *  3. POST /api/system-config/import 导入配置快速切换赛题场景
 *  ============================================================
 */

const defaultConfig = {
  // ==================== 设备模式 ====================
  // true  = 单设备模式（隐藏设备选择器，自动选用第一个设备）
  // false = 多设备模式（显示设备选择器，用户手动选择）
  SINGLE_DEVICE_MODE: true,

  // ==================== 字段可见性 ====================
  // true = 隐藏 ID 字段（表格/卡片不显示 id 列）
  HIDE_ID_FIELDS: false,

  // true = 隐藏编号字段（表格/卡片不显示 d_no/编号等列）
  HIDE_NUMBER_FIELDS: false,

  // ==================== 设备选择器 ====================
  HIDE_DEVICE_SELECTOR: false,

  // ==================== 页面功能开关 ====================
  ENABLE_INTELLIGENT_RECOGNIZE: true,
  ENABLE_CHARTS: true,

  // ==================== 数据展示配置 ====================
  DEFAULT_PAGE_SIZE: 5,
  REALTIME_REFRESH_INTERVAL: 3000,

  // ==================== 场景预设标签 ====================
  SCENE_TAG: '默认场景',
  SCENE_DESCRIPTION: '系统初始默认配置',
}

let currentConfig = JSON.parse(JSON.stringify(defaultConfig))

function getConfig() {
  return currentConfig
}

function updateConfig(partial) {
  if (!partial || typeof partial !== 'object') return false
  let updated = false
  for (const [key, value] of Object.entries(partial)) {
    if (key in currentConfig) {
      currentConfig[key] = value
      updated = true
    }
  }
  if ('SINGLE_DEVICE_MODE' in partial) {
    process.env.SINGLE_DEVICE_MODE = String(currentConfig.SINGLE_DEVICE_MODE)
  }
  return updated
}

function resetConfig() {
  currentConfig = JSON.parse(JSON.stringify(defaultConfig))
  process.env.SINGLE_DEVICE_MODE = String(currentConfig.SINGLE_DEVICE_MODE)
}

function exportConfig() {
  return {
    exportTime: new Date().toISOString(),
    ...currentConfig,
  }
}

function importConfig(config) {
  if (!config || typeof config !== 'object') return false
  const { exportTime, ...rest } = config
  return updateConfig(rest)
}

process.env.SINGLE_DEVICE_MODE = String(currentConfig.SINGLE_DEVICE_MODE)

module.exports = {
  defaultConfig,
  getConfig,
  updateConfig,
  resetConfig,
  exportConfig,
  importConfig,
}