import axios from 'axios'
import { giftMallRequest } from '../config/request'
import type { CatalogExport, CatalogImport, CatalogImportError } from './catalogTransfer'

export type OtherOrderStatus = '1' | '2' | '3' | '4' | '5'

export interface OtherOrderFilters {
  applicant_name?: string
  mobile_last4?: string
  card_type?: string
  order_status?: OtherOrderStatus
  date_from?: string
  date_to?: string
}

export interface OtherOrder {
  id: number
  applicant_name: string
  applicant_mobile: string
  card_type: string
  applied_time: string
  order_status: OtherOrderStatus
  order_status_text: string
  create_time: string
  modify_time: string
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchOtherOrders(params: OtherOrderFilters & { page: number; step: number }) {
  return giftMallRequest.post<{ list: OtherOrder[]; total: number; page: number; step: number }>('/admin/other_order/list.json', params, jsonConfig)
}

export function fetchOtherOrderStatuses() {
  return giftMallRequest.post<{ other_order_status: { label: string; value: OtherOrderStatus }[] }>('/admin/enum/list.json', { keys: ['other_order_status'] }, jsonConfig)
}

export function exportOtherOrders(params: OtherOrderFilters) {
  return giftMallRequest.post<CatalogExport>('/admin/other_order/export.json', params, jsonConfig)
}

export function updateOtherOrderStatus(id: number, order_status: OtherOrderStatus) {
  return giftMallRequest.post('/admin/other_order/update_status.json', { id, order_status }, jsonConfig)
}

export async function importOtherOrders(file: File) {
  let errors: CatalogImportError[] = []
  const defaults = axios.defaults.transformResponse
  const transforms = defaults ? (Array.isArray(defaults) ? defaults : [defaults]) : []
  const result = await giftMallRequest.post<CatalogImport>('/admin/other_order/import.json', { file }, {
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
