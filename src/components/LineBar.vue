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
  pageSize: { type: Number, default: 5 },
  fieldUnits: { type: Object, default: () => ({}) }
})

let mychart = null

const normalizeUnit = (unit) => {
  return unit === undefined || unit === null ? '' : String(unit).trim()
}

const getFieldUnit = (field) => {
  return normalizeUnit(props.fieldUnits?.[field])
}

const formatValueWithUnit = (value, unit) => {
  if (value === undefined || value === null || value === '') return ''
  return unit ? `${value} ${unit}` : String(value)
}

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const buildTooltipFormatter = (params) => {
  const items = Array.isArray(params) ? params : [params]
  if (!items.length) return ''

  const title = items[0]?.axisValueLabel || items[0]?.name || ''
  const lines = title ? [escapeHtml(title)] : []
  items.forEach(item => {
    const unit = getFieldUnit(item.seriesName)
    lines.push(`${item.marker || ''}${escapeHtml(item.seriesName)}: ${escapeHtml(formatValueWithUnit(item.value, unit))}`)
  })
  return lines.join('<br/>')
}

const buildDataViewContent = (option) => {
  const xData = option?.xAxis?.[0]?.data || []
  const seriesList = option?.series || []
  const headers = ['时间'].concat(seriesList.map(item => {
    const unit = getFieldUnit(item.name)
    return unit ? `${item.name} (${unit})` : item.name
  }))

  const rows = xData.map((time, index) => {
    return [time].concat(seriesList.map(item => {
      const unit = getFieldUnit(item.name)
      return formatValueWithUnit(item.data?.[index], unit)
    }))
  })

  const headerHtml = headers.map(item => `<th>${escapeHtml(item)}</th>`).join('')
  const rowsHtml = rows.map(row => {
    return `<tr>${row.map(item => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`
  }).join('')

  return `<table style="width:100%;border-collapse:collapse;text-align:center;"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`
}

const updateChart = (source) => {
  if (!mychart) return
  try {
    const json = source?.slice(0, props.pageSize) || []
    if (!json || json.length === 0) {
      mychart.clear()
      return
    }

    const firstItem = json[0]
    if (!firstItem || typeof firstItem !== 'object') {
      mychart.clear()
      return
    }

    const isTimeFormat = (value) => {
      if (!value) return false
      const str = String(value).trim()
      return /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}:\d{2}$/.test(str)
    }

    const findTimeValue = (item) => {
      for (const key of Object.keys(item)) {
        if (isTimeFormat(item[key])) {
          return item[key]
        }
      }
      return null
    }

    const times = json.map(item => {
      const rawTime = findTimeValue(item)
      
      if (!rawTime) return '未知'
      
      let timeStr = String(rawTime).trim()
      
      if (timeStr === '未知时间' || timeStr === '未知') {
        return '未知'
      }

      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
        return timeStr
      }

      if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
        return timeStr.replace(/\//g, '-')
      }

      return '未知'
    }).reverse();
    const elemKeys = Object.keys(json[0])
    const exclude = [
        'id', '设备编号', '数据类型', '创建时间', '采集时间', '物体编号', '物体编号2', 
        '创立时间', '风扇开关', '空调开关', '可调灯开关', '控制模式', '空调模式',
        '更新时间', '时间', 'timestamp', 'time', 'createTime', 'updateTime', 
        'collectTime', 'recordTime', 'reportTime', 'dataTime', 'datetime', 'dateTime',
        '上报时间', '记录时间', '数据时间', '检测时间', '采样时间','储运箱ID'
      ]
    const fields = elemKeys.filter(k => !exclude.includes(k))

    const series = fields.map(field => ({
      name: field,
      type: 'line',
      smooth: true,
      data: json.map(item => {
        const raw = item[field]
        if (raw === undefined || raw === null) return 0
        const num = parseFloat(raw.toString().replace(/[^\d.-]/g, ''))
        return isNaN(num) ? 0 : num
      }).reverse()
    }))
    const yAxisUnits = [...new Set(fields.map(getFieldUnit).filter(Boolean))]
    const yAxisUnit = yAxisUnits.length === 1 ? yAxisUnits[0] : ''

    mychart.setOption({
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        },
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderColor: '#333',
        borderWidth: 1,
        padding: 10,
        textStyle: {
          color: '#fff',
          fontSize: 12
        },
        confine: true,
        formatter: buildTooltipFormatter
      },
      legend: { data: fields, bottom:'0px',left:'center' },
      grid: { 
        left: '3%', 
        right: '5%', 
        bottom: '15%', 
        top: '18%', 
        containLabel: true 
      },
	 toolbox: {
	     show: true, 
	     orient: 'horizontal', 
	     itemSize: 15,
	     itemGap: 10, 
	     right: '5%', 
	     top: '0',    
	     feature: {
	         magicType: { 
	             show: true, 
	             type: ['line', 'bar'] 
	         },
	         restore: { show: true },
	         dataView: { show: true, readOnly: false, optionToContent: buildDataViewContent },
	         saveAsImage: { show: true },
	     }
	 },
      xAxis: {
        type: 'category',
        data: times,
        right: '0',
        axisLabel: { rotate: 25, fontSize: 10, interval: 'auto', padding: [25, 0, 0, 0] }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          formatter: value => formatValueWithUnit(value, yAxisUnit)
        }
      },
      series
    }, true)
  } catch (err) {
    console.error('图表更新失败:', err)
  }
}

const initChart = () => {
  echarts.env.touchEventsSupported = true
  echarts.env.wxa = false
  echarts.env.svgSupported = true
  echarts.env.canvasSupported = true
  echarts.env.domSupported = true

  const chartDom = document.getElementById('myLineChart')
  if (!chartDom) return

  if (mychart) {
    mychart.dispose()
  }

  mychart = echarts.init(chartDom)
  
  window.addEventListener('resize', () => mychart?.resize())
  
  updateChart(props.data)
}

watch(() => [props.data, props.pageSize, props.fieldUnits], () => {
  updateChart(props.data)
}, { deep: true })

onMounted(() => {
  nextTick(() => {
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
  height: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);
}
</style>
