const promisePool = require('../../config/promisepool')

const WARNING_FIELDS = [
    'humi_warn',
    'smog_warn',
    'fan_warn',
    'air_warn',
    'outage_overtime'
]

function buildErrorMessage(info) {
    if (info.e_msg) {
        return String(info.e_msg)
    }

    const warnings = WARNING_FIELDS
        .filter(key => info[key] != null && info[key] !== '')
        .map(key => `${key}:${info[key]}`)

    if (warnings.length > 0) {
        return warnings.join('; ')
    }

    return JSON.stringify(info)
}

async function saveErrorMsg(info) {
    // Build a concise error message when the device does not provide one.
    const params = [
        info.VID ?? info.d_no ?? info.DNO ?? null,
        info.c_time ?? null,
        buildErrorMessage(info),
        info.e_no ?? info.error_no ?? null,
        info.type ?? null,
    ]

    try {
        await promisePool.execute(
            `INSERT INTO t_error_msg (d_no, c_time, e_msg, e_no, type) VALUES (?, ?, ?, ?, ?)`,
            params
        )
        console.log('[ErrorHistory] Data saved to database successfully')
        return true
    } catch (err) {
        console.error('[ErrorHistory] Failed to save data:', err.message)
        throw err
    }
}

async function getErrorMsgByDevice(limit = 100) {
    try {
        const [rows] = await promisePool.query(
            `SELECT * FROM t_error_msg ORDER BY c_time DESC LIMIT ?`,
            [limit]
        )
        return rows
    } catch (err) {
        console.error('[ErrorHistory] Failed to query data:', err.message)
        throw err
    }
}

module.exports = {
    saveErrorMsg,
    getErrorMsgByDevice
}
