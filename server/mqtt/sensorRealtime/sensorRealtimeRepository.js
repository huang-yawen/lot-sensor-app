const promisePool = require('../../config/promisepool')

async function saveSensorData(info) {
    // Map MQTT fields into the sensor history table.
    const params = [
        info.VID ?? null,
        info.PID1 ?? null,
        info.PID2 ?? null,
        info.Tin ?? null,
        info.Tout ?? null,
        info.LXin ?? null,
        info.c_time ?? null,
        info.online ?? null,
    ]

    try {
        await promisePool.execute(
            `INSERT INTO t_sensor_data (d_no, pid1,pid2,field1, field2, field3, c_time, online) VALUES (?, ?, ?, ?,?, ?, ?,?)`,
            params
        )
        console.log('[SensorRealtime] Data saved to database successfully')
        return true
    } catch (err) {
        console.error('[SensorRealtime] Failed to save data:', err.message)
        throw err
    }
}

async function getSensorDataByDevice(limit = 100) {
    try {
        const [rows] = await promisePool.query(
            `SELECT * FROM t_sensor_data ORDER BY c_time DESC LIMIT ?`,
            [limit]
        )
        return rows
    } catch (err) {
        console.error('[SensorRealtime] Failed to query data:', err.message)
        throw err
    }
}

module.exports = {
    saveSensorData,
    getSensorDataByDevice
}
