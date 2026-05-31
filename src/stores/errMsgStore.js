import { defineStore } from "pinia"
import { ref } from "vue"
import { get } from "../utils/request"

export const errMsgStore = defineStore("errMsgStore", () => {
  const errData = ref([])
  const total = ref(0)
  const loading = ref(false)

  const formatTimeForBackend = (time) => {
    if (!time) return undefined
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(time)) {
      return `${time}:00`
    }
    return time
  }

  const fetchErrData = async (params = {}) => {
    loading.value = true
    try {
      const response = await get("http://localhost:3000/errData", {
        data: {
          page: params.currentPage || 1,
          keyword: params.keyword || "",
          pageSize: params.pageSize || 5,
          startTime: formatTimeForBackend(params.startTime),
          endTime: formatTimeForBackend(params.endTime),
        },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      const res = response.data
      if (res.success) {
        const list = res.data?.list || []

        errData.value = list.map((item) => ({
          ...item,
          报错时间: item["报错时间"] || "未知时间",
        }))

        total.value = res.data?.total || list.length
      }
    } catch (error) {
      console.error("errMsgStore 请求失败:", error)
    } finally {
      loading.value = false
    }
  }

  return {
    fetchErrData,
    errData,
    total,
    loading,
  }
})
