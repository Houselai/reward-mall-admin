import { giftMallRequest } from '../config/request'

export type BannerRedirectType = '0' | '1' | '2' | '3'

export interface Banner {
  id: number
  image_url: string
  redirect_type: BannerRedirectType
  redirect_value: string
  sort: number
  status: '0' | '1' | '4'
  create_time: string
  modify_time: string
}

export interface BannerForm {
  image_url: string
  redirect_type: BannerRedirectType
  redirect_value: string
  sort: number
  status: '0' | '1'
}

export interface BannerQuery {
  page: number
  step: number
}

interface BannerPage {
  list: Banner[]
  total: number
  page: number
  step: number
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchBannerList(params: BannerQuery) {
  return giftMallRequest.post<BannerPage>('/admin/banner/list.json', params, jsonConfig)
}

export function fetchBannerDetail(id: number) {
  return giftMallRequest.post<Banner>('/admin/banner/show.json', { id }, jsonConfig)
}

export function createBanner(params: BannerForm) {
  return giftMallRequest.post<{ id: number }>('/admin/banner/create.json', params, jsonConfig)
}

export function updateBanner(params: Partial<BannerForm> & { id: number }) {
  return giftMallRequest.post<[]>('/admin/banner/update.json', params, jsonConfig)
}

export function deleteBanner(id: number) {
  return giftMallRequest.post<[]>('/admin/banner/delete.json', { id }, jsonConfig)
}

export function uploadBannerImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'banner' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
