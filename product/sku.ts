import type { ProductSku, ProductSkuInput, ProductSpec } from '../api/product'

export function centsToYuan(value: number) {
  const digits = String(value).padStart(3, '0')
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`
}

export function yuanToCents(value: string, label: string) {
  if (/^\d+(\.\d{1,2})?$/.test(value)) {
    const [whole, fraction = ''] = value.split('.')
    const cents = Number(whole + fraction.padEnd(2, '0'))
    if (Number.isSafeInteger(cents))
      return cents
  }
  throw new Error(`${label}须填写非负金额，最多两位小数`)
}

let nextKey = 0
export function skuDraft(specs: ProductSpec[], sku?: ProductSku) {
  return {
    key: ++nextKey,
    id: sku?.id,
    values: specs.map(spec => sku?.spec_values.find(item => item.name === spec.name)?.value ?? null),
    images: [...(sku?.images ?? [])],
    supply: sku ? centsToYuan(sku.supply_price) : '',
    cards: (sku?.card_count ?? 0) as number | null,
    surcharge: centsToYuan(sku?.surcharge_price ?? 0),
    exchange_text: sku?.exchange_text ?? '',
    status: sku?.status ?? '1',
    is_main: sku?.is_main ?? false,
  }
}

type SkuDraft = ReturnType<typeof skuDraft>

function validateSpecs(specs: ProductSpec[]) {
  const names = new Set<string>()
  for (const { name, values } of specs) {
    if (!name.trim() || name.length > 50 || names.has(name))
      throw new Error('请填写不重复的规格名称，最多 50 字')
    names.add(name)
    if (!values.length || values.some(value => !value.trim() || value.length > 100) || new Set(values).size !== values.length)
      throw new Error(`请为「${name}」填写不重复的规格值，每项最多 100 字`)
  }
}

function* combinations(dimensions: string[][], values: string[] = []): Generator<string[]> {
  if (values.length === dimensions.length) {
    yield [...values]
    return
  }
  for (const value of dimensions[values.length]) {
    values.push(value)
    yield* combinations(dimensions, values)
    values.pop()
  }
}

export function completeSkuRows(specs: ProductSpec[], rows: SkuDraft[]) {
  validateSpecs(specs)
  const dimensions = specs.map(spec => spec.values)
  const assigned = new Map<string, SkuDraft>()

  function reserve(row: SkuDraft, visited: Set<string>): boolean {
    const choices = dimensions.map((values, i) => row.values[i] == null ? values : values.filter(value => value === row.values[i]))
    for (const values of combinations(choices)) {
      const key = JSON.stringify(values)
      if (visited.has(key))
        continue
      visited.add(key)
      const previous = assigned.get(key)
      if (!previous || reserve(previous, visited)) {
        assigned.set(key, row)
        return true
      }
    }
    return false
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    if (!reserve(rows[i], new Set()))
      throw new Error(`第 ${i + 1} 个 SKU 无法分配独立的规格组合，请检查重复项或增加规格值`)
  }

  let completed = 0
  for (const values of combinations(dimensions)) {
    const existing = assigned.get(JSON.stringify(values))
    if (existing) {
      if (existing.values.some(value => value == null)) {
        existing.values = values
        completed++
      }
    }
    else {
      const row = skuDraft(specs)
      row.values = values
      rows.push(row)
      completed++
    }
  }
  return completed
}

export function buildSkuData(specs: ProductSpec[], rows: SkuDraft[], original: ProductSku[]) {
  validateSpecs(specs)
  if (!rows.length)
    throw new Error('请至少保留一个 SKU')
  const previous = new Map(original.map(sku => [sku.id, sku]))
  const combinations = new Set<string>()
  const skus: ProductSkuInput[] = []
  const changes: (ProductSkuInput | { id: number; status: '4' })[] = []
  for (const [index, row] of rows.entries()) {
    const label = `第 ${index + 1} 个 SKU`
    const specValues = specs.map((spec, dimension) => {
      const value = row.values[dimension]
      if (!value || !spec.values.includes(value))
        throw new Error(`请为${label}选择「${spec.name}」`)
      return { name: spec.name, value }
    })
    const combination = JSON.stringify(specValues)
    if (combinations.has(combination))
      throw new Error(`${label}的规格组合与前面的 SKU 重复`)
    combinations.add(combination)

    const old = row.id === undefined ? undefined : previous.get(row.id)
    if (row.cards !== null && (!Number.isInteger(row.cards) || row.cards < 0 || row.cards > 4294967295))
      throw new Error(`${label}的卡数量须为 0 至 4294967295 的整数`)
    const input: ProductSkuInput = {
      ...(old ? { id: old.id } : {}),
      spec_values: specValues,
      images: row.images.map(image => image.trim()).filter(Boolean),
      supply_price: yuanToCents(row.supply, `${label}的供应链价格`),
      exchange_text: row.exchange_text,
      status: row.status,
      is_main: row.is_main,
    }
    if (row.cards !== null && row.cards !== old?.card_count)
      input.card_count = row.cards
    if (row.surcharge !== '') {
      const cents = yuanToCents(row.surcharge, `${label}的补差价`)
      if (!old || cents !== (old.surcharge_price ?? 0))
        input.surcharge_price = cents
    }
    skus.push(input)
    if (old)
      previous.delete(old.id)
    if (!old || (Object.keys(input) as (keyof ProductSkuInput)[]).some(key => JSON.stringify(input[key]) !== JSON.stringify(old[key]))) {
      const change = { ...input }
      if (old && change.is_main === old.is_main)
        delete change.is_main
      changes.push(change)
    }
  }
  for (const id of previous.keys())
    changes.push({ id, status: '4' })
  return { specs, skus, changes }
}
