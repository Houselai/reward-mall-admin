<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NImage, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { componentType } from '@/components/business/QueryForm/types'
import type { FormItemsProps } from '@/components/business/QueryForm/types'
import { createCategory, deleteCategory, fetchCategoryDetail, fetchCategoryFilterOptions, fetchCategoryList, fetchCategoryOptions, updateCategory, uploadCategoryImage } from '../api/category'
import type { Category, CategoryForm, CategoryOption, CategoryQuery } from '../api/category'

const message = useMessage()
const dialog = useDialog()
const rows = ref<Category[]>([])
const rowKey = (row: Category) => row.id
const loading = ref(false)
const listError = ref(false)
const name = ref('')
const level = ref<1 | 2 | null>(null)
const parentId = ref<number | null>(null)
const filterOptionsLoading = ref(false)
const filterOptionsError = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  prefix: ({ itemCount }: { itemCount?: number }) => `总数：${itemCount ?? 0}`,
})
const formItems: FormItemsProps = reactive([{
  label: '分类名称',
  field: 'name',
  component: componentType.input,
  componentProps: { maxlength: 100 },
}, {
  label: '层级',
  field: 'level',
  component: componentType.select,
  componentProps: { options: [], placeholder: '全部层级', loading: false },
}, {
  label: '上级分类',
  field: 'parent_id',
  component: componentType.select,
  componentProps: { options: [], placeholder: '全部上级分类', loading: false },
}])

async function loadFilterOptions() {
  if (filterOptionsLoading.value)
    return
  filterOptionsLoading.value = true
  filterOptionsError.value = false
  formItems[1].componentProps.loading = true
  formItems[2].componentProps.loading = true
  try {
    const { error, data } = await fetchCategoryFilterOptions()
    if (error || !data) {
      filterOptionsError.value = true
      return
    }
    formItems[1].componentProps.options = data.level
    formItems[2].componentProps.options = data.parent_id
  }
  finally {
    filterOptionsLoading.value = false
    formItems[1].componentProps.loading = false
    formItems[2].componentProps.loading = false
  }
}

onMounted(loadFilterOptions)

function refreshList() {
  return Promise.all([loadList(), loadFilterOptions()])
}
let listRequestId = 0

async function loadList() {
  const requestId = ++listRequestId
  loading.value = true
  listError.value = false
  try {
    const { error, data } = await fetchCategoryList({
      page: pagination.page, step: pagination.pageSize, name: name.value,
      level: level.value, parent_id: parentId.value,
    })
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

function handleSearch(options: { name?: string; level?: CategoryQuery['level'] | ''; parent_id?: number | null | '' }) {
  name.value = (options.name || '').trim()
  level.value = options.level || null
  parentId.value = options.parent_id || null
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
const modalTitle = computed(() => ({ create: '新增分类', edit: '编辑分类', detail: '分类详情' }[mode.value]))
const readonly = computed(() => mode.value === 'detail')
const saving = ref(false)
const uploading = ref(false)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const formRef = ref<FormInst | null>(null)
const editId = ref<number | null>(null)
const detail = ref<Category | null>(null)
const form = reactive<CategoryForm>({ name: '', image_url: '', parent_id: null, sort: 0, status: '1', remark: '' })
const parentOptions = ref<CategoryOption[]>([])
const optionsLoading = ref(false)
const isChild = computed(() => form.parent_id !== null)
const selectableParents = computed(() => {
  const options = parentOptions.value.filter(item => item.value !== editId.value)
  const currentParent = detail.value?.parent_id
  if (currentParent != null && !options.some(item => item.value === currentParent))
    return [...options, { value: currentParent, label: `上级分类 ID：${currentParent}（当前不可选）`, disabled: true }]
  return options
})
const statusOptions = [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }]
const rules: FormRules = {
  name: { required: true, whitespace: true, max: 100, message: '请输入分类名称，最多100字', trigger: ['input', 'blur'] },
  image_url: {
    validator: (_rule, value: string) => {
      if (value.length > 512)
        return new Error('图标最多512字')
      if (isChild.value && !value.trim())
        return new Error('二级分类图标不能为空')
      return true
    },
    trigger: ['input', 'blur'],
  },
  parent_id: {
    validator: (_rule, value: number | null) => value === null
      || (mode.value === 'edit' && value === detail.value?.parent_id)
      || parentOptions.value.some(item => item.value === value && item.value !== editId.value && !item.disabled),
    message: '请选择启用的一级分类作为上级',
    trigger: 'change',
  },
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

async function loadParentOptions() {
  optionsLoading.value = true
  try {
    const { error, data } = await fetchCategoryOptions()
    if (error || !data)
      return false
    parentOptions.value = data.list
    return true
  }
  finally {
    optionsLoading.value = false
  }
}

async function openCreate() {
  if (optionsLoading.value || detailLoadingId.value !== null)
    return
  if (!await loadParentOptions())
    return
  mode.value = 'create'
  editId.value = null
  detail.value = null
  Object.assign(form, { name: '', image_url: '', parent_id: null, sort: 0, status: '1', remark: '' })
  formRef.value?.restoreValidation()
  showModal.value = true
}

async function openCategory(row: Category, targetMode: 'edit' | 'detail') {
  if (optionsLoading.value || detailLoadingId.value !== null)
    return
  detailLoadingId.value = row.id
  try {
    const { error, data } = await fetchCategoryDetail(row.id)
    if (error || !data)
      return
    if (targetMode === 'edit' && !await loadParentOptions())
      return
    mode.value = targetMode
    editId.value = data.id
    detail.value = data
    Object.assign(form, {
      name: data.name,
      image_url: data.image_url,
      parent_id: data.parent_id,
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

async function saveCategory() {
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
    const params: CategoryForm = { ...form, name: form.name.trim(), image_url: form.image_url.trim() }
    // 未修改上级时省略该字段，保留已有的关联值。
    const updateParams: Partial<CategoryForm> & { id: number } = { ...params, id: editId.value! }
    if (params.parent_id === detail.value?.parent_id)
      delete updateParams.parent_id
    const res = mode.value === 'create'
      ? await createCategory(params)
      : await updateCategory(updateParams)
    if (res.error)
      return
    message.success(mode.value === 'create' ? '新增成功' : '保存成功')
    showModal.value = false
    await refreshList()
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(row: Category) {
  dialog.warning({
    title: '删除分类',
    content: `确定删除分类“${row.name}”吗？存在子分类或商品引用时无法删除，删除成功后该分类将不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        const { error } = await deleteCategory(row.id)
        if (error)
          return false
        message.success('删除成功')
        await refreshList()
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
    const { error, data } = await uploadCategoryImage(file.file)
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

const columns: DataTableColumns<Category> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '分类名称', key: 'name', width: 180 },
  { title: '层级', key: 'level', width: 90, render: row => row.parent_id === null ? '一级分类' : '二级分类' },
  { title: '上级分类', key: 'parent_name', width: 180, render: row => row.parent_name || (row.parent_id === null ? '—' : `ID：${row.parent_id}`) },
  {
    title: '分类图标', key: 'image_url', width: 160,
    render: row => /^https?:\/\//i.test(row.image_url)
      ? h(NImage, { src: row.image_url, width: 60, height: 60, objectFit: 'contain' })
      : row.image_url || '—',
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
      h(NButton, { size: 'small', disabled: detailLoadingId.value !== null || optionsLoading.value, onClick: () => openCategory(row, 'detail') }, { default: () => '详情' }),
      h(NButton, { size: 'small', type: 'primary', loading: detailLoadingId.value === row.id, disabled: detailLoadingId.value !== null || optionsLoading.value, onClick: () => openCategory(row, 'edit') }, { default: () => '编辑' }),
      h(NButton, { size: 'small', type: 'error', loading: deletingId.value === row.id, disabled: deletingId.value !== null, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
    ] }),
  },
]
</script>

<template>
  <div class="h-full">
    <n-card class="shadow-sm rounded-5px">
      <QueryForm :form-items="formItems" @search="handleSearch" />
      <n-alert v-if="filterOptionsError" type="error" class="mt-10px">
        筛选选项加载失败。
        <n-button size="small" :loading="filterOptionsLoading" @click="loadFilterOptions">
          重试
        </n-button>
      </n-alert>
    </n-card>
    <n-card title="分类管理" class="shadow-sm rounded-5px mt-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading || filterOptionsLoading" @click="refreshList">
            刷新
          </n-button>
          <n-button type="primary" :loading="optionsLoading" :disabled="detailLoadingId !== null || optionsLoading" @click="openCreate">
            新增分类
          </n-button>
        </n-space>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        分类列表加载失败，请刷新重试。
      </n-alert>
      <n-data-table
        remote :columns="columns" :data="rows" :loading="loading" :pagination="pagination"
        :row-key="rowKey" :scroll-x="1640"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
    <n-modal
      :show="showModal" preset="card" :title="modalTitle" class="w-640px max-w-95vw"
      :mask-closable="false" :close-on-esc="!saving && !uploading" :closable="!saving && !uploading"
      @update:show="closeModal"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" :label-width="100" :disabled="readonly || saving">
        <n-form-item label="分类名称" path="name">
          <n-input v-model:value="form.name" :maxlength="100" show-count placeholder="请输入分类名称" />
        </n-form-item>
        <n-form-item label="上级分类" path="parent_id">
          <template v-if="readonly">
            {{ form.parent_id === null ? '无（一级分类）' : detail?.parent_name || `上级分类 ID：${form.parent_id}` }}
          </template>
          <div v-else class="w-full">
            <n-select
              v-model:value="form.parent_id" :options="selectableParents" clearable filterable
              placeholder="不选择为一级分类" @update:value="formRef?.restoreValidation()"
            />
            <div class="mt-5px text-12px text-gray-500">
              最多支持两级分类，上级只能选择启用的一级分类。
            </div>
          </div>
        </n-form-item>
        <n-form-item label="分类图标" path="image_url" :required="isChild">
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
          <n-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="saveCategory">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
