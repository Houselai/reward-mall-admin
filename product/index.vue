<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NImage, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui'
import { createProduct, deleteProduct, fetchProductDetail, fetchProductList, fetchProductBrands, fetchProductCategories, fetchProductEnums, updateProduct } from '../api/product'
import type { Product, ProductDetail, ProductForm, ProductListItem, ProductOption, ProductEnumOption, ProductQuery, ProductUpdate } from '../api/product'
import CatalogTransfer from '../components/CatalogTransfer.vue'
import ProductImages from './ProductImages.vue'
import SkuEditor from './SkuEditor.vue'

const message = useMessage()
const dialog = useDialog()
const rows = ref<ProductListItem[]>([])
const rowKey = (row: Product) => row.id
const loading = ref(false)
const listError = ref(false)
const query = reactive<{ title: string; category_id: number | null; brand_id: number | null; status: '0' | '1' | null }>({ title: '', category_id: null, brand_id: null, status: null })
const pagination = reactive({ page: 1, pageSize: 10, itemCount: 0, showSizePicker: true, pageSizes: [10, 20, 50, 100] })
const brandOptions = ref<ProductOption[]>([])
const categoryOptions = ref<ProductOption[]>([])
const enumOptions = reactive<{ status: ProductEnumOption[] }>({ status: [] })
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
const calculating = ref(false)
const tab = ref<'product' | 'skus'>('product')
const skuEditor = ref<InstanceType<typeof SkuEditor> | null>(null)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const formRef = ref<FormInst | null>(null)
const detail = ref<ProductDetail | null>(null)
function emptyForm(): ProductForm {
  return { images: [], title: '', introduction: '', exchange_rules: '', category_ids: [], brand_id: null, status: '1', remark: '' }
}
const form = reactive<ProductForm>(emptyForm())
const busy = computed(() => saving.value || uploading.value || calculating.value)
function referenceOptions(options: ProductOption[], value: number | null) {
  return value !== null && !options.some(item => item.value === value)
    ? [...options, { value, label: `ID：${value}（当前不可选）`, disabled: true }]
    : options
}
const editBrands = computed(() => referenceOptions(brandOptions.value, detail.value?.brand_id ?? null))
function categoryLabel(category: Product['categories'][number]) {
  return `${category.parent_name} / ${category.name}`
}
function unavailableCategory(value: number | string) {
  const category = detail.value?.categories.find(item => item.id === value)
  return { value, label: `${category ? categoryLabel(category) : value}（当前不可选）` }
}
const rules: FormRules = {
  title: { required: true, whitespace: true, max: 100, message: '请输入商品标题，最多100字', trigger: ['input', 'blur'] },
  introduction: { required: true, whitespace: true, max: 500, message: '请输入商品介绍，最多500字', trigger: ['input', 'blur'] },
  exchange_rules: { required: true, whitespace: true, max: 10000, message: '请输入兑换规则，最多10000字', trigger: ['input', 'blur'] },
  remark: { max: 128, message: '备注最多128字', trigger: ['input', 'blur'] },
  category_ids: {
    validator: (_rule, ids: number[]) => ids.length > 0 && new Set(ids).size === ids.length && ids.every(id => categoryOptions.value.some(option => option.value === id)),
    message: '请至少选择一个二级分类，所选分类均须启用',
    trigger: 'change',
  },
  brand_id: { required: true, type: 'number', validator: (_rule, value: number) => Number.isSafeInteger(value) && value > 0 && (brandOptions.value.some(item => item.value === value) || (mode.value === 'edit' && detail.value?.brand_id === value)), message: '请选择启用品牌', trigger: 'change' },
  status: { required: true, type: 'enum', enum: ['0', '1'], message: '请选择状态', trigger: 'change' },
}

async function openCreate() {
  if (optionsLoading.value || detailLoadingId.value !== null || !await loadOptions())
    return
  tab.value = 'product'
  mode.value = 'create'
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
    tab.value = 'product'
    mode.value = targetMode
    detail.value = data
    Object.assign(form, {
      images: [...data.images], title: data.title, introduction: data.introduction,
      exchange_rules: data.exchange_rules, category_ids: data.categories.map(category => category.id),
      brand_id: data.brand_id, status: data.status, remark: data.remark,
    })
    formRef.value?.restoreValidation()
    showModal.value = true
  }
  finally {
    detailLoadingId.value = null
  }
}

async function saveProduct() {
  if (busy.value || !skuEditor.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    tab.value = 'product'
    return
  }
  let skuData
  try {
    skuData = skuEditor.value.getData()
  }
  catch (error) {
    tab.value = 'skus'
    message.error(error instanceof Error ? error.message : '请检查 SKU 配置')
    return
  }
  if (busy.value)
    return
  saving.value = true
  try {
    const params = { ...form, title: form.title.trim(), images: form.images.map(item => item.trim()).filter(Boolean), category_ids: [...form.category_ids], brand_id: form.brand_id! }
    let res
    if (detail.value) {
      const patch: ProductUpdate = { ...params, id: detail.value.id }
      const previousIds = new Set(detail.value.categories.map(category => category.id))
      if (previousIds.size === params.category_ids.length && params.category_ids.every(id => previousIds.has(id)))
        delete patch.category_ids
      if (params.brand_id === detail.value.brand_id) delete patch.brand_id
      if (params.status === detail.value.status) delete patch.status
      if (JSON.stringify(skuData.specs) !== JSON.stringify(detail.value.specs))
        patch.specs = skuData.specs
      if (skuData.changes.length)
        patch.skus = skuData.changes
      res = await updateProduct(patch)
    }
    else {
      res = await createProduct({ ...params, specs: skuData.specs, skus: skuData.skus })
    }
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

function closeModal() {
  if (!busy.value)
    showModal.value = false
}

const columns: DataTableColumns<ProductListItem> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '商品标题', key: 'title', width: 220 },
  { title: '首图', key: 'images', width: 100, render: (row) => {
    const image = row.main_sku?.images[0] || row.images[0]
    return image && /^https?:\/\//i.test(image) ? h(NImage, { src: image, width: 60, height: 60, objectFit: 'contain' }) : image || '—'
  } },
  { title: '分类', key: 'categories', width: 200, render: row => row.categories.map(categoryLabel).join('、') || '—' },
  { title: '品牌', key: 'brand_name', width: 150 },
  { title: 'SKU（上架 / 总数）', key: 'sku_count', width: 145, render: row => `${row.on_sku_count} / ${row.sku_count}` },
  { title: '主推规格', key: 'main_sku', width: 180, render: row => row.main_sku ? row.main_sku.spec_text || '默认规格' : '—' },
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
          <CatalogTransfer module="product" @imported="loadList" />
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
        :row-key="rowKey" :scroll-x="1550"
        @update:page="changePage" @update:page-size="changePageSize"
      />
    </n-card>
    <n-modal
      :show="showModal" preset="card" :title="modalTitle" class="w-900px max-w-95vw"
      :mask-closable="false" :close-on-esc="!busy" :closable="!busy"
      @update:show="closeModal"
    >
      <n-tabs v-if="showModal" v-model:value="tab" type="line">
        <n-tab-pane name="product" tab="商品信息" display-directive="show" :disabled="busy">
          <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" :label-width="100" :disabled="readonly || busy">
            <n-form-item label="商品标题" path="title">
              <n-input v-model:value="form.title" :maxlength="100" show-count />
            </n-form-item>
            <n-form-item label="商品介绍" path="introduction">
              <n-input v-model:value="form.introduction" type="textarea" :maxlength="500" show-count />
            </n-form-item>
            <n-form-item label="商品图片">
              <ProductImages v-model:value="form.images" :readonly="readonly" :disabled="busy" empty-text="暂无商品图片" @uploading="value => uploading = value" />
            </n-form-item>
            <n-form-item label="二级分类" path="category_ids" required>
              <span v-if="readonly">{{ detail?.categories.map(categoryLabel).join('、') || '—' }}</span>
              <n-select v-else v-model:value="form.category_ids" :options="categoryOptions" :fallback-option="unavailableCategory" multiple filterable placeholder="请选择一个或多个二级分类" />
            </n-form-item>
            <n-form-item label="品牌" path="brand_id" required>
              <n-select v-model:value="form.brand_id" :options="editBrands" filterable placeholder="请选择启用品牌" />
            </n-form-item>
            <n-form-item label="兑换规则" path="exchange_rules">
              <n-input v-model:value="form.exchange_rules" type="textarea" :maxlength="10000" show-count placeholder="纯文本规则，支持换行" />
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
        </n-tab-pane>
        <n-tab-pane name="skus" tab="规格与 SKU" display-directive="show" :disabled="busy">
          <SkuEditor ref="skuEditor" @calculating="value => calculating = value" :product="detail" :readonly="readonly" :disabled="busy" @uploading="value => uploading = value" />
        </n-tab-pane>
      </n-tabs>
      <template #footer>
        <n-space justify="end">
          <n-button :disabled="busy" @click="closeModal">
            {{ readonly ? '关闭' : '取消' }}
          </n-button>
          <n-button v-if="!readonly" type="primary" :loading="saving" :disabled="busy" @click="saveProduct">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
