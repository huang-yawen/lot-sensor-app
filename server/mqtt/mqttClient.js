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
        this.deviceLastAlive = new Map() // 设备最后活跃时间映射
        this.client = this.createClient() // 创建MQTT客户端实例
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

            // 心跳消息处理：仅更新设备活跃时间戳，不做其他处理
            if (normalizedTopic.startsWith('isAlive/')) {
                const id = normalizedTopic.split('/').pop()
                this.markDeviceAlive(id)
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

            // 根据主题路由到对应的消息处理器
            // 传感器数据主题
            if (topic === SENSOR_TOPIC) {
                const result = await handleSensorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }

            // 行为数据主题
            if (topic === BEHAVIOR_TOPIC) {
                const result = await handleBehaviorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }

            // 错误数据主题
            if (topic === ERROR_TOPIC) {
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
     * 支持离线消息队列和消息重发机制（非心跳消息发送两次）
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

        // 判断是否为心跳消息
        const isHeartbeat = finalTopic.startsWith('isAlive/')
        // 心跳消息发送1次，其他消息发送2次（提高可靠性）
        const shouldPublishTwice = !isHeartbeat

        if (shouldPublishTwice) {
            await publishOnce()
            console.log(`[MQTT] Publishing topic second time for device ${deviceId}: ${finalTopic}`)
            return publishOnce()
        }

        return publishOnce()
    }

    /**
     * 通用消息发布方法
     * 支持离线消息队列和消息重发机制（非心跳消息发送两次）
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

            // 判断是否为心跳消息
            const isHeartbeat = topic.startsWith('isAlive/')
            // 心跳消息发送1次，其他消息发送2次（提高可靠性）
            const shouldPublishTwice = !isHeartbeat

            if (shouldPublishTwice) {
                publishOnce().then(() => {
                    console.log(`[MQTT] Publishing topic second time: ${topic}`)
                    return publishOnce()
                }).then(() => {
                    resolve({ status: 'published', times: 2 })
                }).catch((err) => {
                    reject(err)
                })
            } else {
                publishOnce().then(() => {
                    resolve({ status: 'published', times: 1 })
                }).catch((err) => {
                    reject(err)
                })
            }
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
     * @param {string} id - 设备ID
     */
    markDeviceAlive(id) {
        this.deviceLastAlive.set(id, Date.now())
    }

    /**
     * 检查设备是否在线
     * 设备30秒内有心跳则认为在线
     * @param {string} id - 设备ID
     * @returns {boolean} 设备是否在线
     */
    checkIfAlive(id) {
        const finalDeviceId = this.normalizeDeviceId(id)
        const lastAlive = this.deviceLastAlive.get(finalDeviceId)
        const now = Date.now()
        // 判断是否在30秒内有活跃记录
        const isAlive = lastAlive && (now - lastAlive) < 30000

        if (!isAlive) {
            console.log(`Device ${finalDeviceId} is offline`)
        }

        return isAlive
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
