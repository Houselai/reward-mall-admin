<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NImage, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { createBanner, deleteBanner, fetchBannerDetail, fetchBannerList, updateBanner, uploadBannerImage } from '../api/banner'
import type { Banner, BannerForm } from '../api/banner'

const message = useMessage()
const dialog = useDialog()
const rows = ref<Banner[]>([])
const rowKey = (row: Banner) => row.id
const loading = ref(false)
const listError = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  prefix: ({ itemCount }: { itemCount?: number }) => `总数：${itemCount ?? 0}`,
})
let listRequestId = 0

async function loadList() {
  const requestId = ++listRequestId
  loading.value = true
  listError.value = false
  try {
    const { error, data } = await fetchBannerList({ page: pagination.page, step: pagination.pageSize })
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
const modalTitle = computed(() => ({ create: '新增 Banner', edit: '编辑 Banner', detail: 'Banner 详情' }[mode.value]))
const readonly = computed(() => mode.value === 'detail')
const saving = ref(false)
const uploading = ref(false)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const formRef = ref<FormInst | null>(null)
const editId = ref<number | null>(null)
const detail = ref<Banner | null>(null)
const form = reactive<BannerForm>({ image_url: '', redirect_type: '1', redirect_value: '', sort: 0, status: '1' })
const statusOptions = [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }]
const redirectOptions = [
  { label: '无动作', value: '0' },
  { label: 'H5', value: '1' },
  { label: '二级页', value: '2' },
  { label: '弹窗', value: '3' },
]
const rules: FormRules = {
  image_url: { required: true, whitespace: true, max: 512, message: '请上传图片或填写图片 URL / OSS key，最多512字', trigger: ['input', 'blur'] },
  sort: {
    required: true,
    type: 'number',
    validator: (_rule, value: number) => Number.isSafeInteger(value) && value >= 0,
    message: '排序必须为非负整数',
    trigger: ['change', 'blur'],
  },
  status: { required: true, message: '请选择状态', trigger: 'change' },
  redirect_type: { required: true, type: 'enum', enum: ['0', '1', '2', '3'], message: '请选择跳转类型', trigger: 'change' },
  redirect_value: { required: true, whitespace: true, max: 512, message: '请输入跳转值或上传弹窗图片，最多512字', trigger: ['input', 'blur'] },
}

function openCreate() {
  mode.value = 'create'
  editId.value = null
  detail.value = null
  Object.assign(form, { image_url: '', redirect_type: '1', redirect_value: '', sort: 0, status: '1' })
  formRef.value?.restoreValidation()
  showModal.value = true
}

async function openBanner(row: Banner, targetMode: 'edit' | 'detail') {
  detailLoadingId.value = row.id
  try {
    const { error, data } = await fetchBannerDetail(row.id)
    if (error || !data)
      return
    mode.value = targetMode
    editId.value = data.id
    detail.value = data
    Object.assign(form, {
      image_url: data.image_url,
      sort: Number(data.sort),
      status: String(data.status),
      redirect_type: String(data.redirect_type),
      redirect_value: data.redirect_value,
    })
    formRef.value?.restoreValidation()
    showModal.value = true
  }
  finally {
    detailLoadingId.value = null
  }
}

async function saveBanner() {
  if (saving.value || uploading.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }
  if (saving.value || uploading.value)
    return
  saving.value = true
  try {
    const params: BannerForm = {
      ...form,
      image_url: form.image_url.trim(),
      redirect_value: form.redirect_type === '0' ? '' : form.redirect_value.trim(),
    }
    const res = mode.value === 'create'
      ? await createBanner(params)
      : await updateBanner({ ...params, id: editId.value! })
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

function confirmDelete(row: Banner) {
  dialog.warning({
    title: '删除 Banner',
    content: `确定删除 Banner（ID：${row.id}）吗？删除后将不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        const { error } = await deleteBanner(row.id)
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

async function uploadImage({ file, onFinish, onError }: UploadCustomRequestOptions, field: 'image_url' | 'redirect_value' = 'image_url') {
  if (!file.file || uploading.value || saving.value || readonly.value) {
    onError()
    return
  }
  uploading.value = true
  try {
    const { error, data } = await uploadBannerImage(file.file)
    if (error || !data) {
      onError()
      return
    }
    form[field] = data.url
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

const columns: DataTableColumns<Banner> = [
  { title: 'ID', key: 'id', width: 80 },
  {
    title: 'Banner 图片', key: 'image_url', width: 160,
    render: row => /^https?:\/\//i.test(row.image_url)
      ? h(NImage, { src: row.image_url, width: 60, height: 60, objectFit: 'contain' })
      : row.image_url,
  },
  { title: '排序', key: 'sort', width: 80 },
  {
    title: '状态', key: 'status', width: 90,
    render: row => h(NTag, { type: String(row.status) === '1' ? 'success' : 'default' }, { default: () => String(row.status) === '1' ? '启用' : '禁用' }),
  },
  {
    title: '跳转类型', key: 'redirect_type', width: 100,
    render: row => redirectOptions.find(option => option.value === String(row.redirect_type))?.label || row.redirect_type,
  },
  { title: '跳转值', key: 'redirect_value', width: 260, ellipsis: { tooltip: true } },
  { title: '创建时间', key: 'create_time', width: 180 },
  { title: '修改时间', key: 'modify_time', width: 180 },
  {
    title: '操作', key: 'actions', width: 200, fixed: 'right',
    render: row => h(NSpace, {}, { default: () => [
      h(NButton, { size: 'small', disabled: detailLoadingId.value !== null, onClick: () => openBanner(row, 'detail') }, { default: () => '详情' }),
      h(NButton, { size: 'small', type: 'primary', loading: detailLoadingId.value === row.id, disabled: detailLoadingId.value !== null, onClick: () => openBanner(row, 'edit') }, { default: () => '编辑' }),
      h(NButton, { size: 'small', type: 'error', loading: deletingId.value === row.id, disabled: deletingId.value !== null, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
    ] }),
  },
]

onMounted(loadList)
</script>

<template>
  <div class="h-full">
    <n-card title="Banner 管理" class="shadow-sm rounded-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" @click="loadList">
            刷新
          </n-button>
          <n-button type="primary" :disabled="detailLoadingId !== null" @click="openCreate">
            新增 Banner
          </n-button>
        </n-space>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        Banner 列表加载失败，请刷新重试。
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
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" :label-width="100" :disabled="readonly || saving || uploading">
        <n-form-item label="Banner 图片" path="image_url">
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
        <n-form-item label="跳转类型" path="redirect_type">
          <n-select v-model:value="form.redirect_type" :options="redirectOptions" @update:value="form.redirect_value = ''" />
        </n-form-item>
        <n-form-item v-if="form.redirect_type !== '0'" label="跳转值" path="redirect_value">
          <div v-if="form.redirect_type === '3'" class="w-full">
            <n-upload v-if="!readonly" :custom-request="(options) => uploadImage(options, 'redirect_value')" :show-file-list="false" accept="image/*" :disabled="saving || uploading">
              <n-button :loading="uploading" :disabled="saving || uploading">
                上传弹窗图片
              </n-button>
            </n-upload>
            <n-image v-if="/^https?:\/\//i.test(form.redirect_value)" :src="form.redirect_value" :width="100" class="mt-10px" />
          </div>
          <n-input v-else v-model:value="form.redirect_value" :maxlength="512" show-count placeholder="请输入对应的跳转值" />
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
          <n-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="saveBanner">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
