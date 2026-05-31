const promisePool = require('../../config/promisepool')
const { formatDataWithUnit, buildDisplayFieldUnits } = require('../../utils/helper')

// 查询传感器或行为历史数据，并返回格式化后的列表和字段信息。
module.exports = async function getHistoryDataByType(query) {
    const type = query.type || 'sensor'
    const onlineFilter = query.online || null

    let dataTable = ''
    let fieldMappingTable = ''
    if (type === 'sensor') {
        dataTable = 't_sensor_data'
        fieldMappingTable = 't_sensor_field_mapper'
    } else {
        dataTable = 't_behavior_data'
        fieldMappingTable = 't_behavior_field_mapper'
    }

    const page = parseInt(query.page) || 1
    const pageSize = parseInt(query.pageSize) || 5
    const offset = (page - 1) * pageSize
    const keyword = query.keyword || null
    const keywordLike = keyword ? `%${keyword}%` : null
    const startTime = query.startTime || null
    const endTime = query.endTime || null

    // 让前端字段名和数据库字段映射保持同步。
    const [fieldMapper] = await promisePool.query(
        `SELECT f_name, db_name, unit FROM ${fieldMappingTable} WHERE visible = 1`
    )

    const fieldMapping = {}
    const fieldUnit = {}
    fieldMapper.forEach((item) => {
        fieldMapping[item.db_name] = item.f_name
        fieldUnit[item.db_name] = item.unit
    })

    const searchMapper = ['id', 'd_no AS 设备编号']
    for (const key in fieldMapping) {
        searchMapper.push(`${key} AS \`${fieldMapping[key]}\``)
    }
    if (type === 'behavior') {
        searchMapper.push('field5 AS 采集时间')
    }
    searchMapper.push('c_time AS 创立时间')

    const sql = `
        SELECT ${searchMapper.join(',')}
        FROM ${dataTable}
        WHERE 1=1
          AND (? IS NULL OR c_time >= ?)
          AND (? IS NULL OR c_time <= ?)
          AND (? IS NULL OR id = ? OR d_no LIKE ?)
          AND (? IS NULL OR online = ?)
        ORDER BY c_time DESC
        LIMIT ? OFFSET ?
    `

    const params = [
        startTime, startTime,
        endTime, endTime,
        keyword, keyword, keywordLike,
        onlineFilter, onlineFilter,
        pageSize, offset,
    ]

    const [rows] = await promisePool.query(sql, params)
    const processedData = formatDataWithUnit(rows, fieldMapping, fieldUnit)
    const fieldUnits = buildDisplayFieldUnits(fieldMapping, fieldUnit)

    const countSql = `
        SELECT COUNT(*) AS total
        FROM ${dataTable}
        WHERE 1=1
          AND (? IS NULL OR c_time >= ?)
          AND (? IS NULL OR c_time <= ?)
          AND (? IS NULL OR id = ? OR d_no LIKE ?)
          AND (? IS NULL OR online = ?)
    `
    const [countResult] = await promisePool.query(countSql, params.slice(0, 9))

    return {
        success: true,
        data: {
            list: processedData,
            fieldUnits,
            total: countResult[0].total,
            page,
            size: pageSize,
        },
    }
}
