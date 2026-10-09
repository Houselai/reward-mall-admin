import { giftMallRequest } from '../config/request'

export interface HomeCategoryItem {
  position: number
  name: string
  subtitle: string
  product_ids: number[]
  create_time: string | null
  modify_time: string | null
}

export interface HomeCategorySaveItem {
  position: number
  name: string
  subtitle: string
  product_ids: number[]
}

export interface HomeCategoryProduct {
  id: number
  title: string
  status: '0' | '1'
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchHomeCategoryList() {
  return giftMallRequest.post<{ list: HomeCategoryItem[] }>('/admin/home_category/list.json', undefined, jsonConfig)
}

export function saveHomeCategory(items: HomeCategorySaveItem[]) {
  return giftMallRequest.post<[]>('/admin/home_category/save.json', { items }, jsonConfig)
}

export function fetchHomeCategoryProducts(params: { title: string; page: number; step: number }) {
  return giftMallRequest.post<{ list: HomeCategoryProduct[]; total: number; page: number; step: number }>('/admin/product/list.json', params, jsonConfig)
}
