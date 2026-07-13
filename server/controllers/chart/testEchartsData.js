/**
 * ECharts 曲线图测试数据控制器
 * 
 * GET /testChartData?count=10
 * 
 * 返回格式：
 * {
 *   success: true,
 *   data: { xdata: ["13:00", ...], ydata: [25.3, ...] },
 *   total: 10
 * }
 */

module.exports = async (req, res) => {
    try {
        const count = Math.min(parseInt(req.query.count) || 10, 200)
        const now = new Date()
        const baseValue = 25
        const xdata = []
        const ydata = []

        for (let i = 0; i < count; i++) {
            const time = new Date(now.getTime() - (count - i) * 300000)
            xdata.push(time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
            const value = baseValue + Math.sin(i * 0.5) * 5 + (Math.random() - 0.5) * 1.5
            ydata.push(parseFloat(value.toFixed(1)))
        }

        res.json({
            success: true,
            data: { xdata, ydata },
            total: count,
        })
    } catch (err) {
        console.error('获取 ECharts 测试数据失败:', err)
        res.status(500).json({ success: false, message: err.message })
    }
}