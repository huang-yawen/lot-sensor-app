const express = require('express');
const router = express.Router();

// 传感器相关控制器
const getSensorRealtime = require('../controllers/sensor/sensorRealtime');
const getHistoryDataByType = require('../controllers/sensor/historyData');

// 设备相关控制器
const getDeviceManageList = require('../controllers/device/deviceManageList');

// 故障相关控制器
const getErrorHistory = require('../controllers/error/errorHistory');
const getErrorTypeStats = require('../controllers/error/errorTypeStats');

// 指令配置相关控制器
const getDirectConfigTree = require('../controllers/direct/directConfigTree');
const getDirectConfigRender = require('../controllers/direct/directConfigRender');

// Device management service
const addDeviceManageData = require('../service/deviceData/addDeviceManageData');
const deleteDeviceManageData = require('../service/deviceData/deleteDeviceManageData');
const updateDeviceManageData = require('../service/deviceData/updateDeviceManageData');

// Direct configuration service
const updateMultipleDirectConfigs = require('../service/directData/updateMultipleDirectConfigs');
const updateDirectConfigAndPublish = require('../service/directData/updateDirectConfigAndPublish');

// 传感器接口
router.get('/data', getSensorRealtime);
router.get('/dataByType', getHistoryDataByType);

// 设备管理接口
router.get('/deviceData', getDeviceManageList);
router.post('/deviceData/add', addDeviceManageData);
router.post('/deviceData/delete', deleteDeviceManageData);
router.post('/deviceData/update', updateDeviceManageData);

// 故障接口
router.get('/errData', getErrorHistory);
router.get('/errTypeStats', getErrorTypeStats);

// 指令配置接口
router.get('/directData', getDirectConfigTree);
router.get('/directRender', getDirectConfigRender);
router.post('/multipleDirectData', updateMultipleDirectConfigs);
router.post('/directData/update', updateDirectConfigAndPublish);

module.exports = router;
