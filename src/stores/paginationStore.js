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

  const fetchPaginationData = async (params = {}) => {
    loading.value = true
    try {
      const response = await get("/dataByType", {
        data: {
          type: params.type || "sensor",
          page: params.currentPage || currentPage.value,
          keyword: params.keyword || "",
          startTime: params.startTime,
          endTime: params.endTime,
          pageSize: params.pageSize ? Number(params.pageSize) : pageSize.value,
          online: params.online || "保留数据",
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
