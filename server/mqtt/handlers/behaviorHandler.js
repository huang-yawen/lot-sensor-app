/**
 * 行为数据处理器
 * 
 * 收到行为数据后，解析并存入数据库
 */

const promisePool = require('../../config/promisepool')

/** 行为数据主题 */
const BEHAVIOR_TOPIC = 'behavioral_data'

/**
 * 处理行为数据消息
 * @param {string} topic - 主题
 * @param {Buffer} payload - 消息内容
 * @returns {Promise<Object|null>} 处理后的数据
 */
async function handleBehaviorData(topic, payload) {
  try {
    const data = JSON.parse(payload.toString())
    console.log('[BehaviorHandler] 收到行为数据:', JSON.stringify(data).slice(0, 200))

    // 存入数据库
    const { d_no, ...fields } = data
    if (d_no) {
      const columns = Object.keys(fields)
      const values = Object.values(fields)
      const placeholders = columns.map(() => '?').join(', ')
      const colNames = columns.join(', ')

      await promisePool.query(
        `INSERT INTO t_behavior_realtime (d_no, ${colNames}) VALUES (?, ${placeholders})`,
        [d_no, ...values]
      )
    }

    return data
  } catch (err) {
    console.error('[BehaviorHandler] 处理失败:', err.message)
    return null
  }
}

module.exports = { handleBehaviorData, BEHAVIOR_TOPIC }