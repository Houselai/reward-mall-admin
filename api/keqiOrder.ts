import { giftMallRequest } from '../config/request'

export type OrderDateField = 'applied_date' | 'heka_time' | 'jihuo_time' | 'shoushua_time' | 'settlement_time'

export interface KeqiOrderFilters {
  order_sn?: string
  product_id?: number
  product_name?: string
  order_status?: string
  applicant_name?: string
  mobile_last4?: string
  applicant_id_card_last4?: string
  date_field?: OrderDateField
  date_from?: string
  date_to?: string
}

export interface KeqiOrder extends Record<OrderDateField, string | null> {
  id: number
  order_sn: string
  product_id: number | null
  product_name: string | null
  order_status: string
  order_status_text: string
  applicant_name: string | null
  applicant_mobile: string | null
  applicant_id_card_last4: string | null
  heka_reward_fen: number | null
  jihuo_reward_fen: number | null
  shoushua_reward_fen: number | null
  settlement_rule: string | null
  modify_time: string
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchKeqiOrders(params: KeqiOrderFilters & { page: number; step: number }) {
  return giftMallRequest.post<{ list: KeqiOrder[]; total: number; page: number; step: number }>('/admin/keqi_order/list.json', params, jsonConfig)
}

export function fetchKeqiOrderStatuses() {
  return giftMallRequest.post<{ keqi_order_status: { label: string; value: string }[] }>('/admin/enum/list.json', { keys: ['keqi_order_status'] }, jsonConfig)
}
