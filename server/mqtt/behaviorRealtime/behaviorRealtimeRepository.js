const promisePool = require('../../config/dbPool')

/**
 * 从行为数据或 t_device 表获取设备编号，不硬编码
 */
async function getDeviceNo(info) {
    if (info.VID) return String(info.VID).trim()
    if (info.d_no) return String(info.d_no).trim()
    if (info.DNO) return String(info.DNO).trim()
    // 从 t_device 表取第一个设备编号
    try {
        const [rows] = await promisePool.query(
            'SELECT `number` FROM `t_device` ORDER BY `id` ASC LIMIT 1'
        )
        if (rows && rows.length > 0) {
            return String(rows[0].number).trim()
        }
    } catch (err) {
        console.error('[BehaviorRealtime] 查询默认设备编号失败:', err.message)
    }
    return 'default_device'
}

async function saveBehaviorData(info) {
    const d_no = await getDeviceNo(info)

    const params = [
        d_no,
        info.mode ?? null,
        info.fan ?? null,
        info.fan_speed ?? null,
        info.air ?? null,
        info.acmode ?? null,
        info.air_power ?? null,
        info.led ?? null,
        info.led_power ?? null,
        info.Time ?? null,
       (String(info.online).trim() === '1' || info.online === true) ? '实时数据' : '保存数据'
    ]

    try {
        await promisePool.execute(
            `INSERT INTO t_behavior_data (d_no, field1, field2, field3, field4, field5, field6, field7, field8, c_time, online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
        )
        console.log('[BehaviorRealtime] Data saved to database successfully, d_no:', d_no)
        return true
    } catch (err) {
        console.error('[BehaviorRealtime] Failed to save data:', err.message)
        throw err
    }
}

async function getBehaviorDataByDevice(limit = 100) {
    try {
        const [rows] = await promisePool.query(
            `SELECT * FROM t_behavior_data ORDER BY c_time DESC LIMIT ?`,
            [limit]
        )
        return rows
    } catch (err) {
        console.error('[BehaviorRealtime] Failed to query data:', err.message)
        throw err
    }
}

module.exports = {
    saveBehaviorData,
    getBehaviorDataByDevice
}
