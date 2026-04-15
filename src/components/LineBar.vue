<template>
  <view class="chart-wrapper">
    <view id="myLineChart" class="chart-container"></view>
  </view>
</template>

<script setup>
import { onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: { type: Array, default: () => [] },
  pageSize: { type: Number, default: 5 }
})

let mychart = null

// -------------------------
// 1. 更新图表 (修复时间解析 & 保持 PC 业务逻辑)
// -------------------------
const updateChart = (source) => {
  if (!mychart) return
  try {
    const json = source?.slice(0, props.pageSize) || []
    if (json.length === 0) {
      mychart.clear()
      return
    }

    // --- 时间轴处理：修复 Invalid Date ---
    const times = json.map(item => {
      let rawTime = item['创立时间'] || item['采集时间'];
      if (rawTime) {
        // 兼容 ISO 格式 (T/Z) 且兼容 iOS (横杠转斜杠)
        let formattedTime = rawTime.replace('T', ' ').replace(/\..+/, '').replace('Z', '');
        formattedTime = formattedTime.replace(/-/g, '/');
        
        const date = new Date(formattedTime);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('zh-CN', {
			year:'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      }
      return '未知';
    });

    // --- 字段提取逻辑：保持 PC 端原始逻辑 ---
    const elemKeys = Object.keys(json[0])
    const exclude = ['id', '设备编号', '数据类型', '创立时间', '采集时间']
    const fields = elemKeys.filter(k => !exclude.includes(k))

    const series = fields.map(field => ({
      name: field,
      type: 'line',
      smooth: true,
      data: json.map(item => {
        const raw = item[field]
        if (raw === undefined || raw === null) return 0
        // 正则提取数字，如 "12 ℃" -> 12
        const num = parseFloat(raw.toString().replace(/[^\d.-]/g, ''))
        return isNaN(num) ? 0 : num
      })
    }))

    mychart.setOption({
      tooltip: { trigger: 'axis', confine: true },
      legend: { data: fields, top: '2%' },
      grid: { 
        left: '3%', 
        right: '5%', 
        bottom: '15%', 
        top: '18%', 
        containLabel: true 
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { rotate: 25, fontSize: 10, interval: 0 }
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series
    }, true)
  } catch (err) {
    console.error('图表更新失败:', err)
  }
}

// -------------------------
// 2. 初始化图表 (原生 DOM 渲染)
// -------------------------
const initChart = () => {
  const chartDom = document.getElementById('myLineChart')
  if (!chartDom) return

  if (mychart) {
    mychart.dispose()
  }

  // H5 模式下直接初始化，不传 dpr 让 ECharts 自动处理
  mychart = echarts.init(chartDom)
  
  // 监听窗口缩放
  window.addEventListener('resize', () => mychart?.resize())
  
  updateChart(props.data)
}

// -------------------------
// 3. 监听与生命周期
// -------------------------
watch(() => [props.data, props.pageSize], () => {
  updateChart(props.data)
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    // 给 DOM 留一点渲染时间
    setTimeout(initChart, 100)
  })
})

onBeforeUnmount(() => {
  if (mychart) {
    mychart.dispose()
    mychart = null
  }
})
</script>

<style scoped>
.chart-wrapper {
  width: 100%;
  padding: 20rpx;
  box-sizing: border-box;
}

.chart-container {
  width: 100%;
  height: 550rpx; /* 固定高度防止 ECharts 获取不到空间 */
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);
}
</style>