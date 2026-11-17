<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { exportOtherOrders, fetchOtherOrders, fetchOtherOrderStatuses, updateOtherOrderStatus } from '../api/otherOrder'
import type { OtherOrder, OtherOrderFilters, OtherOrderStatus } from '../api/otherOrder'
import type { CatalogExport } from '../api/catalogTransfer'
import OtherOrderImport from './OtherOrderImport.vue'

const message = useMessage()
const textFields = [
  { label: '姓名', key: 'applicant_name', max: 64 },
  { label: '电话后四位', key: 'mobile_last4', max: 4 },
  { label: '申请卡种', key: 'card_type', max: 255 },
] as const

function initialForm() {
  return {
    applicant_name: '', mobile_last4: '', card_type: '',
    order_status: null as OtherOrderStatus | null,
    date_from: null as string | null, date_to: null as string | null,
  }
}

const form = reactive(initialForm())
let filters: OtherOrderFilters = {}
const rows = ref<OtherOrder[]>([])
const statuses = ref<{ label: string; value: OtherOrderStatus }[]>([])
const statusError = ref(false)
const loading = ref(false)
const exporting = ref(false)
const exported = ref<CatalogExport | null>(null)
const showExport = ref(false)
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
    const { data, error } = await fetchOtherOrders({ ...filters, page: pagination.page, step: pagination.pageSize })
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
    const { data, error } = await fetchOtherOrderStatuses()
    if (error || !data)
      throw new Error()
    statuses.value = data.other_order_status
  }
  catch {
    statusError.value = true
  }
}

function search() {
  const query: OtherOrderFilters = {}
  for (const { key } of textFields) {
    const value = form[key].trim()
    if (value)
      query[key] = value
  }
  if (query.mobile_last4 && !/^\d{4}$/.test(query.mobile_last4))
    return message.warning('请输入手机号后四位数字')
  if (form.date_from && form.date_to && form.date_from > form.date_to)
    return message.warning('结束日期不能早于开始日期')
  if (form.order_status)
    query.order_status = form.order_status
  if (form.date_from)
    query.date_from = form.date_from
  if (form.date_to)
    query.date_to = form.date_to
  filters = query
  changePage(1)
}

async function handleExport() {
  if (exporting.value)
    return
  exporting.value = true
  exported.value = null
  try {
    const { error, data } = await exportOtherOrders({ ...filters })
    if (error || !data)
      return
    exported.value = data
    showExport.value = true
  }
  catch {
    message.error('导出失败，请重试')
  }
  finally {
    exporting.value = false
  }
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

const editing = ref<OtherOrder | null>(null)
const showEdit = ref(false)
const editStatus = ref<OtherOrderStatus | null>(null)
const saving = ref(false)

function openEdit(row: OtherOrder) {
  editing.value = row
  editStatus.value = row.order_status
  showEdit.value = true
}

async function saveStatus() {
  if (!editing.value || !editStatus.value || saving.value)
    return
  saving.value = true
  try {
    const { error } = await updateOtherOrderStatus(editing.value.id, editStatus.value)
    if (error)
      return
    message.success('状态已更新')
    showEdit.value = false
    await loadList()
  }
  catch {
    message.error('保存结果未确认，请刷新列表核对后再操作')
  }
  finally {
    saving.value = false
  }
}

const columns: DataTableColumns<OtherOrder> = [
  { title: '姓名', key: 'applicant_name', width: 120 },
  { title: '电话', key: 'applicant_mobile', width: 140 },
  { title: '申请卡种', key: 'card_type', width: 240, ellipsis: { tooltip: true } },
  { title: '申请时间', key: 'applied_time', width: 180 },
  { title: '当前状态', key: 'order_status_text', width: 100 },
  { title: '更新时间', key: 'modify_time', width: 180 },
  {
    title: '操作', key: 'actions', width: 110, fixed: 'right',
    render: row => h(NButton, { size: 'small', disabled: !statuses.value.length || statusError.value, onClick: () => openEdit(row) }, { default: () => '编辑状态' }),
  },
]
const rowKey = (row: OtherOrder) => row.id

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
          <n-form-item-gi label="订单状态">
            <n-select v-model:value="form.order_status" clearable :options="statuses" placeholder="全部状态" />
          </n-form-item-gi>
          <n-form-item-gi label="申请开始日期">
            <n-date-picker v-model:formatted-value="form.date_from" type="date" value-format="yyyy-MM-dd" clearable class="w-full" />
          </n-form-item-gi>
          <n-form-item-gi label="申请结束日期">
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
    <n-card title="其他订单" class="shadow-sm rounded-5px mt-5px">
      <template #header-extra>
        <n-space>
          <OtherOrderImport @imported="changePage(1)" />
          <n-button :loading="exporting" :disabled="loading || exporting || listError" @click="handleExport">
            导出列表
          </n-button>
          <n-button :loading="loading" @click="loadList">
            刷新
          </n-button>
        </n-space>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        订单列表加载失败，请刷新重试。
      </n-alert>
      <n-data-table
        remote :columns="columns" :data="rows" :row-key="rowKey" :loading="loading"
        :pagination="pagination" :scroll-x="1070"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
    <n-modal v-model:show="showEdit" preset="card" title="编辑订单状态" class="w-520px max-w-95vw" :mask-closable="false" :closable="!saving" :close-on-esc="!saving">
      <template v-if="editing">
        <n-descriptions :column="1" bordered class="mb-15px">
          <n-descriptions-item label="姓名">
            {{ editing.applicant_name }}
          </n-descriptions-item>
          <n-descriptions-item label="电话">
            {{ editing.applicant_mobile }}
          </n-descriptions-item>
          <n-descriptions-item label="申请卡种">
            {{ editing.card_type }}
          </n-descriptions-item>
        </n-descriptions>
        <n-form-item label="当前状态" required>
          <n-select v-model:value="editStatus" :options="statuses" :disabled="saving" />
        </n-form-item>
        <n-space justify="end">
          <n-button :disabled="saving" @click="showEdit = false">
            取消
          </n-button>
          <n-button type="primary" :loading="saving" :disabled="saving || !editStatus" @click="saveStatus">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
    <n-modal v-model:show="showExport" preset="card" title="其他订单导出" class="w-520px max-w-95vw">
      <template v-if="exported">
        <n-alert type="success" class="mb-15px">
          已按列表查询条件导出 {{ exported.total }} 条订单，包含全部分页数据。
        </n-alert>
        <n-button tag="a" type="primary" :href="exported.url" :download="exported.filename" target="_blank" rel="noopener noreferrer">
          下载 {{ exported.filename }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>
