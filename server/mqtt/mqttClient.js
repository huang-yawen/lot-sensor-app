const mqtt = require('mqtt')
const EventEmitter = require('events')
const promisePool = require('../config/promisepool')
const { handleMessage: handleSensorData, SENSOR_TOPIC } = require('./sensorRealtime/index')
const { handleMessage: handleBehaviorData, BEHAVIOR_TOPIC } = require('./behaviorRealtime/index')
const { handleMessage: handleErrorData, ERROR_TOPIC } = require('./errorHistory/index')

class MqttClient extends EventEmitter {
    constructor(config) {
        super()
        this.config = config
        this.isConnected = false
        this.messageQueue = []
        this.deviceLastAlive = new Map()
        this.client = this.createClient()
    }

    createClient() {
        const client = mqtt.connect(this.config.url, this.config.option)

        client.on('connect', () => {
            this.isConnected = true
            console.log('MQTT connected')
            this.subscribeAllTopics()
            this.processQueue()
        })

        client.on('error', (err) => {
            console.error('MQTT error:', err.message)
            this.isConnected = false
        })

        client.on('close', () => {
            this.isConnected = false
        })

        client.on('reconnect', () => {
            console.log('MQTT reconnecting...')
        })

        client.on('message', async (topic, payload) => {
            const normalizedTopic = topic.replace(/^\/+/, '')

            // Heartbeat messages only refresh the device alive timestamp.
            if (normalizedTopic.startsWith('isAlive/')) {
                const id = normalizedTopic.split('/').pop()
                this.markDeviceAlive(id)
                return
            }

            let info
            try {
                info = JSON.parse(payload.toString())
            } catch (err) {
                console.error('MQTT message parse failed:', err)
                return
            }

            // Each topic is routed to the handler that knows how to persist it.
            if (topic === SENSOR_TOPIC) {
                const result = await handleSensorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }

            if (topic === BEHAVIOR_TOPIC) {
                const result = await handleBehaviorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }

            if (topic === ERROR_TOPIC) {
                const result = await handleErrorData(topic, payload)
                if (result) {
                    this.emit('message', topic, result)
                }
            }

        })

        return client
    }

    subscribeAllTopics() {
        const topics = this.config.subscribeTopics.reduce((acc, item) => {
            acc[item.topic] = { qos: item.qos }
            return acc
        }, {})

        this.client.subscribe(topics, (err) => {
            if (err) {
                console.error('MQTT subscribe failed:', err.message)
            } else {
                console.log('MQTT subscribe success')
            }
        })
    }

    publishJson(topic, payload, options = {}) {
        return this.publish(topic, JSON.stringify(payload), options)
    }

    async publishJsonToDevice(deviceId, topic, payload, options = {}) {
        if (!this.isConnected) {
            const queueItem = { deviceId, topic, payload, options, timestamp: Date.now() }
            this.messageQueue.push(queueItem)
            console.log(`MQTT not connected, message queued for device ${deviceId}`)
            return { status: 'queued', deviceId, queueLength: this.messageQueue.length }
        }

        const finalTopic = topic
        console.log(`[MQTT] Publishing to ${finalTopic}:`, payload)

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

    publish(topic, payload, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                const queueItem = { topic, payload, options, timestamp: Date.now() }
                this.messageQueue.push(queueItem)
                console.log(`MQTT not connected, message queued: ${topic}`)
                resolve({ status: 'queued', queueLength: this.messageQueue.length })
                return
            }

            this.client.publish(topic, payload, options, (err) => {
                if (err) {
                    console.error('MQTT publish error:', err.message)
                    reject(err)
                } else {
                    resolve({ status: 'published' })
                }
            })
        })
    }

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

    markDeviceAlive(id) {
        this.deviceLastAlive.set(id, Date.now())
    }

    checkIfAlive(id) {
        const finalDeviceId = this.normalizeDeviceId(id)
        const lastAlive = this.deviceLastAlive.get(finalDeviceId)
        const now = Date.now()
        const isAlive = lastAlive && (now - lastAlive) < 30000

        if (!isAlive) {
            console.log(`Device ${finalDeviceId} is offline`)
        }

        return isAlive
    }

    normalizeDeviceId(id) {
        if (!id) return null
        return String(id).trim()
    }

    end() {
        if (this.client) {
            this.client.end()
        }
    }
}

module.exports = MqttClient
