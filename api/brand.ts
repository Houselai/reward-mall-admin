import { giftMallRequest } from '../config/request'

export interface Brand {
  id: number
  name: string
  image_url: string
  sort: number
  status: '0' | '1' | '4'
  remark: string
  create_time: string
  modify_time: string
}

export interface BrandForm {
  name: string
  image_url: string
  sort: number
  status: '0' | '1'
  remark: string
}

export interface BrandQuery {
  page: number
  step: number
  name?: string
}

interface BrandPage {
  list: Brand[]
  total: number
  page: number
  step: number
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchBrandList(params: BrandQuery) {
  return giftMallRequest.post<BrandPage>('/admin/brand/list.json', params, jsonConfig)
}

export function fetchBrandDetail(id: number) {
  return giftMallRequest.post<Brand>('/admin/brand/show.json', { id }, jsonConfig)
}

export function createBrand(params: BrandForm) {
  return giftMallRequest.post<{ id: number }>('/admin/brand/create.json', params, jsonConfig)
}

export function updateBrand(params: Partial<BrandForm> & { id: number }) {
  return giftMallRequest.post<[]>('/admin/brand/update.json', params, jsonConfig)
}

export function deleteBrand(id: number) {
  return giftMallRequest.post<[]>('/admin/brand/delete.json', { id }, jsonConfig)
}

export function uploadBrandImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'brand' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
