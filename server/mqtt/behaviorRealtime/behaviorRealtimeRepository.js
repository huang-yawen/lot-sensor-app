const promisePool = require('../../config/promisepool')

async function saveBehaviorData(info) {
    // Keep the database column order aligned with the MQTT payload mapping.
    const params = [
        info.VID ?? info.d_no ?? info.DNO ?? null,
        info.mode ?? null,
        info.fan ?? null,
        info.fan_speed ?? null,
        info.air ?? null,
        info.air_power ?? null,
        info.led ?? null,
        info.led_power ?? null,
        info.c_time ?? null,
        info.online ?? null,
    ]

    try {
        await promisePool.execute(
            `INSERT INTO t_behavior_data (d_no, field1, field2, field3, field4, field5, field6, field7, c_time, online) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
