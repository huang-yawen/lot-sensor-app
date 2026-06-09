import { defineStore } from "pinia"
import { ref } from "vue"
import { get } from "../utils/request"

export const sensorStore = defineStore("sensorStore", () => {
  const sensorData = ref({})
  const fieldUnits = ref({})

  const sensorValue = () => sensorData.value

  const fetchData = async () => {
    const response = await get("/data", {
      data: {
        online: "实时数据"
      }
    })

    console.log("接口数据:", response.data)

    sensorData.value = response.data
    fieldUnits.value = response.data?.fieldUnits || {}
  }

  return { sensorData, fieldUnits, fetchData, sensorValue }
})
