<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { fetchKeqiOrders, fetchKeqiOrderStatuses } from '../api/keqiOrder'
import type { KeqiOrder, KeqiOrderFilters, OrderDateField } from '../api/keqiOrder'

const message = useMessage()
const dateFields: { label: string; value: OrderDateField }[] = [
  { label: '申请日期', value: 'applied_date' },
  { label: '核卡日期', value: 'heka_time' },
  { label: '激活日期', value: 'jihuo_time' },
  { label: '首刷日期', value: 'shoushua_time' },
  { label: '结算日期', value: 'settlement_time' },
]
const textFields = [
  { label: '订单号', key: 'order_sn', max: 64 },
  { label: '产品名称', key: 'product_name', max: 255 },
  { label: '申请人姓名', key: 'applicant_name', max: 64 },
  { label: '手机号后四位', key: 'mobile_last4', max: 4 },
  { label: '身份证后四位', key: 'applicant_id_card_last4', max: 4 },
] as const

function initialForm() {
  return {
    order_sn: '', product_name: '', applicant_name: '', mobile_last4: '', applicant_id_card_last4: '',
    product_id: null as number | null, order_status: null as string | null,
    date_field: dateFields[0].value, date_from: null as string | null, date_to: null as string | null,
  }
}

const form = reactive(initialForm())
let filters: KeqiOrderFilters = {}
const rows = ref<KeqiOrder[]>([])
const statuses = ref<{ label: string; value: string }[]>([])
const statusError = ref(false)
const loading = ref(false)
const listError = ref(false)
const pagination = reactive({
  page: 1, pageSize: 10, itemCount: 0, showSizePicker: true, pageSizes: [10, 20, 50, 100],
  prefix: ({ itemCount }: { itemCount?: number }) => `总数：${itemCount ?? 0}`,
})
let requestId = 0

async function loadList() {
  const id = ++requestId
  loading.value = true
  listError.value = false
  try {
    const { data, error } = await fetchKeqiOrders({ ...filters, page: pagination.page, step: pagination.pageSize })
    if (id !== requestId)
      return
    if (error || !data)
      throw new Error()
    rows.value = data.list
    pagination.itemCount = data.total
  }
  catch {
    if (id === requestId) {
      rows.value = []
      pagination.itemCount = 0
      listError.value = true
    }
  }
  finally {
    if (id === requestId)
      loading.value = false
  }
}

async function loadStatuses() {
  statusError.value = false
  try {
    const { data, error } = await fetchKeqiOrderStatuses()
    if (error || !data)
      throw new Error()
    statuses.value = data.keqi_order_status
  }
  catch {
    statusError.value = true
  }
}

function search() {
  const query: KeqiOrderFilters = {}
  for (const { key } of textFields) {
    const value = form[key].trim()
    if (value)
      query[key] = value
  }
  if (query.mobile_last4 && !/^\d{4}$/.test(query.mobile_last4))
    return message.warning('请输入手机号后四位数字')
  if (query.applicant_id_card_last4 && !/^\d{3}[\dXx]$/.test(query.applicant_id_card_last4))
    return message.warning('请输入身份证后四位，末位可为 X')
  if (form.date_from && form.date_to && form.date_from > form.date_to)
    return message.warning('结束日期不能早于开始日期')
  if (form.product_id !== null)
    query.product_id = form.product_id
  if (form.order_status)
    query.order_status = form.order_status
  if (form.date_from || form.date_to)
    query.date_field = form.date_field
  if (form.date_from)
    query.date_from = form.date_from
  if (form.date_to)
    query.date_to = form.date_to
  filters = query
  changePage(1)
}

function reset() {
  Object.assign(form, initialForm())
  search()
}

function changePage(page: number) {
  pagination.page = page
  loadList()
}

function changePageSize(size: number) {
  pagination.pageSize = size
  changePage(1)
}

function reward(fen: number | null) {
  return fen === null ? '—' : (fen / 100).toFixed(2)
}

const columns: DataTableColumns<KeqiOrder> = [
  { title: '订单号', key: 'order_sn', width: 200, ellipsis: { tooltip: true } },
  { title: '订单状态', key: 'order_status_text', width: 100 },
  { title: '申请人姓名', key: 'applicant_name', width: 120 },
  { title: '申请人手机号', key: 'applicant_mobile', width: 140 },
  { title: '身份证后四位', key: 'applicant_id_card_last4', width: 120 },
  { title: '产品名称', key: 'product_name', width: 200, ellipsis: { tooltip: true } },
  { title: '产品 ID', key: 'product_id', width: 100 },
  ...dateFields.map(({ label, value }) => ({ title: label, key: value, width: 120 })),
  { title: '核卡奖励（元）', key: 'heka_reward_fen', width: 135, render: row => reward(row.heka_reward_fen) },
  { title: '激活奖励（元）', key: 'jihuo_reward_fen', width: 135, render: row => reward(row.jihuo_reward_fen) },
  { title: '首刷奖励（元）', key: 'shoushua_reward_fen', width: 135, render: row => reward(row.shoushua_reward_fen) },
  { title: '结算规则', key: 'settlement_rule', width: 200, ellipsis: { tooltip: true } },
  { title: '更新时间', key: 'modify_time', width: 180 },
  { title: 'ID', key: 'id', width: 90 },
]
const rowKey = (row: KeqiOrder) => row.id

onMounted(() => {
  loadStatuses()
  loadList()
})
</script>

<template>
  <div class="h-full">
    <n-card class="shadow-sm rounded-5px">
      <n-form label-placement="top" :show-feedback="false" @submit.prevent="search">
        <n-grid cols="1 s:2 m:3 l:4" responsive="screen" :x-gap="16" :y-gap="12">
          <n-form-item-gi v-for="field in textFields" :key="field.key" :label="field.label">
            <n-input v-model:value="form[field.key]" clearable :maxlength="field.max" :placeholder="`请输入${field.label}`" />
          </n-form-item-gi>
          <n-form-item-gi label="产品 ID">
            <n-input-number v-model:value="form.product_id" clearable :min="1" :precision="0" class="w-full" />
          </n-form-item-gi>
          <n-form-item-gi label="订单状态">
            <n-select v-model:value="form.order_status" clearable :options="statuses" placeholder="全部状态" />
          </n-form-item-gi>
          <n-form-item-gi label="日期类型">
            <n-select v-model:value="form.date_field" :options="dateFields" />
          </n-form-item-gi>
          <n-form-item-gi label="开始日期">
            <n-date-picker v-model:formatted-value="form.date_from" type="date" value-format="yyyy-MM-dd" clearable class="w-full" />
          </n-form-item-gi>
          <n-form-item-gi label="结束日期">
            <n-date-picker v-model:formatted-value="form.date_to" type="date" value-format="yyyy-MM-dd" clearable class="w-full" />
          </n-form-item-gi>
        </n-grid>
        <n-space class="mt-15px">
          <n-button type="primary" attr-type="submit">
            查询
          </n-button>
          <n-button @click="reset">
            重置
          </n-button>
        </n-space>
      </n-form>
      <n-alert v-if="statusError" type="error" class="mt-10px">
        订单状态加载失败。
        <n-button size="small" @click="loadStatuses">
          重试
        </n-button>
      </n-alert>
    </n-card>
    <n-card title="科启订单" class="shadow-sm rounded-5px mt-5px">
      <template #header-extra>
        <n-button :loading="loading" @click="loadList">
          刷新
        </n-button>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        订单列表加载失败，请刷新重试。
      </n-alert>
      <n-data-table
        remote :columns="columns" :data="rows" :row-key="rowKey" :loading="loading"
        :pagination="pagination" :scroll-x="2455"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
  </div>
</template>
