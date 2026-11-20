import { giftMallRequest } from '../config/request'

export interface ExchangeRule {
  min_supply_price: number
  tiers: { end_price: number; base_price: number; card_count: number }[]
}

interface ExchangeResult {
  card_count: number
  surcharge_price: number
  exchange_text: string
}

const jsonConfig = { headers: { 'Content-Type': 'application/json' } }

export function fetchExchangeRule() {
  return giftMallRequest.post<ExchangeRule>('/admin/exchange_rule/show.json', {}, jsonConfig)
}

export function saveExchangeRule(rule: ExchangeRule) {
  return giftMallRequest.post<[]>('/admin/exchange_rule/save.json', rule, jsonConfig)
}

export function calculateExchange(prices: number[]) {
  return giftMallRequest.post<{ list: ExchangeResult[] }>('/admin/exchange_rule/calculate.json', { supply_prices: prices }, jsonConfig)
}
