const promisePool = require('../../config/promisepool')
const { formatDataWithUnit, buildDisplayFieldUnits } = require('../../utils/helper')

// 组装传感器实时数据和前端需要的字段元信息。
module.exports = async (req, res) => {
    try {
        const onlineFilter = req.query.online

        // 读取字段映射表，让前端展示名和数据库字段保持一致。
        const [fieldMapper] = await promisePool.query(
            `SELECT f_name,db_name,unit FROM t_sensor_field_mapper WHERE visible = 1`
        )
        const fieldMapping = {}
        const fieldUnit = {}
        fieldMapper.forEach(item => {
            fieldMapping[item.db_name] = item.f_name
            fieldUnit[item.db_name] = item.unit
        })

        const searchMapper = ['id', 'd_no AS 璁惧缂栧彿']
        searchMapper.push('pid1 AS 鐗╀綋缂栧彿1')
        searchMapper.push('pid2 AS 鐗╀綋缂栧彿2')
        for (const key in fieldMapping) {
            searchMapper.push(`${key} AS \`${fieldMapping[key]}\``)
        }
        searchMapper.push('c_time AS 鍒涚珛鏃堕棿')

        let whereClause = ''
        let params = []
        if (onlineFilter) {
            whereClause = ' WHERE online = ?'
            params = [onlineFilter]
        }

        const [sensorData] = await promisePool.query(
            `SELECT ${searchMapper.join(',')} FROM t_sensor_data${whereClause} ORDER BY id`,
            params
        )

        const proccessData = formatDataWithUnit(sensorData, fieldMapping, fieldUnit)
        const fieldUnits = buildDisplayFieldUnits(fieldMapping, fieldUnit)

        // 顺手把故障数据、行为数据也拼到同一个返回里，方便首页一次渲染。
        const [errorMapper] = await promisePool.query(
            'select id ,d_no as `璁惧缂栧彿`,c_time as `鏇存柊鏃堕棿`,e_msg as `鏁呴殰鍘熷洜` from t_error_msg'
        )
        const sortedData = errorMapper.reduce((acc, item) => {
            const deviceNo = item['璁惧缂栧彿']
            if (!acc[deviceNo]) acc[deviceNo] = []
            acc[deviceNo].push(item)
            return acc
        }, {})

        const fieldName = {}
        const [behaviorField] = await promisePool.query(
            'select db_name,p_name from t_behavior_field_mapper'
        )
        behaviorField.forEach(item => {
            fieldName[item.db_name] = item.p_name
        })

        const searchBehavior = ['id', 'd_no AS 璁惧缂栧彿']
        Object.keys(fieldName).forEach(key => {
            searchBehavior.push(`${key} AS \`${fieldName[key]}\``)
        })
        searchBehavior.push('online AS 鏁版嵁绫诲瀷')
        searchBehavior.push('field5 AS 鏇存柊鏃堕棿')

        let [behaviorOutcome] = await promisePool.query(
            `SELECT ${searchBehavior.join(',')} FROM t_behavior_data`
        )
        behaviorOutcome = behaviorOutcome.map(item => {
            for (const key in fieldName) {
                const label = fieldName[key]
                const unit = fieldUnit[key]
                if (unit) {
                    item[label] = `${item[label]} ${unit}`
                }
            }
            return item
        })

        res.json({
            success: true,
            message: '成功',
            proccessData,
            fieldUnits,
            sortedData,
            behaviorOutcome
        })
    } catch (err) {
        console.error('澶勭悊澶辫触:', err)
        res.status(500).send('鏁版嵁澶勭悊澶辫触')
    }
}
