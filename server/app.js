const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
require('./config/env');
const sensorRoutes = require('./routes/sensorRoutes');
const mqttClient = require('./mqtt/index')
const app = express();
const port = Number(process.env.PORT) || 3000;
app.use(cors());
app.use(express.json());
      
// Keep the API surface grouped behind a single router.
app.use('/', sensorRoutes);

// MQTT 连接状态诊断接口
app.get('/api/mqtt/status', (req, res) => {
    res.json({
        success: true,
        data: {
            isConnected: mqttClient.isConnected,
            clientInitialized: !!mqttClient.client,
            url: mqttClient.config?.url || 'mqtt://localhost:1883'
        }
    })
});
        
const distPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.join(__dirname, '../../dist');
app.use(express.static(distPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
console.log('Dist Path:', distPath);

console.log('正在初始化 MQTT 连接...');
console.log('MQTT Broker URL:', process.env.MQTT_URL || 'mqtt://localhost:1883');

// ==================== WebSocket 服务器 ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// 存储所有已连接的 WebSocket 客户端
const wsClients = new Set();

wss.on('connection', (ws, req) => {
    console.log(`[WebSocket] 客户端已连接, IP: ${req.socket.remoteAddress}`);
    wsClients.add(ws);

    // 处理客户端发来的消息（如心跳 ping）
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            // 忽略非 JSON 消息
        }
    });

    ws.on('close', () => {
        console.log('[WebSocket] 客户端已断开');
        wsClients.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('[WebSocket] 客户端错误:', err.message);
        wsClients.delete(ws);
    });
});

/**
 * 向所有连接的 WebSocket 客户端广播消息
 * @param {string} type - 消息类型（如 'sensor_data', 'behavior_data', 'error_data'）
 * @param {*} payload - 消息内容
 */
function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    const deadClients = [];
    wsClients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        } else {
            deadClients.push(client);
        }
    });
    // 清理已断开的客户端
    deadClients.forEach((client) => wsClients.delete(client));
}

// 监听 MQTT 处理后的消息，广播给所有 WebSocket 客户端
mqttClient.on('processedMessage', (topic, data) => {
    // 根据主题映射消息类型
    const typeMap = {
        'sensor_data': 'sensor_data',
        'behavioral_data': 'behavior_data',
        'abnormal_state': 'error_data'
    };
    const type = typeMap[topic] || 'unknown';

    broadcast(type, data);
});

// 导出 broadcast 函数，供其他模块使用（如控制器需要主动推送时）
app.set('wsBroadcast', broadcast);

// 检查 MQTT 初始连接状态
setTimeout(() => {
    if (mqttClient.isConnected) {
        console.log('✅ MQTT 连接成功！');
    } else {
        console.warn('⚠️  MQTT 尚未连接，可能正在重连或 Broker 未运行');
    }
}, 5000);

server.listen(port, () => {
  console.log(`Server started: http://localhost:${port}`);
  console.log(`WebSocket server: ws://localhost:${port}/ws`);
});
