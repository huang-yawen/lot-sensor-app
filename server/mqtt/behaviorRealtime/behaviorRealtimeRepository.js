const promisePool = require('../../config/dbPool')

async function saveBehaviorData(info) {
    // Keep the database column order aligned with the MQTT payload mapping.
    const params = [
        // info.VID ?? info.d_no ?? info.DNO ?? null,
        // 第三题写成默认的设备编号，因为现在只有一套设备
        '202106',
        info.mode ?? null,
        info.fan ?? null,
        info.fan_speed ?? null,
        info.air ?? null,
        info.acmode ?? null,
        info.air_power ?? null,
        info.led ?? null,
        info.led_power ?? null,
        info.Time ?? null,
       (String(info.online).trim() === '1' || info.online === true) ? '实时数据' : '保留数据'
    ]

    try {
        await promisePool.execute(
            `INSERT INTO t_behavior_data (d_no, field1, field2, field3, field4, field5, field6, field7, field8, c_time, online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
        )
        console.log('[BehaviorRealtime] Data saved to database successfully')
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
