import { defineStore } from "pinia"
import { ref } from "vue"
import { get } from "../utils/request"

export const errMsgStore = defineStore("errMsgStore", () => {
  const errData = ref([])
  const total = ref(0)
  const loading = ref(false)

  const fetchErrData = async (params = {}) => {
    loading.value = true
    try {
      const response = await get("http://localhost:3000/errData", {
        data: {
          page: params.currentPage || 1,
          keyword: params.keyword || "",
          pageSize: params.pageSize || 5,
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
          报错时间: item["报错时间"]
            ? new Date(item["报错时间"]).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "未知时间",
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
