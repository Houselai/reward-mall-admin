<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { fetchKingkongList, hasKingkongContent, saveKingkong, setKingkongStatus, uploadKingkongImage } from '../api/kingkong'
import type { KingkongArea, KingkongConfig, KingkongItem } from '../api/kingkong'

const message = useMessage()
const area = ref<KingkongArea>(1)
const areaName = computed(() => area.value === 1 ? '金刚一区' : '金刚二区')
const firstPosition = computed(() => area.value === 1 ? 1 : 5)
const rows = ref<KingkongItem[]>([])
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const uploading = ref<'image_url' | 'redirect_value' | null>(null)
const busy = computed(() => loading.value || saving.value || uploading.value !== null)

const editing = ref<KingkongItem | null>(null)
const formRef = ref<FormInst | null>(null)
const form = reactive<KingkongConfig>({ status: '0', name: '', image_url: '', redirect_type: null, redirect_value: '' })
const redirectOptions = [
  { label: '无动作', value: '0' },
  { label: 'H5', value: '1' },
  { label: '二级页', value: '2' },
  { label: '弹窗', value: '3' },
]
const publishRules: FormRules = {
  name: { required: true, whitespace: true, max: 100, message: '请输入名称，最多100字', trigger: ['input', 'blur'] },
  image_url: { required: true, whitespace: true, max: 512, message: '请上传图标或填写图标地址', trigger: ['input', 'blur'] },
  redirect_type: { required: true, type: 'enum', enum: ['0', '1', '2', '3'], message: '请选择跳转类型', trigger: 'change' },
  redirect_value: { required: true, whitespace: true, max: 512, message: '请填写跳转值或上传弹窗图片', trigger: ['input', 'blur'] },
}
const rules = computed(() => form.status === '1' ? publishRules : {})

function sameConfig(a: KingkongConfig, b: KingkongConfig) {
  return a.status === b.status && a.name === b.name && a.image_url === b.image_url
    && a.redirect_type === b.redirect_type && a.redirect_value === b.redirect_value
}

const latestEditingRow = computed(() => rows.value.find(row => row.id === editing.value?.id))
const editConflict = computed(() => editing.value && latestEditingRow.value && !sameConfig(editing.value, latestEditingRow.value))

async function loadRows() {
  loading.value = true
  try {
    const { error, data } = await fetchKingkongList(area.value)
    if (error || !data) {
      loadError.value = true
      return false
    }
    const list = [...data.list].sort((a, b) => a.position - b.position)
    if (list.length !== (area.value === 1 ? 4 : 8) || list.some((row, i) => row.position !== firstPosition.value + i || row.id !== row.position)) {
      loadError.value = true
      message.error(`${areaName.value}的位置数据不完整，请刷新重试`)
      return false
    }
    rows.value = list
    loadError.value = false
    return true
  }
  finally {
    loading.value = false
  }
}

function changeArea(next: KingkongArea) {
  if (next === area.value || busy.value || editing.value)
    return
  area.value = next
  rows.value = []
  loadRows()
}

function openEditor(row: KingkongItem) {
  editing.value = row
  const { status, name, image_url, redirect_type, redirect_value } = row
  Object.assign(form, { status, name, image_url, redirect_type, redirect_value })
  formRef.value?.restoreValidation()
}

function closeEditor() {
  if (!busy.value)
    editing.value = null
}

async function persist(expected: KingkongItem[], write: (latest: KingkongItem[]) => ReturnType<typeof saveKingkong>, success: string) {
  if (busy.value)
    return
  saving.value = true
  try {
    if (!await loadRows())
      return
    const latest = rows.value
    if (expected.some(row => !sameConfig(row, latest[row.position - firstPosition.value]))) {
      message.warning('位置配置已变更，请核对最新内容后再操作')
      return
    }
    const { error } = await write(latest)
    if (error)
      return
    editing.value = null
    message.success(success)
    if (!await loadRows())
      rows.value = []
  }
  finally {
    saving.value = false
  }
}

async function saveEditor() {
  const row = editing.value
  if (!row || busy.value || editConflict.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }
  if (editing.value !== row || editConflict.value)
    return
  const content: KingkongConfig = {
    status: form.status,
    name: form.name.trim(),
    image_url: form.image_url.trim(),
    redirect_type: form.redirect_type,
    redirect_value: form.redirect_type === '0' ? '' : form.redirect_value.trim(),
  }
  await persist([row], latest => saveKingkong(area.value, latest.map(slot => slot.id === row.id ? content : slot)), '位置已保存')
}

function move(index: number, offset: -1 | 1) {
  const target = index + offset
  const from = rows.value[index]
  const to = rows.value[target]
  if (!from || !to)
    return
  return persist([from, to], (latest) => {
    const items = [...latest]
    items[index] = latest[target]
    items[target] = latest[index]
    return saveKingkong(area.value, items)
  }, '顺序已更新')
}

function toggleStatus(row: KingkongItem) {
  const status = row.status === '1' ? '0' : '1'
  return persist([row], () => setKingkongStatus(row.id, status), status === '1' ? '已上架' : '已下架')
}

async function uploadImage({ file, onFinish, onError }: UploadCustomRequestOptions, field: 'image_url' | 'redirect_value' = 'image_url') {
  if (!file.file || busy.value) {
    onError()
    return
  }
  uploading.value = field
  try {
    const { error, data } = await uploadKingkongImage(file.file)
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
    uploading.value = null
  }
}

onMounted(loadRows)
</script>

<template>
  <div class="h-full">
    <n-card title="金刚区管理" class="shadow-sm rounded-5px">
      <template #header-extra>
        <n-button :loading="loading && !saving" :disabled="busy" @click="loadRows">
          刷新
        </n-button>
      </template>
      <n-tabs :value="area" type="line" class="mb-15px" @update:value="changeArea">
        <n-tab :name="1" :disabled="busy">
          金刚一区（4 个位置）
        </n-tab>
        <n-tab :name="2" :disabled="busy">
          金刚二区（8 个位置）
        </n-tab>
      </n-tabs>
      <n-alert v-if="loadError" type="error" class="mb-15px">
        {{ areaName }}加载失败，请刷新重试。
      </n-alert>
      <n-spin :show="busy && !editing">
        <div class="overflow-x-auto">
          <n-table :single-line="true" class="min-w-740px" size="small">
            <thead>
              <tr>
                <th>位置</th>
                <th>图标</th>
                <th>名称</th>
                <th>跳转类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.id">
                <td class="whitespace-nowrap">
                  位置 {{ index + 1 }}
                </td>
                <td>
                  <n-image v-if="/^https?:\/\//i.test(row.image_url)" :src="row.image_url" :width="40" :height="40" object-fit="contain" />
                  <n-ellipsis v-else-if="row.image_url" class="max-w-120px">
                    {{ row.image_url }}
                  </n-ellipsis>
                  <span v-else>—</span>
                </td>
                <td>
                  <n-ellipsis class="max-w-180px">
                    {{ row.name || (hasKingkongContent(row) ? '未填写名称' : '未配置') }}
                  </n-ellipsis>
                </td>
                <td>{{ redirectOptions.find(option => option.value === row.redirect_type)?.label || '—' }}</td>
                <td>
                  <n-tag size="small" :type="row.status === '1' ? 'success' : 'default'">
                    {{ row.status === '1' ? '上架' : '下架' }}
                  </n-tag>
                </td>
                <td>
                  <n-space :wrap="false" size="small">
                    <n-button size="small" type="primary" :disabled="busy" @click="openEditor(row)">
                      {{ hasKingkongContent(row) ? '编辑' : '配置' }}
                    </n-button>
                    <n-button size="small" :disabled="busy || !hasKingkongContent(row)" @click="toggleStatus(row)">
                      {{ row.status === '1' ? '下架' : '上架' }}
                    </n-button>
                    <n-button size="small" :disabled="busy || index === 0" @click="move(index, -1)">
                      上移
                    </n-button>
                    <n-button size="small" :disabled="busy || index === rows.length - 1" @click="move(index, 1)">
                      下移
                    </n-button>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </n-spin>
    </n-card>
    <n-modal
      :show="!!editing" preset="card" :title="`${areaName} · 位置 ${(editing?.position ?? firstPosition) - firstPosition + 1}`"
      class="w-640px max-w-95vw" :mask-closable="false" :close-on-esc="!busy" :closable="!busy" @update:show="closeEditor"
    >
      <n-alert v-if="editConflict && latestEditingRow" type="warning" class="mb-15px">
        此位置已被修改。当前输入已保留，载入最新配置后可重新编辑。
        <n-button text type="primary" :disabled="busy" @click="openEditor(latestEditingRow)">
          载入最新配置
        </n-button>
      </n-alert>
      <n-form ref="formRef" :model="form" :rules="rules" :disabled="busy" label-placement="left" :label-width="80">
        <n-form-item label="状态" path="status">
          <n-radio-group v-model:value="form.status" @update:value="formRef?.restoreValidation()">
            <n-radio-button value="0">
              下架
            </n-radio-button>
            <n-radio-button value="1">
              上架
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="名称" path="name">
          <n-input v-model:value="form.name" :maxlength="100" show-count placeholder="请输入名称" />
        </n-form-item>
        <n-form-item label="图标" path="image_url">
          <div class="w-full">
            <n-input v-model:value="form.image_url" :maxlength="512" placeholder="图标 URL 或 OSS object key" />
            <n-upload :custom-request="uploadImage" :show-file-list="false" accept="image/*" :disabled="busy" class="mt-10px">
              <n-button :loading="uploading === 'image_url'" :disabled="busy">
                上传图标
              </n-button>
            </n-upload>
            <n-image v-if="/^https?:\/\//i.test(form.image_url)" :src="form.image_url" :width="80" class="mt-10px" />
          </div>
        </n-form-item>
        <n-form-item label="跳转类型" path="redirect_type">
          <n-select v-model:value="form.redirect_type" clearable :options="redirectOptions" placeholder="请选择跳转类型" @update:value="form.redirect_value = ''" />
        </n-form-item>
        <n-form-item v-if="form.redirect_type && form.redirect_type !== '0'" :label="form.redirect_type === '3' ? '弹窗图片' : '跳转值'" path="redirect_value">
          <div class="w-full">
            <n-input v-model:value="form.redirect_value" :maxlength="512" :placeholder="form.redirect_type === '3' ? '弹窗图片 URL 或 OSS object key' : '请输入跳转值'" />
            <template v-if="form.redirect_type === '3'">
              <n-upload :custom-request="options => uploadImage(options, 'redirect_value')" :show-file-list="false" accept="image/*" :disabled="busy" class="mt-10px">
                <n-button :loading="uploading === 'redirect_value'" :disabled="busy">
                  上传弹窗图片
                </n-button>
              </n-upload>
              <n-image v-if="/^https?:\/\//i.test(form.redirect_value)" :src="form.redirect_value" :width="80" class="mt-10px" />
            </template>
          </div>
        </n-form-item>
      </n-form>
      <div v-if="editing?.create_time" class="text-12px text-gray-500">
        <div>创建时间：{{ editing.create_time }}</div>
        <div>修改时间：{{ editing.modify_time }}</div>
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button :disabled="busy" @click="closeEditor">
            取消
          </n-button>
          <n-button type="primary" :disabled="busy || !!editConflict" :loading="saving" @click="saveEditor">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
