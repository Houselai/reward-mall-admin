<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui'
import { fetchHomeCategoryList, fetchHomeCategoryProducts, saveHomeCategory } from '../api/homeCategory'
import type { HomeCategoryItem, HomeCategoryProduct, HomeCategorySaveItem } from '../api/homeCategory'

const message = useMessage()
const dialog = useDialog()
const formRef = ref<FormInst | null>(null)
const form = reactive<{ items: HomeCategoryItem[] }>({ items: [] })
const loaded = ref(false)
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const busy = computed(() => loading.value || saving.value)
const snapshot = ref('')
const dirty = computed(() => loaded.value && JSON.stringify(form.items) !== snapshot.value)
const rules: FormRules = {
  name: { required: true, whitespace: true, max: 100, message: '请输入栏目名称，最多100字', trigger: ['input', 'blur'] },
  subtitle: { max: 500, message: '副标题最多500字', trigger: ['input', 'blur'] },
  product_ids: {
    validator: (_rule, value: number[]) => Array.isArray(value)
      && value.every(id => Number.isSafeInteger(id) && id > 0)
      && new Set(value).size === value.length,
    message: '商品ID必须为正整数，同一栏目内不能重复',
    trigger: 'change',
  },
}

async function loadConfig() {
  loading.value = true
  loadError.value = false
  try {
    const { error, data } = await fetchHomeCategoryList()
    if (error || !data) {
      loadError.value = true
      return
    }
    const positions = data.list.map(item => item.position)
    if (positions.length !== 2 || ![1, 2].every(position => positions.includes(position))) {
      loadError.value = true
      message.error('首页栏目配置必须包含位置1和2各一次，请重新加载')
      return
    }
    form.items = [...data.list].sort((a, b) => a.position - b.position).map(item => ({ ...item, product_ids: [...item.product_ids] }))
    snapshot.value = JSON.stringify(form.items)
    loaded.value = true
    formRef.value?.restoreValidation()
  }
  finally {
    loading.value = false
  }
}

function reloadConfig() {
  if (busy.value || showPicker.value)
    return
  if (dirty.value) {
    dialog.warning({
      title: '重新加载配置',
      content: '当前有未保存的修改，重新加载成功后将覆盖这些修改，是否继续？',
      positiveText: '重新加载',
      negativeText: '取消',
      onPositiveClick: () => loadConfig(),
    })
    return
  }
  loadConfig()
}

async function handleSave() {
  if (!loaded.value || busy.value || showPicker.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }
  if (busy.value || showPicker.value)
    return
  saving.value = true
  try {
    // 整组提交仅包含可写字段，时间信息由服务端维护。
    const items: HomeCategorySaveItem[] = form.items.map(item => ({
      position: item.position,
      name: item.name.trim(),
      subtitle: item.subtitle,
      product_ids: [...item.product_ids],
    }))
    const { error } = await saveHomeCategory(items)
    if (error)
      return
    form.items.forEach((item, index) => Object.assign(item, items[index]))
    snapshot.value = JSON.stringify(form.items)
    message.success('两个栏目已保存')
    await loadConfig()
  }
  finally {
    saving.value = false
  }
}

const showPicker = ref(false)
const pickerPosition = ref<number | null>(null)
const currentItem = computed(() => form.items.find(item => item.position === pickerPosition.value))
const productTitle = ref('')
const searchTitle = ref('')
const products = ref<HomeCategoryProduct[]>([])
const productCache = reactive<Record<number, HomeCategoryProduct>>({})
const productLoading = ref(false)
const productError = ref(false)
const productPagination = reactive({ page: 1, pageSize: 10, itemCount: 0, showSizePicker: true, pageSizes: [10, 20, 50, 100] })
const productRowKey = (row: HomeCategoryProduct) => row.id
let productRequestId = 0

async function loadProducts() {
  const requestId = ++productRequestId
  productLoading.value = true
  productError.value = false
  try {
    const { error, data } = await fetchHomeCategoryProducts({ title: searchTitle.value, page: productPagination.page, step: productPagination.pageSize })
    if (requestId !== productRequestId)
      return
    if (error || !data) {
      productError.value = true
      return
    }
    products.value = data.list
    productPagination.itemCount = data.total
    data.list.forEach(item => { productCache[item.id] = item })
  }
  finally {
    if (requestId === productRequestId)
      productLoading.value = false
  }
}

function openProductPicker(position: number) {
  if (busy.value || !loaded.value)
    return
  pickerPosition.value = position
  productTitle.value = ''
  searchTitle.value = ''
  products.value = []
  productPagination.page = 1
  productPagination.itemCount = 0
  showPicker.value = true
  loadProducts()
}

function searchProducts() {
  searchTitle.value = productTitle.value.trim()
  productPagination.page = 1
  loadProducts()
}

function resetProducts() {
  productTitle.value = ''
  searchProducts()
}

function changeProductPage(page: number) {
  productPagination.page = page
  loadProducts()
}

function changeProductPageSize(pageSize: number) {
  productPagination.pageSize = pageSize
  productPagination.page = 1
  loadProducts()
}

function addProduct(product: HomeCategoryProduct) {
  if (busy.value || productLoading.value || productError.value || !currentItem.value || currentItem.value.product_ids.includes(product.id))
    return
  currentItem.value.product_ids.push(product.id)
  productCache[product.id] = product
  formRef.value?.restoreValidation()
}

function removeProduct(item: HomeCategoryItem, index: number) {
  if (busy.value)
    return
  item.product_ids.splice(index, 1)
  formRef.value?.restoreValidation()
}

function moveProduct(item: HomeCategoryItem, index: number, offset: number) {
  const target = index + offset
  if (busy.value || target < 0 || target >= item.product_ids.length)
    return
  const [id] = item.product_ids.splice(index, 1)
  item.product_ids.splice(target, 0, id)
}

function closeProductPicker() {
  showPicker.value = false
  ++productRequestId
  productLoading.value = false
}

const productColumns: DataTableColumns<HomeCategoryProduct> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '商品名称', key: 'title', minWidth: 250 },
  { title: '状态', key: 'status', width: 100, render: row => h(NTag, { type: row.status === '1' ? 'success' : 'default' }, { default: () => row.status === '1' ? '启用' : '停用' }) },
  {
    title: '操作', key: 'actions', width: 100,
    render: row => h(NButton, {
      size: 'small', type: 'primary', disabled: productLoading.value || productError.value || currentItem.value?.product_ids.includes(row.id),
      onClick: () => addProduct(row),
    }, { default: () => currentItem.value?.product_ids.includes(row.id) ? '已添加' : '添加' }),
  },
]

onMounted(loadConfig)
</script>

<template>
  <div class="h-full">
    <n-card title="首页栏目配置" class="shadow-sm rounded-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" :disabled="busy || showPicker" @click="reloadConfig">
            重新加载
          </n-button>
          <n-button type="primary" :loading="saving" :disabled="!loaded || busy || showPicker" @click="handleSave">
            保存全部
          </n-button>
        </n-space>
      </template>
      <n-alert type="info" class="mb-15px">
        首页栏目固定为两个位置，每次保存全部两项。名称必填，副标题和商品列表可为空；商品按列表顺序展示。
      </n-alert>
      <n-alert v-if="loadError" type="error" class="mb-15px">
        配置加载失败，请重新加载。已有页面数据会保留。
      </n-alert>
      <n-spin :show="loading">
        <n-form ref="formRef" :model="form" :disabled="busy || !loaded" label-placement="top">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-15px">
            <n-card v-for="(item, index) in form.items" :key="item.position" :title="`位置 ${item.position}`" embedded :bordered="false">
              <n-form-item label="名称" :path="`items.${index}.name`" :rule="rules.name">
                <n-input v-model:value="item.name" :maxlength="100" show-count placeholder="请输入名称" />
              </n-form-item>
              <n-form-item label="副标题" :path="`items.${index}.subtitle`" :rule="rules.subtitle">
                <n-input v-model:value="item.subtitle" type="textarea" :maxlength="500" show-count placeholder="可留空" />
              </n-form-item>
              <n-form-item label="商品列表" :path="`items.${index}.product_ids`" :rule="rules.product_ids">
                <div class="w-full">
                  <n-button :disabled="busy || !loaded" @click="openProductPicker(item.position)">
                    添加商品
                  </n-button>
                  <div v-if="!item.product_ids.length" class="mt-10px text-gray-500">
                    暂未配置商品
                  </div>
                  <div v-for="(id, productIndex) in item.product_ids" :key="id" class="flex items-center justify-between gap-10px mt-10px">
                    <div class="min-w-0 break-all">
                      {{ productIndex + 1 }}. {{ productCache[id]?.title || `商品 ID：${id}` }}
                      <span v-if="productCache[id]">（ID：{{ id }}，{{ productCache[id].status === '1' ? '启用' : '停用' }}）</span>
                    </div>
                    <n-space :wrap="false">
                      <n-button size="small" :disabled="busy || productIndex === 0" @click="moveProduct(item, productIndex, -1)">
                        上移
                      </n-button>
                      <n-button size="small" :disabled="busy || productIndex === item.product_ids.length - 1" @click="moveProduct(item, productIndex, 1)">
                        下移
                      </n-button>
                      <n-button size="small" type="error" :disabled="busy" @click="removeProduct(item, productIndex)">
                        移除
                      </n-button>
                    </n-space>
                  </div>
                  <div class="mt-10px text-12px text-gray-500">
                    栏目内商品不重复，跨栏目可复用，允许停用商品。已有商品ID不会自动过滤，保存时校验全部商品。
                  </div>
                </div>
              </n-form-item>
              <div class="text-12px text-gray-500">
                <div>创建时间：{{ item.create_time || '未配置' }}</div>
                <div>修改时间：{{ item.modify_time || '未配置' }}</div>
              </div>
            </n-card>
          </div>
        </n-form>
      </n-spin>
    </n-card>
    <n-modal :show="showPicker" preset="card" :title="`为栏目 ${pickerPosition} 添加商品`" class="w-800px max-w-95vw" :mask-closable="false" @update:show="closeProductPicker">
      <n-form inline label-placement="left" @submit.prevent>
        <n-form-item label="商品名称">
          <n-input v-model:value="productTitle" :maxlength="100" clearable placeholder="请输入商品名称" @keyup.enter="searchProducts" />
        </n-form-item>
        <n-form-item>
          <n-space>
            <n-button type="primary" :loading="productLoading" @click="searchProducts">
              查询
            </n-button>
            <n-button @click="resetProducts">
              重置
            </n-button>
          </n-space>
        </n-form-item>
      </n-form>
      <n-alert v-if="productError" type="error" class="mb-15px">
        商品列表加载失败，请重新查询。
      </n-alert>
      <n-data-table
        remote :columns="productColumns" :data="products" :loading="productLoading"
        :pagination="productPagination" :row-key="productRowKey" :scroll-x="530"
        @update:page="changeProductPage" @update:page-size="changeProductPageSize"
      />
      <template #footer>
        <n-space justify="end">
          <n-button @click="closeProductPicker">
            完成
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
