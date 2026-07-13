/**
 * 显示控制 Store（移动端）
 * 
 * 【说明】
 * 字段可见性现由后端 systemConfig.js 统一控制，
 * 前端不再提供切换按钮，所有字段默认显示。
 * 
 * 此 store 仅保留 hideId / hideNumber 引用供 visibleEntries 过滤使用，
 * 默认值均为 false（全部显示）。
 */

import { defineStore } from "pinia"
import { ref } from "vue"

export const displayStore = defineStore("displayStore", () => {
  const hideId = ref(false)
  const hideNumber = ref(false)

  return {
    hideId,
    hideNumber,
  }
})