import { giftMallRequest } from '../config/request'

export type KingkongRedirectType = '0' | '1' | '2' | '3'

export interface KingkongItem {
  position: number
  name: string
  image_url: string
  redirect_type: KingkongRedirectType | null
  redirect_value: string
  create_time: string | null
  modify_time: string | null
}

export interface KingkongSaveItem {
  position: number
  name: string
  image_url: string
  redirect_type: KingkongRedirectType
  redirect_value: string
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchKingkongList() {
  return giftMallRequest.post<{ list: KingkongItem[] }>('/admin/kingkong/list.json', undefined, jsonConfig)
}

export function saveKingkong(items: KingkongSaveItem[]) {
  return giftMallRequest.post<[]>('/admin/kingkong/save.json', { items }, jsonConfig)
}

export function uploadKingkongImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'kingkong' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
