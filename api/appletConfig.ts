import { giftMallRequest } from '../config/request'

export type AppletConfigValue = string | number | boolean | string[]

interface AppletConfigMetadata {
  key: string
  name: string
  desc: string
  default_value: AppletConfigValue
}

export type AppletConfig = AppletConfigMetadata & (
  | { type: 'string'; value: string }
  | { type: 'pic'; value: string }
  | { type: 'integer'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'array[str]'; value: string[] }
)

export interface AppletConfigSaveItem {
  key: string
  value: AppletConfigValue
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchAppletConfigs() {
  return giftMallRequest.post<{ list: AppletConfig[] }>('/admin/applet_config/list.json', {}, jsonConfig)
}

export function saveAppletConfigs(items: AppletConfigSaveItem[]) {
  return giftMallRequest.post<[]>('/admin/applet_config/save.json', { items }, jsonConfig)
}

export function uploadAppletConfigImage(img: File) {
  return giftMallRequest.post<{ path: string; url: string }>('/admin/tool/upload.json', { img, path: 'applet_config' }, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
