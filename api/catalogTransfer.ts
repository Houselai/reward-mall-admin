import axios from 'axios'
import { giftMallRequest } from '../config/request'

export type CatalogModule = 'product' | 'category' | 'brand'

export interface CatalogExport {
  path: string
  url: string
  filename: string
  total: number
}

export interface CatalogImport {
  total: number
  created: number
  updated: number
  unchanged: number
}

export interface CatalogImportError {
  row: number
  field: string
  column: string
  message: string
}

export function exportCatalog(module: CatalogModule) {
  return giftMallRequest.post<CatalogExport>(`/admin/${module}/export.json`, {}, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function importCatalog(module: CatalogModule, file: File) {
  let errors: CatalogImportError[] = []
  const defaults = axios.defaults.transformResponse
  const transforms = defaults ? (Array.isArray(defaults) ? defaults : [defaults]) : []
  const result = await giftMallRequest.post<CatalogImport>(`/admin/${module}/import.json`, { file }, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformResponse: [...transforms, (body) => {
      // 统一错误处理会丢弃 data；在此保留本次导入的逐行错误，不改变鉴权和错误提示。
      if (body?.code !== 200 && Array.isArray(body?.data?.errors))
        errors = body.data.errors
      return body
    }],
  })
  return { ...result, errors }
}
