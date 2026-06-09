/**
 * MQTT客户端类 - 负责与MQTT broker通信，处理消息的发布和订阅
 * 继承自EventEmitter，支持事件驱动的消息处理机制
 */
const mqtt = require('mqtt')
const EventEmitter = require('events')
const promisePool = require('../config/promisepool')

// 导入各主题消息处理器
const { handleMessage: handleSensorData, SENSOR_TOPIC } = require('./sensorRealtime/index')
const { handleMessage: handleBehaviorData, BEHAVIOR_TOPIC } = require('./behaviorRealtime/index')
const { handleMessage: handleErrorData, ERROR_TOPIC } = require('./errorHistory/index')

/**
 * MqttClient类 - MQTT客户端核心类
 * 功能：
 * 1. 建立和管理MQTT连接
 * 2. 订阅指定主题
 * 3. 发布消息（支持消息队列和重发机制）
 * 4. 处理接收到的消息并路由到对应的处理器
 * 5. 设备心跳检测
 */
class MqttClient extends EventEmitter {
    /**
     * 构造函数
     * @param {Object} config - MQTT配置对象
     * @param {string} config.url - MQTT broker地址
     * @param {Object} config.option - MQTT连接选项
     * @param {Array} config.subscribeTopics - 需要订阅的主题列表
     */
    constructor(config) {
        super()
        this.config = config           // 保存配置
        this.isConnected = false       // 连接状态标志
        this.messageQueue = []         // 离线消息队列（连接恢复后发送）
        this.deviceLastAlive = {} // 设备最后活跃时间映射
        this.devicePendingCommands = {} // 设备离线时暂存的指令队列 { d_no: [{config_id, value}] }
        this.deviceOfflineStatus = {}   // 设备离线状态 { d_no: boolean }
        this.deviceOfflineTimers = {}   // 设备离线防抖定时器 { d_no: timerId }
        this.client = this.createClient() // 创建MQTT客户端实例
        console.log('[MqttClient] 初始化完成，设备离线检测使用每个设备独立的防抖定时器（10秒）')
    }

    /**
     * 创建MQTT客户端并设置事件处理
     * @returns {mqtt.Client} MQTT客户端实例
     */
    createClient() {
        // 创建MQTT连接
        const client = mqtt.connect(this.config.url, this.config.option)

        /**
         * 连接成功事件处理
         * 1. 更新连接状态
         * 2. 订阅所有主题
         * 3. 处理离线时缓存的消息队列
         */
        client.on('connect', () => {
            this.isConnected = true
            console.log('MQTT connected')
            this.subscribeAllTopics()
            this.processQueue()
        })

        /**
         * 连接错误事件处理
         * 更新连接状态为断开
         */
        client.on('error', (err) => {
            console.error('MQTT error:', err.message)
            this.isConnected = false
        })

        /**
         * 连接关闭事件处理
         * 更新连接状态为断开
         */
        client.on('close', () => {
            this.isConnected = false
        })

        /**
         * 重连事件处理
         * 输出日志提示正在重连
         */
        client.on('reconnect', () => {
            console.log('MQTT reconnecting...')
        })

        /**
         * 消息接收事件处理
         * @param {string} topic - 消息主题
         * @param {Buffer} payload - 消息载荷（Buffer格式）
         */
        client.on('message', async (topic, payload) => {
            // 规范化主题名称，移除开头的斜杠
            const normalizedTopic = topic.replace(/^\/+/, '')

            // 心跳消息处理：从 heart_beat 主题提取设备编号，更新设备活跃时间戳
            if (normalizedTopic === 'heart_beat') {
                // 消息内容就是设备编号（字符串）
                const id = payload.toString().trim()
                if (id) {
                    this.markDeviceAlive(id)
                }
                return
            }

            // 解析JSON格式的消息载荷
            let info
            try {
                info = JSON.parse(payload.toString())
            } catch (err) {
                console.error('MQTT message parse failed:', err)
                return
            }

            // 根据主题路由到对应的消息处理器（使用 else-if 链确保单一匹配）
            if (topic === SENSOR_TOPIC) {
                const result = await handleSensorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            } else if (topic === BEHAVIOR_TOPIC) {
                const result = await handleBehaviorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            } else if (topic === ERROR_TOPIC) {
                const result = await handleErrorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }
        })

        return client
    }

    /**
     * 订阅所有配置的主题
     * 将配置中的主题列表转换为MQTT订阅格式并订阅
     */
    subscribeAllTopics() {
        // 将主题列表转换为 { topic: { qos } } 格式
        const topics = this.config.subscribeTopics.reduce((acc, item) => {
            acc[item.topic] = { qos: item.qos }
            return acc
        }, {})

        // 执行订阅
        this.client.subscribe(topics, (err) => {
            if (err) {
                console.error('MQTT subscribe failed:', err.message)
            } else {
                console.log('MQTT subscribe success')
            }
        })
    }

    /**
     * 发布JSON格式消息（便捷方法）
     * @param {string} topic - 消息主题
     * @param {Object} payload - 消息内容（对象形式）
     * @param {Object} options - 发布选项（如qos, retain等）
     * @returns {Promise} 发布结果Promise
     */
    publishJson(topic, payload, options = {}) {
        return this.publish(topic, JSON.stringify(payload), options)
    }

    /**
     * 向指定设备发布JSON格式消息
     * 支持离线消息队列和消息重发机制（每条消息发送两次提高可靠性）
     * @param {string} deviceId - 设备ID
     * @param {string} topic - 消息主题
     * @param {Object} payload - 消息内容（对象形式）
     * @param {Object} options - 发布选项
     * @returns {Object} 发布结果 { status, deviceId, error?, queueLength? }
     */
    async publishJsonToDevice(deviceId, topic, payload, options = {}) {
        // 如果未连接，将消息加入队列
        if (!this.isConnected) {
            const queueItem = { deviceId, topic, payload, options, timestamp: Date.now() }
            this.messageQueue.push(queueItem)
            console.log(`MQTT not connected, message queued for device ${deviceId}`)
            return { status: 'queued', deviceId, queueLength: this.messageQueue.length }
        }

        const finalTopic = topic
        console.log(`[MQTT] Publishing to ${finalTopic}:`, payload)

        // 单次发布函数封装
        const publishOnce = () => {
            return new Promise((resolve) => {
                this.client.publish(finalTopic, JSON.stringify(payload), options, (err) => {
                    if (err) {
                        console.error(`MQTT publish failed to ${deviceId}:`, err.message)
                        resolve({ status: 'failed', deviceId, error: err.message })
                    } else {
                        resolve({ status: 'published', deviceId })
                    }
                })
            })
        }

        // 每条消息发送2次提高可靠性
        await publishOnce()
        console.log(`[MQTT] Publishing topic second time for device ${deviceId}: ${finalTopic}`)
        return publishOnce()
    }

    /**
     * 通用消息发布方法
     * 支持离线消息队列和消息重发机制（每条消息发送两次提高可靠性）
     * @param {string} topic - 消息主题
     * @param {string|Buffer} payload - 消息内容
     * @param {Object} options - 发布选项
     * @returns {Promise} 发布结果Promise
     */
    publish(topic, payload, options = {}) {
        return new Promise((resolve, reject) => {
            // 如果未连接，将消息加入队列
            if (!this.isConnected) {
                const queueItem = { topic, payload, options, timestamp: Date.now() }
                this.messageQueue.push(queueItem)
                console.log(`MQTT not connected, message queued: ${topic}`)
                resolve({ status: 'queued', queueLength: this.messageQueue.length })
                return
            }

            // 单次发布函数封装
            const publishOnce = () => {
                return new Promise((pubResolve, pubReject) => {
                    this.client.publish(topic, payload, options, (err) => {
                        if (err) {
                            console.error('MQTT publish error:', err.message)
                            pubReject(err)
                        } else {
                            pubResolve({ status: 'published' })
                        }
                    })
                })
            }

            // 每条消息发送2次提高可靠性
            publishOnce().then(() => {
                console.log(`[MQTT] Publishing topic second time: ${topic}`)
                return publishOnce()
            }).then(() => {
                resolve({ status: 'published', times: 2 })
            }).catch((err) => {
                reject(err)
            })
        })
    }

    /**
     * 处理离线消息队列
     * 当连接恢复后，依次发送队列中的消息
     */
    processQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const item = this.messageQueue.shift()
            this.client.publish(item.topic, item.payload, item.options, (err) => {
                if (err) {
                    console.error('Failed to publish queued message:', err.message)
                }
            })
        }
    }

    /**
     * 更新设备最后活跃时间戳
     * 每次收到心跳时重置该设备的离线防抖定时器（10秒后标记离线）
     * 当设备从离线变为在线时，自动发送暂存的指令
     * @param {string} id - 设备ID
     */
    markDeviceAlive(id) {
        const finalDeviceId = this.normalizeDeviceId(id)
        if (!finalDeviceId) return
        
        const wasOffline = this.deviceOfflineStatus[finalDeviceId] === true
        this.deviceLastAlive[finalDeviceId] = Date.now()
        this.deviceOfflineStatus[finalDeviceId] = false
        
        // 重置该设备的离线防抖定时器
        if (this.deviceOfflineTimers[finalDeviceId]) {
            clearTimeout(this.deviceOfflineTimers[finalDeviceId])
        }
        this.deviceOfflineTimers[finalDeviceId] = setTimeout(() => {
            // 10秒内没收到新心跳，标记离线
            this.deviceOfflineStatus[finalDeviceId] = true
            console.log(`[Heartbeat] 设备 ${finalDeviceId} 已离线（超过10秒未收到心跳）`)
            this.emit('deviceOffline', finalDeviceId)
            delete this.deviceOfflineTimers[finalDeviceId]
        }, 10000)
        
        // 如果设备之前是离线状态，现在上线了，发送暂存指令
        if (wasOffline) {
            console.log(`[Heartbeat] 设备 ${finalDeviceId} 上线，检查暂存指令...`)
            this.flushPendingCommands(finalDeviceId)
        }
    }

    /**
     * 检查设备是否在线
     * 设备10秒内有心跳则认为在线
     * @param {string} id - 设备ID
     * @returns {boolean} 设备是否在线
     */
    checkIfAlive(id) {
        const finalDeviceId = this.normalizeDeviceId(id)
        if (!finalDeviceId) return false
        const lastAlive = this.deviceLastAlive[finalDeviceId]
        const now = Date.now()
        // 判断是否在10秒内有活跃记录
        const isAlive = lastAlive && (now - lastAlive) < 10000

        if (!isAlive) {
            console.log(`Device ${finalDeviceId} is offline`)
        }

        return isAlive
    }

    /**
     * 启动离线检测定时器（已废弃，改用每个设备独立的防抖定时器）
     * 保留空方法避免调用处报错
     */
    startOfflineDetection() {
        // 已改用 markDeviceAlive 中的防抖定时器
    }

    /**
     * 为设备添加暂存指令（设备离线时调用）
     * @param {string} d_no - 设备编号
     * @param {number} config_id - 指令配置ID
     * @param {*} value - 指令值
     */
    addPendingCommand(d_no, config_id, value) {
        if (!d_no || d_no === 'null') return
        
        if (!this.devicePendingCommands[d_no]) {
            this.devicePendingCommands[d_no] = []
        }
        
        this.devicePendingCommands[d_no].push({ config_id, value })
        console.log(`[PendingCommands] 设备 ${d_no} 离线，指令 config_id=${config_id} 已暂存（当前队列长度: ${this.devicePendingCommands[d_no].length}）`)
    }

    /**
     * 发送设备所有暂存指令
     * 设备上线时调用，发送所有暂存指令 + 当前时间校准
     * @param {string} d_no - 设备编号
     */
    async flushPendingCommands(d_no) {
        if (!d_no || d_no === 'null') return
        
        const commands = this.devicePendingCommands[d_no]
        if (!commands || commands.length === 0) {
            console.log(`[PendingCommands] 设备 ${d_no} 无暂存指令需要发送`)
            return
        }
        
        console.log(`[PendingCommands] 设备 ${d_no} 上线，开始发送 ${commands.length} 条暂存指令`)
        
        // 1. 先发送当前时间校准（格式与手动校准一致：{"set": "YYYY-MM-DD-W HH:mm:ss"}）
        const now = new Date()
        const bjOffset = 8 * 60
        const localOffset = now.getTimezoneOffset()
        const bjTime = new Date(now.getTime() + (bjOffset + localOffset) * 60000)
        
        const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        const y = String(bjTime.getFullYear())
        const m = String(bjTime.getMonth() + 1).padStart(2, '0')
        const day = String(bjTime.getDate()).padStart(2, '0')
        const w = weeks[bjTime.getDay()]
        const h = String(bjTime.getHours()).padStart(2, '0')
        const min = String(bjTime.getMinutes()).padStart(2, '0')
        const s = String(bjTime.getSeconds()).padStart(2, '0')
        
        // 周索引：weeks.indexOf(w)
        const weekIdx = weeks.indexOf(w)
        const timeStr = `${y}-${m}-${day}-${weekIdx} ${h}:${min}:${s}`
        const calibratePayload = { set: timeStr }
        
        try {
            await this.publishJsonToDevice(d_no, 'control', calibratePayload, { qos: 1 })
            console.log(`[PendingCommands] 设备 ${d_no} 时间校准已发送:`, calibratePayload)
        } catch (err) {
            console.error(`[PendingCommands] 设备 ${d_no} 时间校准发送失败:`, err.message)
        }
        
        // 2. 发送所有暂存指令
        for (const cmd of commands) {
            try {
                // 根据 config_id 获取对应的属性名
                const configIdMapping = {
                    0: 'mode', 1: 'air', 2: 'fan', 3: 'speed_fan', 4: 'acMode',
                    5: 'power_air', 6: 'TG', 7: 'TinDH', 8: 'TinDL', 9: 'led',
                    10: 'LXD', 11: 'bright_led', 12: 'TBegin', 13: 'TEnd', 14: 'calibrate'
                }
                const propertyName = configIdMapping[cmd.config_id] || `unknown_${cmd.config_id}`
                
                let payload
                if (Number(cmd.config_id) === 14) {
                    // 校准时间特殊处理
                    try {
                        payload = typeof cmd.value === 'string' ? JSON.parse(cmd.value) : cmd.value
                    } catch (e) {
                        payload = { [propertyName]: cmd.value }
                    }
                } else {
                    payload = { [propertyName]: cmd.value }
                }
                
                await this.publishJsonToDevice(d_no, 'control', payload, { qos: 1 })
                console.log(`[PendingCommands] 设备 ${d_no} 指令 config_id=${cmd.config_id} 已发送:`, payload)
            } catch (err) {
                console.error(`[PendingCommands] 设备 ${d_no} 指令 config_id=${cmd.config_id} 发送失败:`, err.message)
            }
        }
        
        // 3. 清空该设备的暂存指令队列
        delete this.devicePendingCommands[d_no]
        console.log(`[PendingCommands] 设备 ${d_no} 暂存指令已全部发送并清空`)
    }

    /**
     * 规范化设备ID
     * @param {string} id - 设备ID
     * @returns {string|null} 规范化后的设备ID
     */
    normalizeDeviceId(id) {
        if (!id) return null
        return String(id).trim()
    }

    /**
     * 关闭MQTT连接
     */
    end() {
        if (this.client) {
            this.client.end()
        }
    }
}

// 导出MqttClient类供外部使用
module.exports = MqttClient
