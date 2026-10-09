<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NImage, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { createProduct, deleteProduct, fetchProductDetail, fetchProductList, fetchProductBrands, fetchProductCategories, fetchProductEnums, updateProduct, uploadProductImage } from '../api/product'
import type { Product, ProductCreate, ProductForm, ProductOption, ProductEnumOption, ProductQuery } from '../api/product'

const message = useMessage()
const dialog = useDialog()
const rows = ref<Product[]>([])
const rowKey = (row: Product) => row.id
const loading = ref(false)
const listError = ref(false)
const query = reactive<{ title: string; category_id: number | null; brand_id: number | null; status: '0' | '1' | null }>({ title: '', category_id: null, brand_id: null, status: null })
const pagination = reactive({ page: 1, pageSize: 10, itemCount: 0, showSizePicker: true, pageSizes: [10, 20, 50, 100] })
const brandOptions = ref<ProductOption[]>([])
const categoryOptions = ref<ProductOption[]>([])
const enumOptions = reactive<{ status: ProductEnumOption[]; bank: ProductEnumOption[] }>({ status: [], bank: [] })
const optionsLoading = ref(false)
const optionsError = ref(false)
let activeQuery: Omit<ProductQuery, 'page' | 'step'> = {}
async function loadOptions() {
  optionsLoading.value = true
  optionsError.value = false
  try {
    const [brands, categories, enums] = await Promise.all([fetchProductBrands(), fetchProductCategories(), fetchProductEnums()])
    if (brands.error || categories.error || enums.error || !brands.data || !categories.data || !enums.data) {
      optionsError.value = true
      return false
    }
    brandOptions.value = brands.data.list
    categoryOptions.value = categories.data.list.flatMap(parent => parent.children.map(child => ({ value: child.value, label: `${parent.label} / ${child.label}` })))
    Object.assign(enumOptions, enums.data)
    return true
  }
  finally {
    optionsLoading.value = false
  }
}
let listRequestId = 0

async function loadList() {
  const requestId = ++listRequestId
  loading.value = true
  listError.value = false
  try {
    const { error, data } = await fetchProductList({ ...activeQuery, page: pagination.page, step: pagination.pageSize })
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

function handleSearch() {
  activeQuery = { title: query.title.trim() }
  if (query.category_id !== null) activeQuery.category_id = query.category_id
  if (query.brand_id !== null) activeQuery.brand_id = query.brand_id
  if (query.status !== null) activeQuery.status = query.status
  pagination.page = 1
  loadList()
}

function resetQuery() {
  Object.assign(query, { title: '', category_id: null, brand_id: null, status: null })
  handleSearch()
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
const modalTitle = computed(() => ({ create: '新增商品', edit: '编辑商品', detail: '商品详情' }[mode.value]))
const readonly = computed(() => mode.value === 'detail')
const saving = ref(false)
const uploading = ref(false)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const formRef = ref<FormInst | null>(null)
const editId = ref<number | null>(null)
const detail = ref<Product | null>(null)
function emptyForm(): ProductForm {
  return { images: [''], title: '', introduction: '', card_count: 1, exchange_description: '', banks: [], exchange_rules: '', category_id: null, brand_id: null, sort: 0, status: '1', remark: '' }
}
const form = reactive<ProductForm>(emptyForm())
const busy = computed(() => saving.value || uploading.value)
function referenceOptions(options: ProductOption[], value: number | null) {
  return value !== null && !options.some(item => item.value === value)
    ? [...options, { value, label: `ID：${value}（当前不可选）`, disabled: true }]
    : options
}
const editBrands = computed(() => referenceOptions(brandOptions.value, detail.value?.brand_id ?? null))
const editCategories = computed(() => referenceOptions(categoryOptions.value, detail.value?.category_id ?? null))
const uintRule = { required: true, type: 'number' as const, validator: (_rule: unknown, value: number) => Number.isInteger(value) && value >= 0 && value <= 4294967295, message: '请输入0至4294967295之间的整数', trigger: ['change', 'blur'] }
const rules: FormRules = {
  title: { required: true, whitespace: true, max: 100, message: '请输入商品标题，最多100字', trigger: ['input', 'blur'] },
  introduction: { required: true, whitespace: true, max: 500, message: '请输入商品介绍，最多500字', trigger: ['input', 'blur'] },
  images: { validator: (_rule, value: string[]) => value.length > 0 && value.every(item => !!item.trim() && item.length <= 512), message: '至少填写一张图片，每项非空且最多512字', trigger: 'change' },
  sort: uintRule,
  card_count: { ...uintRule, validator: (_rule, value: number) => Number.isInteger(value) && value >= 1 && value <= 4294967295, message: '卡数量必须为1至4294967295之间的整数' },
  banks: { validator: (_rule, value: string[]) => value.length > 0 && new Set(value).size === value.length && value.every(bank => enumOptions.bank.some(item => item.value === bank)), message: '请至少选择一家银行', trigger: 'change' },
  exchange_rules: { required: true, whitespace: true, max: 10000, message: '请输入兑换规则，最多10000字', trigger: ['input', 'blur'] },
  exchange_description: { max: 12, message: '兑换描述最多12个字符', trigger: ['input', 'blur'] },
  remark: { max: 128, message: '备注最多128字', trigger: ['input', 'blur'] },
  category_id: { required: true, type: 'number', validator: (_rule, value: number) => Number.isSafeInteger(value) && value > 0 && (categoryOptions.value.some(item => item.value === value) || (mode.value === 'edit' && detail.value?.category_id === value)), message: '请选择启用的二级分类', trigger: 'change' },
  brand_id: { required: true, type: 'number', validator: (_rule, value: number) => Number.isSafeInteger(value) && value > 0 && (brandOptions.value.some(item => item.value === value) || (mode.value === 'edit' && detail.value?.brand_id === value)), message: '请选择启用品牌', trigger: 'change' },
  status: { required: true, type: 'enum', enum: ['0', '1'], message: '请选择状态', trigger: 'change' },
}

async function openCreate() {
  if (optionsLoading.value || detailLoadingId.value !== null || !await loadOptions())
    return
  mode.value = 'create'
  editId.value = null
  detail.value = null
  Object.assign(form, emptyForm())
  formRef.value?.restoreValidation()
  showModal.value = true
}

async function openProduct(row: Product, targetMode: 'edit' | 'detail') {
  if (optionsLoading.value || detailLoadingId.value !== null)
    return
  detailLoadingId.value = row.id
  try {
    const { error, data } = await fetchProductDetail(row.id)
    if (error || !data)
      return
    if (targetMode === 'edit' && !await loadOptions())
      return
    mode.value = targetMode
    editId.value = data.id
    detail.value = data
    Object.assign(form, {
      images: [...data.images], title: data.title, introduction: data.introduction,
      // 接口可能返回数字字符串，数字输入框要求 number。
      card_count: Number(data.card_count),
      exchange_description: data.exchange_description, banks: [...data.banks],
      exchange_rules: data.exchange_rules, category_id: data.category_id,
      brand_id: data.brand_id, sort: Number(data.sort), status: data.status, remark: data.remark,
    })
    formRef.value?.restoreValidation()
    showModal.value = true
  }
  finally {
    detailLoadingId.value = null
  }
}

async function saveProduct() {
  if (saving.value || uploading.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }
  if (busy.value)
    return
  saving.value = true
  try {
    const params: ProductCreate = { ...form, title: form.title.trim(), images: form.images.map(item => item.trim()), banks: [...form.banks], category_id: form.category_id!, brand_id: form.brand_id! }
    const patch: Partial<ProductCreate> & { id: number } = { ...params, id: editId.value! }
    // 仅在关联或状态变化时提交，避免触发未修改关联的重新校验。
    if (params.category_id === detail.value?.category_id) delete patch.category_id
    if (params.brand_id === detail.value?.brand_id) delete patch.brand_id
    if (params.status === detail.value?.status) delete patch.status
    const res = mode.value === 'create' ? await createProduct(params) : await updateProduct(patch)
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

function confirmDelete(row: Product) {
  dialog.warning({
    title: '删除商品',
    content: `确定删除商品“${row.title}”吗？删除后该商品将不再显示。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = row.id
      try {
        const { error } = await deleteProduct(row.id)
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
  if (!file.file || busy.value || readonly.value) {
    onError()
    return
  }
  uploading.value = true
  try {
    const { error, data } = await uploadProductImage(file.file)
    if (error || !data) {
      onError()
      return
    }
    const emptyIndex = form.images.findIndex(item => !item.trim())
    if (emptyIndex >= 0)
      form.images[emptyIndex] = data.url
    else
      form.images.push(data.url)
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

function moveImage(index: number, offset: number) {
  const target = index + offset
  if (busy.value || readonly.value || target < 0 || target >= form.images.length) return
  const [image] = form.images.splice(index, 1)
  form.images.splice(target, 0, image)
}
const columns: DataTableColumns<Product> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '商品标题', key: 'title', width: 220 },
  { title: '首图', key: 'images', width: 100, render: row => /^https?:\/\//i.test(row.images[0]) ? h(NImage, { src: row.images[0], width: 60, height: 60, objectFit: 'contain' }) : row.images[0] },
  { title: '分类', key: 'category_name', width: 150 },
  { title: '品牌', key: 'brand_name', width: 150 },
  { title: '排序', key: 'sort', width: 90 },
  { title: '状态', key: 'status', width: 90, render: row => h(NTag, { type: row.status === '1' ? 'success' : 'default' }, { default: () => row.status === '1' ? '启用' : '禁用' }) },
  { title: '修改时间', key: 'modify_time', width: 180 },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', render: row => h(NSpace, {}, { default: () => [
    h(NButton, { size: 'small', disabled: detailLoadingId.value !== null || optionsLoading.value, onClick: () => openProduct(row, 'detail') }, { default: () => '详情' }),
    h(NButton, { size: 'small', type: 'primary', disabled: detailLoadingId.value !== null || optionsLoading.value, loading: detailLoadingId.value === row.id, onClick: () => openProduct(row, 'edit') }, { default: () => '编辑' }),
    h(NButton, { size: 'small', type: 'error', disabled: deletingId.value !== null, loading: deletingId.value === row.id, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
  ] }) },
]
onMounted(() => { loadOptions(); loadList() })
</script>

<template>
  <div class="h-full">
    <n-card class="shadow-sm rounded-5px">
      <n-form inline label-placement="left" @submit.prevent>
        <n-form-item label="商品标题">
          <n-input v-model:value="query.title" :maxlength="100" clearable @keyup.enter="handleSearch" />
        </n-form-item>
        <n-form-item label="分类">
          <n-select v-model:value="query.category_id" :options="categoryOptions" clearable filterable class="w-220px" />
        </n-form-item>
        <n-form-item label="品牌">
          <n-select v-model:value="query.brand_id" :options="brandOptions" clearable filterable class="w-180px" />
        </n-form-item>
        <n-form-item label="状态">
          <n-select v-model:value="query.status" :options="enumOptions.status" clearable class="w-120px" />
        </n-form-item>
        <n-form-item>
          <n-space>
            <n-button type="primary" @click="handleSearch">
              查询
            </n-button>
            <n-button @click="resetQuery">
              重置
            </n-button>
          </n-space>
        </n-form-item>
      </n-form>
      <n-alert v-if="optionsError" type="error">
        选项加载失败。
        <n-button text type="primary" :loading="optionsLoading" @click="loadOptions">
          重试
        </n-button>
      </n-alert>
    </n-card>
    <n-card title="商品管理" class="shadow-sm rounded-5px mt-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" @click="loadList">
            刷新
          </n-button>
          <n-button type="primary" :disabled="detailLoadingId !== null || optionsLoading" :loading="optionsLoading" @click="openCreate">
            新增商品
          </n-button>
        </n-space>
      </template>
      <n-alert v-if="listError" type="error" class="mb-15px">
        商品列表加载失败，请刷新重试。
      </n-alert>
      <n-data-table
        remote :columns="columns" :data="rows" :loading="loading" :pagination="pagination"
        :row-key="rowKey" :scroll-x="1430"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
    <n-modal
      :show="showModal" preset="card" :title="modalTitle" class="w-900px max-w-95vw"
      :mask-closable="false" :close-on-esc="!saving && !uploading" :closable="!saving && !uploading"
      @update:show="closeModal"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" :label-width="100" :disabled="readonly || busy">
        <n-form-item label="商品标题" path="title">
          <n-input v-model:value="form.title" :maxlength="100" show-count />
        </n-form-item>
        <n-form-item label="商品介绍" path="introduction">
          <n-input v-model:value="form.introduction" type="textarea" :maxlength="500" show-count />
        </n-form-item>
        <n-form-item label="商品图片" path="images">
          <div class="w-full">
            <div v-for="(image, index) in form.images" :key="index" class="mb-10px">
              <n-input v-model:value="form.images[index]" :maxlength="512" placeholder="图片 URL 或 OSS key" />
              <n-image v-if="/^https?:\/\//i.test(image)" :src="image" :width="80" class="mt-5px" />
              <n-space v-if="!readonly" class="mt-5px">
                <n-button :disabled="busy || index === 0" @click="moveImage(index, -1)">
                  上移
                </n-button>
                <n-button :disabled="busy || index === form.images.length - 1" @click="moveImage(index, 1)">
                  下移
                </n-button>
                <n-button :disabled="busy" type="error" @click="form.images.splice(index, 1)">
                  移除
                </n-button>
              </n-space>
            </div>
            <n-space v-if="!readonly">
              <n-button :disabled="busy" @click="form.images.push('')">
                添加图片地址
              </n-button>
              <n-upload :custom-request="uploadImage" :show-file-list="false" accept="image/*" :disabled="busy">
                <n-button :loading="uploading" :disabled="busy">
                  上传图片
                </n-button>
              </n-upload>
            </n-space>
          </div>
        </n-form-item>
        <n-form-item label="卡数量" path="card_count">
          <n-input-number v-model:value="form.card_count" :min="1" :max="4294967295" :precision="0" />
        </n-form-item>
        <n-form-item label="兑换描述" path="exchange_description">
          <n-input v-model:value="form.exchange_description" :maxlength="12" show-count />
        </n-form-item>
        <n-form-item label="适用银行" path="banks">
          <n-select v-model:value="form.banks" :options="enumOptions.bank" multiple />
        </n-form-item>
        <n-form-item label="二级分类" path="category_id" required>
          <n-select v-model:value="form.category_id" :options="editCategories" filterable placeholder="请选择启用的二级分类" />
        </n-form-item>
        <n-form-item label="品牌" path="brand_id" required>
          <n-select v-model:value="form.brand_id" :options="editBrands" filterable placeholder="请选择启用品牌" />
        </n-form-item>
        <n-form-item label="兑换规则" path="exchange_rules">
          <n-input v-model:value="form.exchange_rules" type="textarea" :maxlength="10000" show-count placeholder="纯文本规则，支持换行" />
        </n-form-item>
        <n-form-item label="排序" path="sort">
          <n-input-number v-model:value="form.sort" :min="0" :max="4294967295" :precision="0" />
        </n-form-item>
        <n-form-item label="状态" path="status">
          <n-select v-model:value="form.status" :options="enumOptions.status" />
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
          <n-button v-if="!readonly" type="primary" :loading="saving" :disabled="uploading" @click="saveProduct">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
