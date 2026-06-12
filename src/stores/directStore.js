import { defineStore } from "pinia"
import { ref } from "vue"
import { get, post } from "../utils/request"

export const directStore = defineStore("directStore", () => {
  const data = ref([])
  const renderData = ref([])

  const fetchDirectData = async () => {
    try {
      const res = await get("/directData")
      if (res.data.success) {
        data.value = res.data.data
      }
    } catch (err) {
      console.error("[Store] fetchDirectData 结构数据加载失败:", err)
    }
  }

  const handleRender = async (d_no = "null") => {
    try {
      const response = await get("/directRender", {
        data: { d_no },
      })

      if (response.data.success) {
        renderData.value = response.data.data || []
        return {
          data: response.data.data || [],
          singleDeviceMode: response.data.singleDeviceMode,
        }
      }
      return { data: [], singleDeviceMode: undefined }
    } catch (err) {
      console.error("[Store] handleRender 渲染数据请求失败:", err)
      return { data: [], singleDeviceMode: undefined }
    }
  }

  const handleUpdateData = async ({ id, value, d_no }) => {
    try {
      const payload = {
        config_id: id,
        value,
      }
      // 只有传了 d_no 才加到 payload 中
      // 单设备模式：前端不传 d_no，后端自动处理
      // 多设备模式：前端传 d_no（null=全局指令，设备号=单设备指令）
      if (d_no !== undefined && d_no !== null) {
        payload.d_no = d_no
      }
      const response = await post("/directData/update", payload)
      return response
    } catch (err) {
      console.error("[Store] handleUpdateData 更新失败:", err)
      throw err
    }
  }

  return { data, renderData, fetchDirectData, handleUpdateData, handleRender }
})
