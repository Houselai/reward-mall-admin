import { giftMallRequest } from '../config/request'

export type KingkongRedirectType = '0' | '1' | '2' | '3'
export type KingkongArea = 1 | 2

export interface KingkongConfig {
  status: '0' | '1'
  name: string
  image_url: string
  redirect_type: KingkongRedirectType | null
  redirect_value: string
}

export interface KingkongItem extends KingkongConfig {
  id: number
  position: number
  create_time: string | null
  modify_time: string | null
}

export function hasKingkongContent(item: KingkongConfig) {
  return Boolean(item.name || item.image_url || item.redirect_type !== null || item.redirect_value)
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchKingkongList(area: KingkongArea) {
  return giftMallRequest.post<{ list: KingkongItem[] }>('/admin/kingkong/list.json', { area }, jsonConfig)
}

export function saveKingkong(area: KingkongArea, configs: KingkongConfig[]) {
  const items = configs.map(({ status, name, image_url, redirect_type, redirect_value }) => {
    const config = { status, name, image_url, redirect_type, redirect_value }
    return status === '0' && !hasKingkongContent(config) ? { status } : config
  })
  return giftMallRequest.post<[]>('/admin/kingkong/save.json', { area, items }, jsonConfig)
}

export function setKingkongStatus(id: number, status: KingkongConfig['status']) {
  return giftMallRequest.post<[]>('/admin/kingkong/status.json', { id, status }, jsonConfig)
}

export function uploadKingkongImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'kingkong' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
