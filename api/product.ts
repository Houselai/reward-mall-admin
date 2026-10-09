import { giftMallRequest } from '../config/request'

export interface ProductForm {
  images: string[]
  title: string
  introduction: string
  card_count: number
  exchange_description: string
  banks: string[]
  exchange_rules: string
  category_id: number | null
  brand_id: number | null
  sort: number
  status: '0' | '1'
  remark: string
}

export interface Product extends ProductForm {
  id: number
  category_id: number
  brand_id: number
  category_name?: string
  brand_name?: string
  create_time: string
  modify_time: string
}

export interface ProductQuery {
  page: number
  step: number
  title?: string
  category_id?: number
  brand_id?: number
  status?: '0' | '1'
}

export interface ProductOption {
  value: number
  label: string
  disabled?: boolean
}

export interface ProductEnumOption {
  value: string
  label: string
}

export type ProductCreate = ProductForm & { category_id: number; brand_id: number }
const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchProductList(params: ProductQuery) {
  return giftMallRequest.post<{ list: Product[]; total: number; page: number; step: number }>('/admin/product/list.json', params, jsonConfig)
}

export function fetchProductDetail(id: number) {
  return giftMallRequest.post<Product>('/admin/product/show.json', { id }, jsonConfig)
}

export function createProduct(params: ProductCreate) {
  return giftMallRequest.post<{ id: number }>('/admin/product/create.json', params, jsonConfig)
}

export function updateProduct(params: Partial<ProductCreate> & { id: number }) {
  return giftMallRequest.post<[]>('/admin/product/update.json', params, jsonConfig)
}

export function deleteProduct(id: number) {
  return giftMallRequest.post<[]>('/admin/product/delete.json', { id }, jsonConfig)
}

export function fetchProductBrands() {
  return giftMallRequest.post<{ list: ProductOption[] }>('/admin/brand/options.json', undefined, jsonConfig)
}

export function fetchProductCategories() {
  return giftMallRequest.post<{ list: (ProductOption & { children: ProductOption[] })[] }>('/admin/category/tree.json', undefined, jsonConfig)
}

export function fetchProductEnums() {
  return giftMallRequest.post<{ status: ProductEnumOption[]; bank: ProductEnumOption[] }>('/admin/enum/list.json', { keys: ['status', 'bank'] }, jsonConfig)
}

export function uploadProductImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'product' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
