import { createRequest } from '@/service/request/request'

const serviceEnv = {
  dev: { url: 'https://api-rem.llnovel.com' },
  test: { url: 'https://api-rem.llnovel.com' },
  pre: { url: 'https://api-rem.errli.cn' },
  prod: { url: 'https://api-rem.errli.cn' },
}

export function getServiceEnvConfig(env: ImportMetaEnv) {
  const { VITE_SERVICE_ENV = 'dev' } = env
  return serviceEnv[VITE_SERVICE_ENV]
}

export const giftMallRequest = createRequest({ baseURL: getServiceEnvConfig(import.meta.env).url })
