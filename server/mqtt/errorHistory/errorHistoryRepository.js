const promisePool = require('../../config/promisepool')

const WARNING_FIELD_MAP = {
    'humi_warn': '湿度',
    'smog_warn': '烟雾',
    'fan_warn': '风机',
    'air_warn': '空调',
    'outage_overtime': '断电超时'
}

function buildErrorMessageAndType(info) {
    if (info.e_msg) {
        return {
            e_msg: String(info.e_msg),
            type: info.type ?? null
        }
    }

    const messages = []
    const types = []

    for (const [field, name] of Object.entries(WARNING_FIELD_MAP)) {
        const value = info[field]
        if (value != null && value !== '') {
            const isAbnormal = value === 1 || value === '1'
            messages.push(`${name}${isAbnormal ? '异常' : '无异常'}`)
            if (isAbnormal) {
                types.push(`${name}异常`)
            }
        }
    }

    return {
        e_msg: messages.length > 0 ? messages.join('，') : JSON.stringify(info),
        type: types.length > 0 ? types.join('，') : null
    }
}

async function saveErrorMsg(info) {
    // Build a concise error message when the device does not provide one.
// {"humi_warn":"0","fan_warn":"0","Time":"2026-05-22 10:52:53","online":"1"}
// 湿度超标，风机异常
    const { e_msg, type } = buildErrorMessageAndType(info)
    
    const params = [
        '202177',
        info.Time ?? null,
        e_msg,
        info.e_no ?? info.error_no ?? null,
        type,
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
