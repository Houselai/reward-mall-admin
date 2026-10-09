<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import { NButton, NImage, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { componentType } from '@/components/business/QueryForm/types'
import type { FormItemsProps } from '@/components/business/QueryForm/types'
import { createBrand, deleteBrand, fetchBrandDetail, fetchBrandList, updateBrand, uploadBrandImage } from '../api/brand'
import type { Brand, BrandForm } from '../api/brand'

const message = useMessage()
const dialog = useDialog()
const rows = ref<Brand[]>([])
const rowKey = (row: Brand) => row.id
const loading = ref(false)
const listError = ref(false)
const name = ref('')
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  prefix: ({ itemCount }: { itemCount?: number }) => `总数：${itemCount ?? 0}`,
})
const formItems: FormItemsProps = [{
  label: '品牌名称',
  field: 'name',
  component: componentType.input,
  componentProps: { maxlength: 100 },
}]
let listRequestId = 0

async function loadList() {
  const requestId = ++listRequestId
  loading.value = true
  listError.value = false
  try {
    const { error, data } = await fetchBrandList({ page: pagination.page, step: pagination.pageSize, name: name.value })
    if (requestId !== listRequestId)
      return
    if (error || !data) {
      listError.value = true
      return
    }
    const lastPage = Math.max(1, Math.ceil(data.total / pagination.pageSize))
    if (pagination.page > lastPage) {
      pagination.page = lastPage
      await loadList()
      return
    }
    rows.value = data.list
    pagination.itemCount = data.total
  }
  finally {
    if (requestId === listRequestId)
      loading.value = false
  }
}

function handleSearch(options: { name?: string }) {
  name.value = (options.name || '').trim()
  pagination.page = 1
  loadList()
}

function changePage(page: number) {
  pagination.page = page
  loadList()
}

function changePageSize(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  loadList()
}

const showModal = ref(false)
const mode = ref<'create' | 'edit' | 'detail'>('create')
const modalTitle = computed(() => ({ create: '新增品牌', edit: '编辑品牌', detail: '品牌详情' }[mode.value]))
const readonly = computed(() => mode.value === 'detail')
const saving = ref(false)
const uploading = ref(false)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const formRef = ref<FormInst | null>(null)
const editId = ref<number | null>(null)
const detail = ref<Brand | null>(null)
const form = reactive<BrandForm>({ name: '', image_url: '', sort: 0, status: '1', remark: '' })
const statusOptions = [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }]
const rules: FormRules = {
  name: { required: true, whitespace: true, max: 100, message: '请输入品牌名称，最多100字', trigger: ['input', 'blur'] },
  image_url: { required: true, whitespace: true, max: 512, message: '请上传图片或填写图片 URL / OSS key，最多512字', trigger: ['input', 'blur'] },
  sort: {
    required: true,
    type: 'number',
    validator: (_rule, value: number) => Number.isSafeInteger(value) && value >= 0,
    message: '排序必须为非负整数',
    trigger: ['change', 'blur'],
  },
  status: { required: true, message: '请选择状态', trigger: 'change' },
  remark: { max: 128, message: '备注最多128字', trigger: ['input', 'blur'] },
}

function openCreate() {
  mode.value = 'create'
  editId.value = null
  detail.value = null
  Object.assign(form, { name: '', image_url: '', sort: 0, status: '1', remark: '' })
  formRef.value?.restoreValidation()
  showModal.value = true
}

async function openBrand(row: Brand, targetMode: 'edit' | 'detail') {
  detailLoadingId.value = row.id
  try {
    const { error, data } = await fetchBrandDetail(row.id)
    if (error || !data)
      return
    mode.value = targetMode
    editId.value = data.id
    detail.value = data
    Object.assign(form, {
      name: data.name,
      image_url: data.image_url,
      sort: data.sort,
      status: data.status,
      remark: data.remark || '',
    })
    formRef.value?.restoreValidation()
    showModal.value = true
  }
  finally {
    detailLoadingId.value = null
  }
}

async function saveBrand() {
  if (saving.value || uploading.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }
  saving.value = true
  try {
    const params: BrandForm = { ...form, name: form.name.trim(), image_url: form.image_url.trim() }
    const res = mode.value === 'create'
      ? await createBrand(params)
      : await updateBrand({ ...params, id: editId.value! })
    if (res.error)
      return
    message.success(mode.value === 'create' ? '新增成功' : '保存成功')
    showModal.value = false
    await loadList()
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(row: Brand) {
  dialog.warning({
    title: '删除品牌',
    content: `确定删除品牌“${row.name}”吗？删除后该品牌将不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        const { error } = await deleteBrand(row.id)
        if (error)
          return false
        message.success('删除成功')
        await loadList()
      }
      finally {
        deletingId.value = null
      }
    },
  })
}

async function uploadImage({ file, onFinish, onError }: UploadCustomRequestOptions) {
  if (!file.file) {
    onError()
    return
  }
  uploading.value = true
  try {
    const { error, data } = await uploadBrandImage(file.file)
    if (error || !data) {
      onError()
      return
    }
    form.image_url = data.url
    onFinish()
    message.success('上传成功')
  }
  catch {
    onError()
  }
  finally {
    uploading.value = false
  }
}

function closeModal() {
  if (!saving.value && !uploading.value)
    showModal.value = false
}

const columns: DataTableColumns<Brand> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '品牌名称', key: 'name', width: 180 },
  {
    title: '品牌图片', key: 'image_url', width: 160,
    render: row => /^https?:\/\//i.test(row.image_url)
      ? h(NImage, { src: row.image_url, width: 60, height: 60, objectFit: 'contain' })
      : row.image_url,
  },
  { title: '排序', key: 'sort', width: 80 },
  {
    title: '状态', key: 'status', width: 90,
    render: row => h(NTag, { type: row.status === '1' ? 'success' : 'default' }, { default: () => row.status === '1' ? '启用' : '禁用' }),
  },
  { title: '备注', key: 'remark', width: 180 },
  { title: '创建时间', key: 'create_time', width: 180 },
  { title: '修改时间', key: 'modify_time', width: 180 },
  {
    title: '操作', key: 'actions', width: 200, fixed: 'right',
    render: row => h(NSpace, {}, { default: () => [
      h(NButton, { size: 'small', disabled: detailLoadingId.value !== null, onClick: () => openBrand(row, 'detail') }, { default: () => '详情' }),
      h(NButton, { size: 'small', type: 'primary', loading: detailLoadingId.value === row.id, disabled: detailLoadingId.value !== null, onClick: () => openBrand(row, 'edit') }, { default: () => '编辑' }),
      h(NButton, { size: 'small', type: 'error', loading: deletingId.value === row.id, disabled: deletingId.value !== null, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
    ] }),
  },
]
</script>

<template>
  <div class="h-full">
    <n-card class="shadow-sm rounded-5px">
      <QueryForm :form-items="formItems" @search="handleSearch" />
    </n-card>
    <n-card title="品牌管理" class="shadow-sm rounded-5px mt-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" @click="loadList">
            刷新
          </n-button>
          <n-button type="primary" :disabled="detailLoadingId !== null" @click="openCreate">
            新增品牌
          </n-button>
        </n-space>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        品牌列表加载失败，请刷新重试。
      </n-alert>
      <n-data-table
        remote :columns="columns" :data="rows" :loading="loading" :pagination="pagination"
        :row-key="rowKey" :scroll-x="1430"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
    <n-modal
      :show="showModal" preset="card" :title="modalTitle" class="w-640px max-w-95vw"
      :mask-closable="false" :close-on-esc="!saving && !uploading" :closable="!saving && !uploading"
      @update:show="closeModal"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" :label-width="100" :disabled="readonly || saving">
        <n-form-item label="品牌名称" path="name">
          <n-input v-model:value="form.name" :maxlength="100" show-count placeholder="请输入品牌名称" />
        </n-form-item>
        <n-form-item label="品牌图片" path="image_url">
          <div class="w-full">
            <n-input v-model:value="form.image_url" :maxlength="512" :disabled="readonly || saving || uploading" placeholder="图片 URL 或 OSS object key" />
            <n-upload v-if="!readonly" :custom-request="uploadImage" :show-file-list="false" accept="image/*" :disabled="saving || uploading" class="mt-10px">
              <n-button :loading="uploading" :disabled="saving || uploading">
                上传图片
              </n-button>
            </n-upload>
            <n-image v-if="/^https?:\/\//i.test(form.image_url)" :src="form.image_url" :width="100" class="mt-10px" />
          </div>
        </n-form-item>
        <n-form-item label="排序" path="sort">
          <n-input-number v-model:value="form.sort" :min="0" :precision="0" class="w-full" />
        </n-form-item>
        <n-form-item label="状态" path="status">
          <n-select v-model:value="form.status" :options="statusOptions" />
        </n-form-item>
        <n-form-item label="备注" path="remark">
          <n-input v-model:value="form.remark" type="textarea" :maxlength="128" show-count />
        </n-form-item>
        <template v-if="readonly && detail">
          <n-form-item label="ID">
            {{ detail.id }}
          </n-form-item>
          <n-form-item label="创建时间">
            {{ detail.create_time }}
          </n-form-item>
          <n-form-item label="修改时间">
            {{ detail.modify_time }}
          </n-form-item>
        </template>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button :disabled="saving || uploading" @click="closeModal">
            {{ readonly ? '关闭' : '取消' }}
          </n-button>
          <n-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="saveBrand">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
