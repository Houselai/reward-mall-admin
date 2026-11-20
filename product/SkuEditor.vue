<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { ProductDetail, ProductSpec } from '../api/product'
import { calculateExchange } from '../api/exchangeRule'
import ProductImages from './ProductImages.vue'
import { buildSkuData, centsToYuan, completeSkuRows, skuDraft, yuanToCents } from './sku'

const props = defineProps<{ product: ProductDetail | null; readonly: boolean; disabled: boolean }>()
const emit = defineEmits<{
  (event: 'uploading', value: boolean): void
  (event: 'calculating', value: boolean): void
}>()
const calculating = ref(false)
const specs = ref<ProductSpec[]>(props.product?.specs.map(spec => ({ name: spec.name, values: [...spec.values] })) ?? [])
const rows = ref(props.product ? props.product.skus.map(sku => skuDraft(specs.value, sku)) : [skuDraft([])])
const activeKey = ref(rows.value[0]?.key)
const active = computed(() => rows.value.find(row => row.key === activeKey.value))
const optionalNumberHint = computed(() => active.value?.id ? '留空保留原值，填 0 清零' : '留空按 0 保存')
const blocked = computed(() => props.readonly || props.disabled)
const message = useMessage()
const statusOptions = [{ label: '上架', value: '1' }, { label: '下架', value: '0' }]

function addSpec() {
  specs.value.push({ name: '', values: [] })
  rows.value.forEach(row => row.values.push(null))
}
function removeSpec(index: number) {
  specs.value.splice(index, 1)
  rows.value.forEach(row => row.values.splice(index, 1))
}
function updateValues(index: number, values: string[]) {
  specs.value[index].values = values
  for (const row of rows.value) {
    const value = row.values[index]
    if (value !== null && !values.includes(value))
      row.values[index] = null
  }
}
function addSku() {
  const row = skuDraft(specs.value)
  rows.value.push(row)
  activeKey.value = row.key
}
function completeSkus() {
  try {
    const count = completeSkuRows(specs.value, rows.value)
    if (count)
      message.success(`已补齐 ${count} 个 SKU 组合`)
    else
      message.info('已包含全部规格组合')
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '请检查规格配置')
  }
}
function removeSku(index: number) {
  const [removed] = rows.value.splice(index, 1)
  if (removed.key === activeKey.value)
    activeKey.value = rows.value[Math.min(index, rows.value.length - 1)]?.key
}
function setMain(checked: boolean) {
  rows.value.forEach(row => { row.is_main = checked && row.key === activeKey.value })
}
function changeStatus(status: '0' | '1') {
  if (!active.value)
    return
  active.value.status = status
  if (status === '0')
    active.value.is_main = false
}

async function calculateSkus() {
  if (blocked.value || calculating.value)
    return
  calculating.value = true
  emit('calculating', true)
  try {
    const prices = rows.value.map((row, i) => yuanToCents(row.supply, `第 ${i + 1} 个 SKU 的供应链价`))
    const { data, error } = await calculateExchange(prices)
    if (error || !data)
      return
    if (data.list.length !== prices.length)
      throw new Error('试算结果数量与 SKU 数量不一致')
    data.list.forEach((result, i) => {
      const row = rows.value[i]
      row.cards = result.card_count
      row.surcharge = centsToYuan(result.surcharge_price)
      row.exchange_text = result.exchange_text
    })
    message.success('已回填全部 SKU 的兑换信息，保存商品后生效')
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '试算失败，请重试')
  }
  finally {
    calculating.value = false
    emit('calculating', false)
  }
}

function getData() {
  return buildSkuData(specs.value, rows.value, props.product?.skus ?? [])
}
defineExpose({ getData })
</script>

<template>
  <div>
    <n-form-item label="商品规格">
      <div class="w-full">
        <p v-if="!specs.length" class="mb-5px">无规格（默认款）</p>
        <div v-for="(spec, index) in specs" :key="index" class="dimension">
          <n-input v-model:value="spec.name" :disabled="blocked" :maxlength="50" placeholder="规格名称，如颜色" />
          <n-dynamic-tags :value="spec.values" :disabled="blocked" :input-props="{ maxlength: 100, placeholder: '输入规格值' }" @update:value="values => updateValues(index, values)">
            <template #trigger="{ activate, disabled: triggerDisabled }">
              <n-button v-if="!readonly" size="small" :disabled="triggerDisabled" dashed @click="activate">添加规格值</n-button>
            </template>
          </n-dynamic-tags>
          <n-button v-if="!readonly" size="small" :disabled="disabled" @click="removeSpec(index)">移除维度</n-button>
        </div>
        <n-button v-if="!readonly" size="small" :disabled="disabled" @click="addSpec">添加规格维度</n-button>
      </div>
    </n-form-item>
    <div class="sku-list">
      <n-table size="small" :single-line="false">
        <thead><tr><th>SKU / 规格组合</th><th>供应链价格（元）</th><th>卡数量</th><th>补差价（元）</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.key" :class="{ selected: row.key === activeKey }">
            <td>
              {{ specs.length ? row.values.map(value => value || '待选择').join(' / ') : '默认规格' }}
              <n-tag v-if="row.is_main" size="small" type="success">主推</n-tag>
            </td>
            <td>{{ row.supply || '—' }}</td>
            <td>{{ row.cards ?? (row.id ? '保留原值' : 0) }}</td>
            <td>{{ row.surcharge || (row.id ? '保留原值' : '0.00') }}</td>
            <td>{{ row.status === '1' ? '上架' : '下架' }}</td>
            <td>
              <n-space>
                <n-button text type="primary" :disabled="disabled" @click="activeKey = row.key">{{ readonly ? '查看' : '编辑' }}</n-button>
                <n-button v-if="!readonly" text type="error" :disabled="disabled || rows.length === 1" @click="removeSku(index)">移除</n-button>
              </n-space>
            </td>
          </tr>
        </tbody>
      </n-table>
    </div>
    <n-space v-if="!readonly" class="mt-10px">
      <n-button size="small" :disabled="disabled || (!specs.length && rows.length > 0)" @click="addSku">新增 SKU</n-button>
      <n-button size="small" :disabled="disabled || !specs.length" @click="completeSkus">一键补齐 SKU</n-button>
      <n-button size="small" :loading="calculating" :disabled="disabled || !rows.length" @click="calculateSkus">一键计算卡数和差价</n-button>
    </n-space>
    <n-card v-if="active" :key="active.key" size="small" class="mt-15px" :title="active.id ? `SKU #${active.id}` : `SKU ${rows.indexOf(active) + 1}`">
      <n-form label-placement="top" :disabled="blocked">
        <div class="sku-fields">
          <n-form-item v-for="(spec, index) in specs" :key="index" :label="spec.name || '规格值'" required>
            <n-select v-model:value="active.values[index]" :options="spec.values.map(value => ({ label: value, value }))" placeholder="选择规格值" />
          </n-form-item>
          <n-form-item label="供应链价格（元）" required>
            <n-input v-model:value="active.supply" placeholder="如 29.90" />
          </n-form-item>
          <n-form-item label="卡数量">
            <n-input-number v-model:value="active.cards" :min="0" :max="4294967295" :precision="0" :placeholder="optionalNumberHint" />
          </n-form-item>
          <n-form-item label="补差价（元）">
            <n-input v-model:value="active.surcharge" :placeholder="optionalNumberHint" />
          </n-form-item>
          <n-form-item label="SKU 状态">
            <n-select :value="active.status" :options="statusOptions" @update:value="changeStatus" />
          </n-form-item>
        </div>
        <n-form-item label="主推 SKU">
          <n-checkbox :checked="active.is_main" :disabled="blocked || active.status !== '1'" @update:checked="setMain">
            设为主推（未指定时自动选第一个上架 SKU）
          </n-checkbox>
        </n-form-item>
        <n-form-item label="兑换文案">
          <n-input v-model:value="active.exchange_text" :maxlength="100" show-count placeholder="留空时按卡数量和补差价生成" />
        </n-form-item>
        <n-form-item label="SKU 图片">
          <ProductImages v-model:value="active.images" :readonly="readonly" :disabled="disabled" empty-text="使用商品图片" @uploading="value => $emit('uploading', value)" />
        </n-form-item>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.dimension {
  display: grid;
  grid-template-columns: minmax(100px, 150px) 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.sku-list { max-height: 280px; overflow: auto; }
.selected td { background-color: var(--n-td-color-striped); }
.sku-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0 12px; }
</style>
