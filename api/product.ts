import { giftMallRequest } from '../config/request'

export interface ProductSpec {
  name: string
  values: string[]
}

export interface ProductSkuInput {
  id?: number
  spec_values: { name: string; value: string }[]
  images: string[]
  supply_price: number
  card_count?: number
  surcharge_price?: number
  exchange_text: string
  status: '0' | '1'
  is_main?: boolean
}

export interface ProductSku extends ProductSkuInput {
  id: number
  card_count: number
  surcharge_price: number
  is_main: boolean
  spec_text: string
}

export interface ProductForm {
  images: string[]
  title: string
  introduction: string
  exchange_rules: string
  category_ids: number[]
  brand_id: number | null
  status: '0' | '1'
  remark: string
}

export interface Product extends Omit<ProductForm, 'category_ids'> {
  id: number
  categories: { id: number; name: string; parent_id: number; parent_name: string }[]
  brand_id: number
  specs: ProductSpec[]
  main_sku_id: number | null
  create_time: string
  modify_time: string
}

export interface ProductListItem extends Product {
  brand_name: string | null
  sku_count: number
  on_sku_count: number
  main_sku: ProductSku | null
}

export interface ProductDetail extends Product {
  skus: ProductSku[]
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

export type ProductCreate = ProductForm & { brand_id: number; specs: ProductSpec[]; skus: ProductSkuInput[] }
export type ProductUpdate = Partial<Omit<ProductCreate, 'skus'>> & { id: number; skus?: (ProductSkuInput | { id: number; status: '4' })[] }
const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchProductList(params: ProductQuery) {
  return giftMallRequest.post<{ list: ProductListItem[]; total: number; page: number; step: number }>('/admin/product/list.json', params, jsonConfig)
}

export function fetchProductDetail(id: number) {
  return giftMallRequest.post<ProductDetail>('/admin/product/show.json', { id }, jsonConfig)
}

export function createProduct(params: ProductCreate) {
  return giftMallRequest.post<{ id: number }>('/admin/product/create.json', params, jsonConfig)
}

export function updateProduct(params: ProductUpdate) {
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
  return giftMallRequest.post<{ status: ProductEnumOption[] }>('/admin/enum/list.json', { keys: ['status'] }, jsonConfig)
}

export function uploadProductImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'product' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
