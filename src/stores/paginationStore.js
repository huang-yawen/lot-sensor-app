import { defineStore } from "pinia"
import { ref } from "vue"
import { get } from "../utils/request"

export const paginationStore = defineStore("paginationStore", () => {
  const paginationData = ref([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(5)
  const fieldUnits = ref({})
  const loading = ref(false)
  const type = ref("数据监测中心")

  const formatTimeForBackend = (time) => {
    if (!time) return undefined
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(time)) {
      return `${time}:00`
    }
    return time
  }

  const fetchPaginationData = async (params = {}) => {
    loading.value = true
    try {
      const response = await get("http://localhost:3000/dataByType", {
        data: {
          type: params.type || "sensor",
          page: params.currentPage || currentPage.value,
          keyword: params.keyword || "",
          startTime: formatTimeForBackend(params.startTime),
          endTime: formatTimeForBackend(params.endTime),
          pageSize: params.pageSize ? Number(params.pageSize) : pageSize.value,
        },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (response.data.success) {
        paginationData.value = response.data.data.list || []
        fieldUnits.value = response.data.data.fieldUnits || {}
        total.value = response.data.data.total || 0
        currentPage.value = response.data.data.page || 1
        pageSize.value = response.data.data.size || pageSize.value

        if (params.type) {
          type.value =
            params.type === "behavior" ? "行为数据监测" : "数据监测中心"
        } else if (response.data.data.type) {
          type.value = response.data.data.type
        }

        const safeParseDate = (dateStr) => {
      if (!dateStr) return null
      const safeStr = dateStr.replace(/-/g, '/').replace('T', ' ')
      const date = new Date(safeStr)
      return isNaN(date.getTime()) ? null : date
    }

    const formatDateTime = (date) => {
      if (!date) return "未知时间"
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
    }

    paginationData.value = paginationData.value.map((item) => {
      const date = safeParseDate(item["创立时间"])
      return {
        ...item,
        创立时间: formatDateTime(date),
      }
    })
      }
    } catch (error) {
      console.error("请求失败:", error)
    } finally {
      loading.value = false
    }
  }

  return {
    fetchPaginationData,
    paginationData,
    total,
    currentPage,
    pageSize,
    fieldUnits,
    loading,
    type,
  }
})
