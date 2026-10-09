import { giftMallRequest } from '../config/request'

export interface Category {
  id: number
  name: string
  image_url: string
  parent_id: number | null
  parent_name: string | null
  sort: number
  status: '0' | '1' | '4'
  remark: string
  create_time: string
  modify_time: string
}

export interface CategoryForm {
  name: string
  image_url: string
  parent_id: number | null
  sort: number
  status: '0' | '1'
  remark: string
}

export interface CategoryQuery {
  page: number
  step: number
  name?: string
  level?: 1 | 2 | null
  parent_id?: number | null
}

export interface CategoryFilterOptions {
  level: { value: 1 | 2; label: string }[]
  parent_id: CategoryOption[]
}

export interface CategoryOption {
  value: number
  label: string
  disabled?: boolean
}

interface CategoryPage {
  list: Category[]
  total: number
  page: number
  step: number
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchCategoryList(params: CategoryQuery) {
  return giftMallRequest.post<CategoryPage>('/admin/category/list.json', params, jsonConfig)
}

export function fetchCategoryDetail(id: number) {
  return giftMallRequest.post<Category>('/admin/category/show.json', { id }, jsonConfig)
}

export function fetchCategoryOptions() {
  return giftMallRequest.post<{ list: CategoryOption[] }>('/admin/category/options.json', { level: 1 }, jsonConfig)
}

export function fetchCategoryFilterOptions() {
  return giftMallRequest.post<CategoryFilterOptions>('/admin/category/filter_options.json', {}, jsonConfig)
}

export function createCategory(params: CategoryForm) {
  return giftMallRequest.post<{ id: number }>('/admin/category/create.json', params, jsonConfig)
}

export function updateCategory(params: Partial<CategoryForm> & { id: number }) {
  return giftMallRequest.post<[]>('/admin/category/update.json', params, jsonConfig)
}

export function deleteCategory(id: number) {
  return giftMallRequest.post<[]>('/admin/category/delete.json', { id }, jsonConfig)
}

export function uploadCategoryImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'category' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
