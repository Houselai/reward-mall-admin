<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { importOtherOrders } from '../api/otherOrder'
import type { CatalogImport, CatalogImportError } from '../api/catalogTransfer'

const emit = defineEmits<{ (event: 'imported'): void }>()
const message = useMessage()
const show = ref(false)
const importing = ref(false)
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const result = ref<CatalogImport | null>(null)
const errors = ref<CatalogImportError[]>([])
const failure = ref('')
const columns: DataTableColumns<CatalogImportError> = [
  { title: 'Excel 行号', key: 'row', width: 110 },
  { title: '列名', key: 'column', width: 140 },
  { title: '字段', key: 'field', width: 140 },
  { title: '错误原因', key: 'message', minWidth: 260 },
]

function openImport() {
  file.value = null
  if (fileInput.value)
    fileInput.value.value = ''
  result.value = null
  errors.value = []
  failure.value = ''
  show.value = true
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = null
  result.value = null
  errors.value = []
  failure.value = ''
  const selected = input.files?.[0]
  if (!selected)
    return
  if (!/\.xlsx$/i.test(selected.name) || selected.size > 10 * 1024 * 1024 || selected.size === 0) {
    message.error('请选择非空的 XLSX 文件，大小不超过 10 MiB')
    input.value = ''
    return
  }
  file.value = selected
}

async function handleImport() {
  if (!file.value || importing.value)
    return
  importing.value = true
  errors.value = []
  result.value = null
  failure.value = ''
  try {
    const response = await importOtherOrders(file.value)
    if (response.error) {
      errors.value = response.errors
      failure.value = response.error.msg || '导入失败'
      return
    }
    result.value = response.data
    file.value = null
    if (fileInput.value)
      fileInput.value.value = ''
    message.success('导入成功')
    emit('imported')
  }
  catch {
    failure.value = '请求异常，结果未确认，请刷新列表核对后再操作。'
  }
  finally {
    importing.value = false
  }
}
</script>

<template>
  <n-button :disabled="importing" @click="openImport">
    导入 Excel
  </n-button>
  <n-modal
    v-model:show="show" preset="card" title="导入其他订单"
    class="w-800px max-w-95vw" :mask-closable="false" :closable="!importing" :close-on-esc="!importing"
  >
    <template #default>
      <n-alert type="info" class="mb-15px">
        可使用“导出列表”获取模板。仅支持单工作表 XLSX，最大 10 MiB、10000 行。
        表头必须包含姓名、电话、申请卡种、申请时间、当前状态、银行六列。每行仅银行可留空。
        电话格式如 132****1234。申请时间支持 Excel 日期或 YYYY-MM-DD、YYYY-MM-DD HH:mm:ss 文本。
        状态仅支持待确认、已核卡、已激活、已首刷、已达标。
        <div class="mt-10px">
          按“姓名＋电话＋申请卡种”匹配订单。未匹配到的订单会新增，匹配到的订单会覆盖银行、申请时间和状态，包括人工修改的状态。银行留空会清除原值。文件内重复记录或任一行校验失败，整份不保存。
        </div>
      </n-alert>
      <input ref="fileInput" type="file" accept=".xlsx" :disabled="importing" class="mb-15px" @change="selectFile">
      <n-alert v-if="result" type="success" class="mb-15px">
        导入成功：共 {{ result.total }} 行，新增 {{ result.created }} 行，更新 {{ result.updated }} 行，未变化 {{ result.unchanged }} 行。
      </n-alert>
      <n-alert v-if="failure" type="error" class="mb-15px">
        {{ failure }}
      </n-alert>
      <n-data-table v-if="errors.length" :columns="columns" :data="errors" :pagination="{ pageSize: 10 }" :scroll-x="650" />
      <n-space justify="end" class="mt-15px">
        <n-button :disabled="importing" @click="show = false">
          关闭
        </n-button>
        <n-button type="primary" :loading="importing" :disabled="!file || importing" @click="handleImport">
          确认导入
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>
