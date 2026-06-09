require('../config/env')
const MqttClient = require('./mqttClient')

// Central MQTT client used by the backend for publish and subscribe work.
const client = new MqttClient({
  url: process.env.MQTT_URL || 'mqtt://10.97.241.240',
  option: {
    clientId: process.env.MQTT_CLIENT_ID || 'lot-10.97.241.240-pc',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  },
  subscribeTopics: [
    // Heartbeat, sensor, behavior, error and control topics.
    { topic: 'testTopic/1', qos: 1 },
    { topic: 'heart_beat', qos: 1 },
    { topic: 'sensor_data', qos: 1 },
    { topic: 'behavioral_data', qos: 1 },
    { topic: 'abnormal_state', qos: 1 },
    { topic: 'control', qos: 1 }
  ]
})

client.on('message', (topic, info) => {
  console.log('MQTT message received:', topic, info)
})


module.exports = client
