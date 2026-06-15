// utils/request.js

// 1. 基础配置
const BASE_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || ""

const defaultConfig = {
  baseURL: BASE_URL,
  timeout: 15000,
  tokenKey: "token",
  tokenHeader: "Authorization",
  withLoading: false,
  loadingTitle: "加载中...",
}

// 拦截器数组
const requestInterceptors = []
const responseInterceptors = []

// 2. 内部工具函数 (手动实现 URL 拼接，不依赖任何外部 url 模块)
const normalizeUrl = (baseURL, url) => {
  if (!url) return baseURL
  if (/^https?:\/\//.test(url)) return url
  if (!baseURL) return url
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const path = url.startsWith('/') ? url : '/' + url
  return base + path
}

const buildHeaders = (customHeaders = {}) => {
  const headers = { ...customHeaders }
  const token = uni.getStorageSync(defaultConfig.tokenKey)
  if (token && !headers[defaultConfig.tokenHeader]) {
    headers[defaultConfig.tokenHeader] = token.startsWith("Bearer ") ? token : `Bearer ${token}`
  }
  return headers
}

const parseErrorMessage = (err) => {
  if (!err) return "请求失败"
  if (typeof err === "string") return err
  if (err.data && typeof err.data === "object") return err.data.message || err.data.msg || "服务器错误"
  return err.message || "网络异常"
}

// 3. 核心 Request 函数
export const request = async (config = {}) => {
  const merged = {
    ...defaultConfig,
    method: "GET",
    headers: {},
    showError: true,
    ...config,
  }

  // 执行请求拦截器
  let finalConfig = { 
    ...merged, 
    url: normalizeUrl(merged.baseURL, merged.url),
    header: buildHeaders(merged.headers)
  }
  
  for (const interceptor of requestInterceptors) {
    finalConfig = (await interceptor(finalConfig)) || finalConfig
  }

  if (finalConfig.withLoading) uni.showLoading({ title: finalConfig.loadingTitle, mask: true })

  try {
    // 【关键修复】：GET 请求将 data 拼接到 URL 查询参数，确保后端能通过 req.query 获取
    let requestUrl = finalConfig.url
    if ((finalConfig.method === 'GET' || finalConfig.method === 'DELETE') && finalConfig.data) {
      const queryParts = []
      for (const [key, value] of Object.entries(finalConfig.data)) {
        if (value !== undefined && value !== null && value !== '') {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        }
      }
      if (queryParts.length) {
        requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryParts.join('&')
      }
    }

    const response = await uni.request({
      url: requestUrl,
      method: finalConfig.method,
      data: finalConfig.method === 'GET' || finalConfig.method === 'DELETE' ? undefined : finalConfig.data,
      header: finalConfig.header,
      timeout: finalConfig.timeout
    })

    // 适配不同版本的 uni.request 返回结果
    // 有些版本返回 [err, res]，有些直接返回 res 对象
    let result = response
    if (Array.isArray(response)) {
      if (response[0]) throw response[0]
      result = response[1]
    }

    // 检查 HTTP 状态码
    if (!result || result.statusCode < 200 || result.statusCode >= 300) {
      throw { message: `HTTP ${result?.statusCode || 'Error'}`, data: result?.data }
    }

    const axiosLikeResponse = {
      data: result.data,
      status: result.statusCode,
      headers: result.header,
      config: finalConfig
    }

    // 执行响应拦截器
    let finalResponse = axiosLikeResponse
    for (const interceptor of responseInterceptors) {
      finalResponse = (await interceptor(finalResponse)) || finalResponse
    }

    return finalResponse
  } catch (err) {
    if (finalConfig.showError !== false) {
      uni.showToast({ title: parseErrorMessage(err), icon: "none" })
    }
    throw err
  } finally {
    if (finalConfig.withLoading) uni.hideLoading()
  }
}

// 4. 便捷方法
export const get = (url, config = {}) => request({ ...config, url, method: "GET" })
export const post = (url, data, config = {}) => request({ ...config, url, data, method: "POST" })
export const put = (url, data, config = {}) => request({ ...config, url, data, method: "PUT" })
export const del = (url, data, config = {}) => request({ ...config, url, data, method: "DELETE" })

// 5. 拦截器注册
export const useRequestInterceptor = (fn) => { if (typeof fn === "function") requestInterceptors.push(fn) }
export const useResponseInterceptor = (fn) => { if (typeof fn === "function") responseInterceptors.push(fn) }

export default {
  request, get, post, put, delete: del,
  useRequestInterceptor, useResponseInterceptor
}