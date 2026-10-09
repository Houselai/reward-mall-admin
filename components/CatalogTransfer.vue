<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { exportCatalog, importCatalog } from '../api/catalogTransfer'
import type { CatalogExport, CatalogImport, CatalogImportError, CatalogModule } from '../api/catalogTransfer'

const props = defineProps<{ module: CatalogModule }>()
const emit = defineEmits<{ (event: 'imported'): void }>()
const message = useMessage()
const label = computed(() => ({ product: '商品', category: '分类', brand: '品牌' }[props.module]))
const show = ref(false)
const mode = ref<'import' | 'export'>('import')
const importing = ref(false)
const exporting = ref(false)
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const result = ref<CatalogImport | null>(null)
const exported = ref<CatalogExport | null>(null)
const errors = ref<CatalogImportError[]>([])
const failure = ref('')
const columns: DataTableColumns<CatalogImportError> = [
  { title: 'Excel 行号', key: 'row', width: 110 },
  { title: '列名', key: 'column', width: 140 },
  { title: '字段', key: 'field', width: 140 },
  { title: '错误原因', key: 'message', minWidth: 260 },
]

function openImport() {
  mode.value = 'import'
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
    const response = await importCatalog(props.module, file.value)
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

async function handleExport() {
  if (exporting.value)
    return
  exporting.value = true
  exported.value = null
  try {
    const { error, data } = await exportCatalog(props.module)
    if (error || !data)
      return
    exported.value = data
    mode.value = 'export'
    show.value = true
  }
  catch {
    message.error('导出失败，请重试')
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <n-space>
    <n-button :disabled="importing || exporting" @click="openImport">
      导入
    </n-button>
    <n-button :loading="exporting" :disabled="importing || exporting" @click="handleExport">
      导出全部
    </n-button>
  </n-space>
  <n-modal
    v-model:show="show" preset="card" :title="`${mode === 'import' ? '导入' : '导出'}${label}`"
    class="w-800px max-w-95vw" :mask-closable="false" :closable="!importing" :close-on-esc="!importing"
  >
    <template v-if="mode === 'import'">
      <n-alert type="info" class="mb-15px">
        请先使用“导出全部”获取模板，保留 {{ module }} 工作表及全部中文表头。
        仅支持 XLSX，最大 10 MiB、10000 行。ID 留空新增，已有 ID 完整行更新，可选文本留空会清空原值；未出现的记录不删除。
        任一行校验或写入失败，整份文件不保存。
        <div v-if="module !== 'brand'">
          请先导入一级分类，再导入二级分类，最后导入商品；商品引用的品牌也需先存在。
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
    <template v-else-if="exported">
      <n-alert type="success" class="mb-15px">
        已导出全部 {{ exported.total }} 条未删除{{ label }}，包含启用和禁用数据，不受列表筛选及分页影响。
      </n-alert>
      <n-button tag="a" type="primary" :href="exported.url" :download="exported.filename" target="_blank" rel="noopener noreferrer">
        下载 {{ exported.filename }}
      </n-button>
    </template>
  </n-modal>
</template>
