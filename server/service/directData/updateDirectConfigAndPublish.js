/**
 * 直接指令更新服务
 * 
 * 流程：
 * 1. 保存指令配置到数据库
 * 2. 通过 MQTT 发送指令到设备
 * 3. 如果设备离线，暂存指令等待上线后发送
 * 
 * 使用方式：
 *   POST /api/directData/update
 *   Body: { config_id, value, d_no }
 */

const promisePool = require('../../config/promisepool')
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
      return { [key]: value }
    }
  }

  // 开关类型值映射
  const mappedValue = SWITCH_IDS.includes(Number(configId)) && SWITCH_MAP[value]
    ? SWITCH_MAP[value]
    : value

  return { [key]: mappedValue }
}

/**
 * 处理指令更新请求
 * POST /directData/update
 */
module.exports = async (req, res) => {
  try {
    const { config_id, value, d_no } = req.body

    // 参数校验
    if (config_id === undefined || config_id === null || config_id === '') {
      return res.status(400).json({ success: false, message: 'config_id 必填' })
    }

    console.log('[DirectUpdate] 保存配置:', { config_id, value, d_no })

    // 1. 保存到数据库
    const saveResult = await saveDirectData({ config_id, value, d_no })

    // 2. 构建 MQTT 消息
    const payload = buildPayload(config_id, value)

    // 3. 检查设备在线状态
    const deviceId = saveResult.d_no
    if (deviceId && deviceId !== 'null' && !mqttClient.checkIfAlive(deviceId)) {
      // 设备离线 -> 暂存指令
      console.log(`[DirectUpdate] 设备 ${deviceId} 离线，指令暂存`)
      mqttClient.addPendingCommand(deviceId, config_id, value)

      return res.json({
        success: true,
        message: '配置已保存，设备离线，指令将在上线后自动发送',
        data: { db: saveResult, status: 'queued' }
      })
    }

    // 4. 设备在线 -> 直接发送
    try {
      await mqttClient.publish('control', payload)
      console.log('[DirectUpdate] MQTT 发送成功')

      return res.json({
        success: true,
        message: '配置已保存并发送',
        data: { db: saveResult, status: 'published' }
      })
    } catch (err) {
      console.error('[DirectUpdate] MQTT 发送失败:', err.message)
      return res.json({
        success: true,
        message: '配置已保存，但 MQTT 发送失败',
        data: { db: saveResult, status: 'failed', error: err.message }
      })
    }

  } catch (err) {
    console.error('[DirectUpdate] 服务器错误:', err)
    return res.status(500).json({
      success: false,
      message: err.message || '保存配置失败'
    })
  }
}