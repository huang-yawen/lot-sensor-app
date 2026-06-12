/**
 * 直接指令更新服务
 * 
 * 流程：
 * 1. 先通过 MQTT 发送指令到设备（或暂存等待上线后发送）
 * 2. 发送成功后再保存到数据库
 * 3. 如果设备离线，暂存指令等待上线后发送，发送成功后再保存到数据库
 * 
 * 使用方式：
 *   POST /api/directData/update
 *   Body: { config_id, value, d_no }
 */

const promisePool = require('../../config/dbPool')
const mqttClient = require('../../mqtt')
const { saveDirectData } = require('./saveDirectConfig')

/** config_id 到 MQTT 属性名的映射 */
const CONFIG_MAP = {
  0: 'mode', 1: 'air', 2: 'fan', 3: 'speed_fan', 4: 'acMode',
  5: 'power_air', 6: 'TG', 7: 'TinDH', 8: 'TinDL', 9: 'led',
  10: 'LXD', 11: 'bright_led', 12: 'TBegin', 13: 'TEnd', 14: 'calibrate'
}

/** 开关类型的 config_id 列表（值需要映射 on->open, off->close） */
const SWITCH_IDS = [0, 1, 2, 4, 9]

/** 开关值映射 */
const SWITCH_MAP = { on: 'open', off: 'close' }

/**
 * 构建 MQTT 消息 payload
 * 所有值统一转为字符串，确保整体为 JSON 格式
 * @param {number} configId
 * @param {*} value
 * @returns {Object}
 */
function buildPayload(configId, value) {
  const key = CONFIG_MAP[configId] || `unknown_${configId}`

  // 校准时间特殊处理：value 是 JSON 字符串
  if (Number(configId) === 14) {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value
    } catch {
      return { [key]: String(value) }
    }
  }

  // 开关类型值映射（on->open, off->close）
  const mappedValue = SWITCH_IDS.includes(Number(configId)) && SWITCH_MAP[value]
    ? SWITCH_MAP[value]
    : String(value)

  return { [key]: mappedValue }
}

/**
 * 处理指令更新请求
 * POST /directData/update
 * 
 * 流程：先发消息（或暂存），成功后再保存到数据库
 */
module.exports = async (req, res) => {
  try {
    const { config_id, value, d_no } = req.body

    // 参数校验
    if (config_id === undefined || config_id === null || config_id === '') {
      return res.status(400).json({ success: false, message: 'config_id 必填' })
    }

    console.log('[DirectUpdate] 收到指令:', { config_id, value, d_no })

    // 1. 构建 MQTT 消息
    const payload = buildPayload(config_id, value)

    // 2. 检查设备在线状态
    const deviceId = d_no && d_no !== 'null' ? d_no : null
    if (deviceId && !mqttClient.checkIfAlive(deviceId)) {
      // 设备离线 -> 暂存指令（不保存到数据库，等上线发送成功后再保存）
      console.log(`[DirectUpdate] 设备 ${deviceId} 离线，指令暂存`)
      mqttClient.addPendingCommand(deviceId, config_id, value)

      return res.json({
        success: true,
        message: '设备离线，指令已暂存，将在上线后自动发送并保存',
        data: { status: 'queued' }
      })
    }

    // 3. 设备在线 -> 先发送指令（发送两次以确保设备可靠接收）
    try {
      // 第一次发送
      await mqttClient.publish('control', payload)
      console.log('[DirectUpdate] MQTT 第一次发送成功')

      // 第二次发送（间隔 200ms，确保设备可靠接收）
      await new Promise(resolve => setTimeout(resolve, 200))
      await mqttClient.publish('control', payload)
      console.log('[DirectUpdate] MQTT 第二次发送成功')

      // 4. 发送成功后再保存到数据库
      const saveResult = await saveDirectData({ config_id, value, d_no })
      console.log('[DirectUpdate] 数据库保存成功:', saveResult)

      return res.json({
        success: true,
        message: '指令已发送并保存到数据库（已发送两次以确保接收）',
        data: { db: saveResult, status: 'published' }
      })
    } catch (err) {
      console.error('[DirectUpdate] MQTT 发送失败:', err.message)
      return res.json({
        success: true,
        message: 'MQTT 发送失败，指令未保存到数据库',
        data: { status: 'failed', error: err.message }
      })
    }

  } catch (err) {
    console.error('[DirectUpdate] 服务器错误:', err)
    return res.status(500).json({
      success: false,
      message: err.message || '处理指令失败'
    })
  }
}
