const promisePool = require('../../config/promisepool')
const mqttClient = require('../../mqtt')
const { saveDirectData } = require('./saveDirectConfig')

const DEFAULT_DIRECT_TOPIC = 'control'

const configIdMapping = {
   0: 'mode',          // 控制模式 
   1: 'air',             // 空调开关 (Air Conditioner Switch) 
   2: 'fan',            // 风机开关 
   3: 'speed_fan',             // 风机功率 
   4: 'acMode',               // 空调模式  
   5: 'power_air',              // 空调功率 
   6: 'TG',       // 温差 (Temperature Difference) 
   7: 'TinDH',     // 温度上限阈值 
   8: 'TinDL',    // 温度下限阈值 
   9: 'led', // 可调灯开关 
   10: 'LXD',     // 光照阈值 (Lux/Illuminance) 
   11: 'bright_led',           // 亮度 (Brightness) 
   12: 'TBegin',                // 时间 (Time) 
   13: 'TEnd',               // 时间 (Time) 
   14: 'calibrate'          // 校准时间 (Calibration Time)
}

const SWITCH_TYPES = [0, 1, 2, 4, 9]

const VALUE_MAPPING = {
    'on': 'open',
    'off': 'close'
}

function mapSwitchValue(value) {
    if (VALUE_MAPPING[value] !== undefined) {
        return VALUE_MAPPING[value]
    }
    return value
}

const getDirectConfig = async (configId) => {
    try {
        const [[config]] = await promisePool.query(
            `SELECT id, t_name, f_type, topic, preffix FROM t_direct_config WHERE id = ? LIMIT 1`,
            [configId]
        )
        return config || null
    } catch (err) {
        console.warn('Query direct config metadata failed, using defaults:', err.message)
        return null
    }
}

const buildMessage = (status) => {
    if (status === 'queued') return '配置保存成功，设备离线，消息已排队。'
    if (status === 'failed') return '配置保存成功，MQTT发送失败。'
    return '配置保存成功。'
}

module.exports = async (req, res) => {
    try {
        const { config_id, value, d_no } = req.body

        if (config_id === undefined || config_id === null || config_id === '') {
            return res.status(400).json({ success: false, message: 'config_id必填' })
        }

        console.log('[Direct Update] Saving config:', { config_id, value, d_no })

        const saveResult = await saveDirectData({ config_id, value, d_no })
        const config = await getDirectConfig(config_id)
        const topic = DEFAULT_DIRECT_TOPIC
        const isGlobalConfig = saveResult.d_no === null
        const mode = isGlobalConfig ? 1 : 0

        const propertyName = configIdMapping[config_id] || `unknown_${config_id}`
        const isSwitchType = SWITCH_TYPES.includes(Number(config_id))
        const mappedValue = isSwitchType ? mapSwitchValue(value) : value
        
        console.log('[Direct Update] Value mapping debug:', {
            config_id,
            isSwitchType,
            originalValue: value,
            mappedValue
        })
        
        // 校准时间特殊处理：value 是 JSON 字符串如 {"set":"2026-6-9-2 15:41:10"} 或 {"real":"..."}
        // 直接解析并作为 payload 发送，不包装在 {calibrate: ...} 中
        let payload
        if (Number(config_id) === 14) {
            try {
                // value 可能已经是对象（如果前端直接传对象），也可能是 JSON 字符串
                payload = typeof value === 'string' ? JSON.parse(value) : value
            } catch (e) {
                console.warn('[Direct Update] 校准时间 JSON 解析失败，使用原始值:', value)
                payload = { [propertyName]: mappedValue }
            }
        } else {
            payload = {
                [propertyName]: mappedValue
            }
        }

        console.log('[Direct Update] Publish MQTT:', {
            topic,
            d_no: saveResult.d_no,
            payload,
            isConnected: mqttClient.isConnected
        })

        // 检查设备是否在线（针对设备专属指令）
        const deviceId = saveResult.d_no
        let isDeviceOnline = true
        if (deviceId && deviceId !== 'null') {
            isDeviceOnline = mqttClient.checkIfAlive(deviceId)
        }

        if (!isDeviceOnline) {
            // 设备离线，将指令暂存到内存队列
            console.log(`[Direct Update] 设备 ${deviceId} 离线，指令暂存等待上线后发送`)
            mqttClient.addPendingCommand(deviceId, config_id, mappedValue)
            
            return res.json({
                success: true,
                message: '配置保存成功，设备离线，指令已暂存，设备上线后自动发送。',
                data: {
                    db: saveResult,
                    mqtt: { status: 'queued', deviceId, reason: 'device_offline' }
                }
            })
        }

        try {
            const publishResult = await mqttClient.publishJsonToDevice(
                saveResult.d_no,
                topic,
                payload,
                { qos: 1, retain: false }
            )

            console.log('[Direct Update] MQTT publish SUCCESS:', {
                topic,
                status: publishResult.status,
                deviceId: publishResult.deviceId,
                queueLength: publishResult.queueLength || 0
            })

            return res.json({
                success: true,
                message: buildMessage(publishResult.status),
                data: {
                    db: saveResult,
                    mqtt: publishResult
                }
            })
        } catch (err) {
            console.error('[Direct Update] MQTT publish failed:', err.message)
            return res.json({
                success: true,
                message: buildMessage('failed'),
                data: {
                    db: saveResult,
                    mqtt: { status: 'failed', reason: err.message }
                }
            })
        }
    } catch (err) {
        console.error('[Direct Update] Server error:', err)
        return res.status(500).json({
            success: false,
            message: err.message || '保存配置失败'
        })
    }
}
