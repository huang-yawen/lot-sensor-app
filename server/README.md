# IoT 传感器应用 - 后端使用指南

## 📋 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [环境要求](#3-环境要求)
4. [快速开始](#4-快速开始)
5. [项目结构](#5-项目结构)
6. [配置文件说明](#6-配置文件说明)
7. [数据库设计](#7-数据库设计)
8. [API 接口文档](#8-api-接口文档)
9. [MQTT 消息机制](#9-mqtt-消息机制)
10. [WebSocket 实时推送](#10-websocket-实时推送)
11. [服务层详解](#11-服务层详解)
12. [控制器层详解](#12-控制器层详解)
13. [中间件与工具函数](#13-中间件与工具函数)
14. [开发指南](#14-开发指南)
15. [常见问题排查](#15-常见问题排查)

---

## 1. 项目概述

本项目是 IoT 传感器应用的后端服务，提供以下核心功能：

- **传感器数据采集与存储**：通过 MQTT 协议接收物联网设备上报的传感器数据、行为数据和异常状态数据，并存入 MySQL 数据库。
- **RESTful API 接口**：为前端提供传感器实时数据查询、历史数据分页查询、设备管理（增删改查）、故障历史查询、指令配置管理等功能。
- **WebSocket 实时推送**：将 MQTT 接收到的实时数据通过 WebSocket 广播给所有连接的前端客户端，实现页面数据的实时更新。
- **指令下发**：支持通过 API 向 MQTT Broker 发布指令，远程控制物联网设备。

---

## 2. 技术栈

| 技术 | 用途 |
|------|------|
| **Node.js** | 运行时环境 |
| **Express.js** | Web 框架，提供 RESTful API |
| **MySQL2** | MySQL 数据库驱动（连接池模式） |
| **MQTT.js** | MQTT 客户端，连接物联网 Broker |
| **ws** | WebSocket 服务端，实现实时推送 |
| **cors** | 跨域资源共享中间件 |
| **dotenv** | 环境变量管理 |

---

## 3. 环境要求

- **Node.js** >= 14.x
- **npm** >= 6.x
- **MySQL** >= 5.7（推荐 8.0+）
- **MQTT Broker**（如 Mosquitto、EMQX 等，可选，用于接收设备数据）

---

## 4. 快速开始

### 4.1 安装依赖

```bash
cd server
npm install
```

### 4.2 配置环境变量

复制 `.env.example` 为 `.env`，并根据实际环境修改配置：

```bash
cp .env.example .env
```

### 4.3 初始化数据库

执行 `wusiqi.sql` 或 `init/init_calibrate_time.sql` 中的 SQL 语句创建数据库和表结构：

```bash
mysql -u root -p < wusiqi.sql
```

### 4.4 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务默认启动在 `http://localhost:3000`。

### 4.5 验证服务

访问以下地址验证服务是否正常运行：

```
http://localhost:3000/api/mqtt/status
```

预期返回：
```json
{
  "success": true,
  "data": {
    "isConnected": false,
    "clientInitialized": false,
    "url": "mqtt://localhost:1883"
  }
}
```

---

## 5. 项目结构

```
server/
├── app.js                          # 应用入口，Express + WebSocket 服务器
├── package.json                    # 项目依赖配置
├── .env                            # 环境变量配置（敏感信息）
├── .env.example                    # 环境变量模板
├── wusiqi.sql                      # 数据库初始化脚本
├── .backend-err.log                # 后端错误日志
│
├── config/                         # 配置文件
│   ├── env.js                      # 环境变量加载器
│   └── promisepool.js              # MySQL 连接池配置
│
├── routes/                         # 路由定义
│   └── sensorRoutes.js             # 所有 API 路由汇总
│
├── controllers/                    # 控制器层（请求处理）
│   ├── sensor/
│   │   ├── sensorRealtime.js       # 传感器实时数据
│   │   └── historyData.js          # 历史数据查询
│   ├── device/
│   │   └── deviceManageList.js     # 设备列表查询
│   ├── error/
│   │   ├── errorHistory.js         # 故障历史查询
│   │   └── errorTypeStats.js       # 故障类型统计
│   └── direct/
│       ├── directConfigTree.js     # 指令配置树
│       └── directConfigRender.js   # 指令配置渲染
│
├── service/                        # 服务层（业务逻辑）
│   ├── deviceData/
│   │   ├── getDeviceManageList.js  # 获取设备列表
│   │   ├── addDeviceManageData.js  # 添加设备
│   │   ├── deleteDeviceManageData.js # 删除设备
│   │   └── updateDeviceManageData.js # 更新设备
│   ├── historyData/
│   │   └── getHistoryDataByType.js # 按类型查询历史数据
│   ├── errorHistory/
│   │   ├── getErrorHistory.js      # 获取故障历史
│   │   └── getErrorTypeStats.js    # 获取故障类型统计
│   └── directData/
│       ├── updateDirectConfigAndPublish.js  # 更新指令配置并发布
│       └── updateMultipleDirectConfigs.js   # 批量更新指令配置
│
├── mqtt/                           # MQTT 消息处理
│   ├── index.js                    # MQTT 客户端入口（事件发射器）
│   ├── mqttClient.js               # MQTT 客户端核心逻辑
│   ├── messageRouter.js            # 消息路由器（按主题分发）
│   ├── deviceManager.js            # 设备管理器（在线状态管理）
│   ├── handlers/                   # 消息处理器
│   │   ├── sensorHandler.js        # 传感器数据处理器
│   │   ├── behaviorHandler.js      # 行为数据处理器
│   │   └── errorHandler.js         # 异常数据处理器
│   ├── sensorRealtime/             # 传感器实时数据处理
│   │   └── index.js
│   ├── behaviorRealtime/           # 行为实时数据处理
│   │   ├── behaviorRealtimeHandler.js
│   │   └── behaviorRealtimeRepository.js
│   └── errorHistory/              # 故障历史处理
│       └── index.js
│
├── middleware/                     # 中间件（预留）
│
├── utils/                         # 工具函数
│   └── helper.js                  # 数据格式化工具
│
└── init/                          # 初始化脚本
    └── init_calibrate_time.sql    # 校准时间表初始化
```

---

## 6. 配置文件说明

### 6.1 `.env` 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DB_HOST` | 数据库主机 | `localhost` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户名 | `root` |
| `DB_PASSWORD` | 数据库密码 | `""` |
| `DB_NAME` | 数据库名 | `task` |
| `DB_CONNECTION_LIMIT` | 连接池最大连接数 | `10` |
| `MQTT_URL` | MQTT Broker 地址 | `mqtt://localhost:1883` |
| `MQTT_TOPICS` | 订阅的主题（逗号分隔） | `sensor_data,behavioral_data,abnormal_state` |
| `FRONTEND_DIST_PATH` | 前端静态文件路径 | `../../dist` |

### 6.2 `config/env.js` 环境变量加载器

- 自动从 `server/.env` 和项目根目录 `.env` 两个位置加载环境变量。
- 支持 `#` 注释行。
- 支持双引号和单引号包裹的值。
- 已存在的环境变量不会被覆盖。

### 6.3 `config/promisepool.js` 数据库连接池

- 使用 `mysql2` 连接池，支持 Promise 异步操作。
- 连接池参数通过环境变量配置。
- 启动时自动检测数据库连接状态。
- 设置 `dateStrings: true`，日期以字符串形式返回，避免时区问题。

---

## 7. 数据库设计

### 7.1 核心表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `t_sensor_data` | 传感器历史数据 | `id`, `d_no`(储运箱ID), `pid`(物体编号), `c_time`, `online` |
| `t_sensor_realtime` | 传感器实时数据 | `id`, `d_no`, 动态字段 |
| `t_behavior_data` | 行为历史数据 | `id`, `d_no`, `c_time`, `online` |
| `t_behavior_realtime` | 行为实时数据 | `id`, `d_no`, 动态字段 |
| `t_error_msg` | 故障消息 | `id`, `d_no`, `e_msg`(故障原因), `c_time` |
| `t_error_history` | 故障历史 | `id`, `d_no`, 动态字段 |
| `t_device` | 设备管理 | `id`, `device_name`, `number`(电车编号), `remarks`, `ctime` |
| `t_sensor_field_mapper` | 传感器字段映射 | `f_name`(前端显示名), `db_name`(数据库字段名), `unit`(单位), `visible` |
| `t_behavior_field_mapper` | 行为字段映射 | `p_name`(前端显示名), `db_name`(数据库字段名) |
| `t_direct_config` | 指令配置 | 指令相关配置项 |

### 7.2 字段映射机制

传感器数据使用 `t_sensor_field_mapper` 表实现字段名映射：
- `db_name`：数据库中的原始字段名
- `f_name`：返回给前端的中文显示名
- `unit`：字段单位（如 ℃、%RH 等）
- `visible`：是否在前端可见

行为数据使用 `t_behavior_field_mapper` 表实现类似映射。

---

## 8. API 接口文档

### 8.1 传感器接口

#### GET `/data` - 获取传感器实时数据

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `online` | string | 否 | 在线状态过滤（如 `online`、`offline`） |

**响应示例：**

```json
{
  "success": true,
  "message": "成功",
  "processedData": [
    {
      "id": 1,
      "储运箱ID": "D001",
      "物体编号": "P001",
      "温度": 25.3,
      "湿度": 60.5,
      "创立时间": "2024-01-01 12:00:00",
      "数据类型": "online"
    }
  ],
  "fieldUnits": {
    "温度": "℃",
    "湿度": "%RH"
  },
  "sortedData": {
    "D001": [
      { "id": 1, "储运箱ID": "D001", "创立时间": "2024-01-01", "故障原因": "温度过高" }
    ]
  },
  "behaviorOutcome": [
    {
      "id": 1,
      "储运箱ID": "D001",
      "行为类型": "开门",
      "数据类型": "online",
      "更新时间": "2024-01-01 12:00:00"
    }
  ]
}
```

**说明：** 此接口一次性返回传感器数据、故障数据和行为数据，方便首页一次渲染。

---

#### GET `/dataByType` - 按类型查询历史数据

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 数据类型：`sensor` / `behavior` / `error` |
| `page` | number | 否 | 页码，默认 `1` |
| `pageSize` | number | 否 | 每页条数，默认 `20` |
| `d_no` | string | 否 | 按储运箱ID筛选 |
| `startTime` | string | 否 | 开始时间 |
| `endTime` | string | 否 | 结束时间 |

**响应示例：**

```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

### 8.2 设备管理接口

#### GET `/deviceData` - 获取设备列表

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 `1` |
| `pageSize` | number | 否 | 每页条数，默认 `10` |
| `keyword` | string | 否 | 搜索关键字（按设备名称或编号搜索） |

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_name": "传感器A",
      "number": "EV001",
      "remarks": "主仓库",
      "ctime": "2024-01-01"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 10
}
```

---

#### POST `/deviceData/add` - 添加设备

**请求体：**

```json
{
  "id": 1001,
  "设备名称": "传感器B",
  "备注": "备用设备",
  "创立时间": "2024-01-15",
  "电车编号id": "EV002"
}
```

**响应：**

```json
{
  "success": true,
  "message": "成功啦！"
}
```

---

#### POST `/deviceData/delete` - 删除设备

**请求体：**

```json
{
  "id": 1001
}
```

**响应：**

```json
{
  "success": true
}
```

---

#### POST `/deviceData/update` - 更新设备

**请求体：**

```json
{
  "oldId": 1001,
  "id": 1002,
  "设备名称": "传感器B-更新",
  "电车编号id": "EV003",
  "备注": "已迁移"
}
```

**响应：**

```json
{
  "success": true,
  "message": "修改成功！"
}
```

---

### 8.3 故障接口

#### GET `/errData` - 获取故障历史

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 `1` |
| `pageSize` | number | 否 | 每页条数，默认 `20` |
| `d_no` | string | 否 | 按储运箱ID筛选 |
| `startTime` | string | 否 | 开始时间 |
| `endTime` | string | 否 | 结束时间 |

---

#### GET `/errTypeStats` - 获取故障类型统计

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startTime` | string | 否 | 开始时间 |
| `endTime` | string | 否 | 结束时间 |

**响应示例：**

```json
{
  "success": true,
  "data": [
    { "errorType": "温度过高", "count": 15 },
    { "errorType": "湿度过低", "count": 8 }
  ]
}
```

---

### 8.4 指令配置接口

#### GET `/directData` - 获取指令配置树

返回指令配置的树形结构，用于前端展示配置层级。

---

#### GET `/directRender` - 获取指令配置渲染数据

返回指令配置的渲染数据，包含字段映射和显示信息。

---

#### POST `/multipleDirectData` - 批量更新指令配置

**请求体：**

```json
{
  "configs": [
    { "id": 1, "value": "new_value_1" },
    { "id": 2, "value": "new_value_2" }
  ]
}
```

---

#### POST `/directData/update` - 更新指令配置并发布到 MQTT

**请求体：**

```json
{
  "id": 1,
  "value": "new_value",
  "d_no": "D001"
}
```

**说明：** 此接口不仅更新数据库中的指令配置，还会通过 MQTT 将指令发布到 Broker，远程控制设备。

---

### 8.5 系统接口

#### GET `/api/mqtt/status` - MQTT 连接状态诊断

**响应示例：**

```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "clientInitialized": true,
    "url": "mqtt://localhost:1883"
  }
}
```

---

## 9. MQTT 消息机制

### 9.1 架构概览

```
IoT 设备 → MQTT Broker → MQTT Client (mqttClient.js)
                              ↓
                         messageRouter.js (按主题分发)
                        /         |          \
                       ↓          ↓           ↓
              sensorHandler  behaviorHandler  errorHandler
              (sensor_data)  (behavioral_data) (abnormal_state)
                       ↓          ↓           ↓
                    MySQL  ← 数据入库  →  WebSocket 广播
                                          ↓
                                    前端客户端
```

### 9.2 核心组件

#### `mqtt/index.js` - MQTT 客户端入口

- 继承自 `EventEmitter`，是一个事件发射器。
- 初始化 MQTT 客户端并订阅配置的主题。
- 当收到处理后的消息时，触发 `processedMessage` 事件。
- `app.js` 监听此事件，将数据通过 WebSocket 广播给前端。

#### `mqtt/mqttClient.js` - MQTT 客户端核心

- 使用 `mqtt.js` 库连接 MQTT Broker。
- 支持自动重连。
- 提供 `publish()` 方法用于向设备下发指令。
- 暴露 `isConnected` 状态和 `config` 配置。

#### `mqtt/messageRouter.js` - 消息路由器

- 根据 MQTT 主题将消息分发到对应的处理器。
- 主题映射规则：
  - `sensor_data` → `sensorHandler`
  - `behavioral_data` → `behaviorHandler`
  - `abnormal_state` → `errorHandler`

#### `mqtt/deviceManager.js` - 设备管理器

- 管理设备的在线状态。
- 跟踪设备的上次活跃时间。
- 提供设备状态查询接口。

### 9.3 消息处理器

每个处理器遵循相同的模式：

1. 解析 JSON 消息体
2. 提取 `d_no`（设备编号）
3. 将动态字段存入对应的实时数据表
4. 返回处理后的数据

#### sensorHandler.js - 传感器数据处理器

- 主题：`sensor_data`
- 目标表：`t_sensor_realtime`
- 处理逻辑：将 `d_no` 之外的字段动态插入实时表

#### behaviorHandler.js - 行为数据处理器

- 主题：`behavioral_data`
- 目标表：`t_behavior_realtime`
- 处理逻辑：将 `d_no` 之外的字段动态插入实时表

#### errorHandler.js - 异常数据处理器

- 主题：`abnormal_state`
- 目标表：`t_error_history`
- 处理逻辑：将 `d_no` 之外的字段动态插入历史表

### 9.4 数据流完整链路

```
1. IoT 设备通过 MQTT 协议上报数据到 Broker
2. MQTT Client 收到消息
3. messageRouter 根据主题分发到对应 handler
4. handler 解析数据并存入 MySQL
5. handler 返回处理后的数据
6. mqtt/index.js 触发 'processedMessage' 事件
7. app.js 监听到事件，通过 WebSocket 广播给前端
8. 前端收到实时数据，更新页面
```

---

## 10. WebSocket 实时推送

### 10.1 连接方式

前端通过 WebSocket 连接到：

```
ws://localhost:3000/ws
```

### 10.2 消息格式

服务端推送的消息格式：

```json
{
  "type": "sensor_data",
  "payload": { ... },
  "timestamp": 1704067200000
}
```

**type 取值：**

| 类型 | 说明 |
|------|------|
| `sensor_data` | 传感器实时数据 |
| `behavior_data` | 行为实时数据 |
| `error_data` | 异常状态数据 |
| `unknown` | 未知类型 |

### 10.3 心跳机制

- 客户端发送 `{"type": "ping"}` 维持连接。
- 服务端回复 `{"type": "pong"}`。

### 10.4 广播函数

`app.js` 中的 `broadcast(type, payload)` 函数：
- 遍历所有已连接的 WebSocket 客户端。
- 仅向 `readyState === 1`（OPEN）的客户端发送消息。
- 自动清理已断开的客户端连接。

---

## 11. 服务层详解

### 11.1 设备管理服务 (`service/deviceData/`)

#### `getDeviceManageList.js` - 获取设备列表

- 支持分页查询。
- 支持按关键字搜索（设备名称/编号）。
- 返回分页信息和设备数据列表。

#### `addDeviceManageData.js` - 添加设备

- 接收前端提交的设备信息。
- 插入 `t_device` 表。
- 字段：`id`, `device_name`, `remarks`, `ctime`, `number`。

#### `deleteDeviceManageData.js` - 删除设备

- 根据主键 `id` 删除设备记录。
- 使用参数化查询防止 SQL 注入。

#### `updateDeviceManageData.js` - 更新设备

- 支持修改设备 ID、名称、编号和备注。
- 使用 `oldId` 定位原记录，`id` 作为新 ID。
- 校验必填字段（设备名称和编号不能为空）。
- 检查 `affectedRows` 确认更新成功。

### 11.2 历史数据服务 (`service/historyData/`)

#### `getHistoryDataByType.js` - 按类型查询历史数据

- 支持三种数据类型：`sensor`、`behavior`、`error`。
- 根据类型动态选择查询表和字段映射。
- 支持分页、时间范围筛选和设备编号筛选。
- 使用字段映射表将数据库字段名转换为前端显示名。

### 11.3 故障历史服务 (`service/errorHistory/`)

#### `getErrorHistory.js` - 获取故障历史

- 分页查询 `t_error_msg` 表。
- 支持按设备编号和时间范围筛选。

#### `getErrorTypeStats.js` - 获取故障类型统计

- 按故障类型分组统计数量。
- 支持时间范围筛选。
- 用于前端故障分析图表。

### 11.4 指令配置服务 (`service/directData/`)

#### `updateDirectConfigAndPublish.js` - 更新指令并发布

- 更新数据库中的指令配置。
- 通过 MQTT 客户端将指令发布到 Broker。
- 实现远程设备控制。

#### `updateMultipleDirectConfigs.js` - 批量更新指令配置

- 支持一次更新多条指令配置。
- 事务处理确保数据一致性。

---

## 12. 控制器层详解

控制器层遵循"薄控制器"原则，只负责：
1. 接收 HTTP 请求
2. 调用对应的服务层函数
3. 返回 JSON 响应
4. 统一错误处理

### 控制器列表

| 控制器文件 | 对应路由 | 说明 |
|-----------|----------|------|
| `controllers/sensor/sensorRealtime.js` | `GET /data` | 传感器实时数据（含故障和行为数据） |
| `controllers/sensor/historyData.js` | `GET /dataByType` | 历史数据查询 |
| `controllers/device/deviceManageList.js` | `GET /deviceData` | 设备列表 |
| `controllers/error/errorHistory.js` | `GET /errData` | 故障历史 |
| `controllers/error/errorTypeStats.js` | `GET /errTypeStats` | 故障类型统计 |
| `controllers/direct/directConfigTree.js` | `GET /directData` | 指令配置树 |
| `controllers/direct/directConfigRender.js` | `GET /directRender` | 指令配置渲染 |

---

## 13. 中间件与工具函数

### 13.1 中间件

在 `app.js` 中配置的中间件：

```javascript
app.use(cors());           // 跨域支持
app.use(express.json());   // JSON 请求体解析
app.use(express.static()); // 静态文件服务
```

### 13.2 工具函数 (`utils/helper.js`)

#### `formatDataWithUnit(data, fieldMapping, fieldUnit)`

- 将数据中的数值拼接上单位字符串。
- 例如：`25.3` → `"25.3 ℃"`。
- **注意**：当前代码中此函数已被注释，前端图表需要纯数值，由前端自行拼接单位。

#### `buildDisplayFieldUnits(fieldMapping, fieldUnit)`

- 构建字段名到单位的映射对象。
- 返回格式：`{ "温度": "℃", "湿度": "%RH" }`。
- 前端根据此映射在显示时拼接单位。

---

## 14. 开发指南

### 14.1 添加新 API 接口

1. **创建服务层文件**：在 `service/` 下创建对应的业务逻辑文件。
2. **创建控制器文件**：在 `controllers/` 下创建控制器，调用服务层。
3. **注册路由**：在 `routes/sensorRoutes.js` 中添加路由映射。
4. **测试接口**：使用 Postman 或 curl 测试。

**示例：添加一个获取设备数量的接口**

```javascript
// 1. service/deviceData/getDeviceCount.js
const promisePool = require('../../config/promisepool')

module.exports = async () => {
    const [rows] = await promisePool.query('SELECT COUNT(*) AS count FROM t_device')
    return { success: true, count: rows[0].count }
}

// 2. controllers/device/deviceCount.js
const getDeviceCount = require('../../service/deviceData/getDeviceCount')

module.exports = async (req, res) => {
    try {
        const result = await getDeviceCount()
        res.json(result)
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
}

// 3. routes/sensorRoutes.js 中添加
const getDeviceCount = require('../controllers/device/deviceCount')
router.get('/deviceCount', getDeviceCount)
```

### 14.2 添加新的 MQTT 主题处理器

1. 在 `mqtt/handlers/` 下创建处理器文件。
2. 实现 `handleXxxData(topic, payload)` 函数。
3. 在 `mqtt/messageRouter.js` 中注册主题映射。
4. 在 `mqtt/index.js` 中订阅新主题。

### 14.3 数据库迁移

- 使用 SQL 脚本管理数据库变更。
- 新脚本放在 `init/` 目录下。
- 执行前备份生产数据库。

### 14.4 错误处理规范

- 服务层：抛出异常或返回 `{ success: false, message: "..." }`。
- 控制器层：捕获异常，返回 500 状态码和错误信息。
- 统一日志格式：`console.log("[模块名] 描述:", 详情)`。

---

## 15. 常见问题排查

### 15.1 数据库连接失败

**现象：** 启动时输出 `Database connection failed`

**排查步骤：**
1. 检查 MySQL 服务是否运行。
2. 检查 `.env` 中的数据库配置是否正确。
3. 检查数据库 `task` 是否存在。
4. 检查用户权限。

### 15.2 MQTT 连接失败

**现象：** 启动 5 秒后输出 `⚠️ MQTT 尚未连接`

**排查步骤：**
1. 检查 MQTT Broker 是否运行。
2. 检查 `.env` 中的 `MQTT_URL` 配置。
3. 访问 `http://localhost:3000/api/mqtt/status` 查看连接状态。
4. 检查防火墙是否阻止 1883 端口。

### 15.3 WebSocket 连接失败

**现象：** 前端无法收到实时数据

**排查步骤：**
1. 确认 WebSocket 地址为 `ws://localhost:3000/ws`。
2. 检查浏览器控制台是否有跨域错误。
3. 确认 MQTT 客户端已连接并收到数据。
4. 检查 `broadcast` 函数是否正确执行。

### 15.4 API 返回 404

**现象：** 请求 API 返回 404

**排查步骤：**
1. 检查路由是否在 `routes/sensorRoutes.js` 中注册。
2. 检查 HTTP 方法（GET/POST）是否匹配。
3. 检查请求路径是否正确。

### 15.5 数据查询为空

**现象：** API 返回成功但数据为空

**排查步骤：**
1. 检查数据库中是否有数据。
2. 检查查询条件是否正确（如时间范围、设备编号）。
3. 检查字段映射表 `t_sensor_field_mapper` 中 `visible` 是否为 1。

### 15.6 日志查看

错误日志输出到控制台和 `server/.backend-err.log` 文件。

```bash
# 查看实时日志
npm run dev

# 查看错误日志文件
cat .backend-err.log
```

---

## 附录

### A. 常用命令

```bash
# 启动开发服务器
npm run dev

# 启动生产服务器
npm start

# 安装依赖
npm install

# 查看 MQTT 连接状态
curl http://localhost:3000/api/mqtt/status
```

### B. 依赖清单

| 包名 | 版本 | 用途 |
|------|------|------|
| express | ^4.x | Web 框架 |
| mysql2 | ^3.x | MySQL 驱动 |
| mqtt | ^5.x | MQTT 客户端 |
| ws | ^8.x | WebSocket 服务端 |
| cors | ^2.x | 跨域支持 |
| nodemon | ^3.x | 开发热重载 |

### C. 端口说明

| 端口 | 用途 |
|------|------|
| 3000 | HTTP API + WebSocket |
| 3306 | MySQL 数据库 |
| 1883 | MQTT Broker（默认） |