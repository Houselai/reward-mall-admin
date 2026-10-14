<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { fetchKingkongList, saveKingkong, uploadKingkongImage } from '../api/kingkong'
import type { KingkongItem, KingkongSaveItem } from '../api/kingkong'

const message = useMessage()
const dialog = useDialog()
const formRef = ref<FormInst | null>(null)
const form = reactive<{ items: KingkongItem[] }>({ items: [] })
const loaded = ref(false)
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const uploadingPosition = ref<number | null>(null)
const busy = computed(() => loading.value || saving.value || uploadingPosition.value !== null)
const snapshot = ref('')
const dirty = computed(() => loaded.value && JSON.stringify(form.items) !== snapshot.value)
const redirectOptions = [
  { label: '无动作', value: '0' },
  { label: 'H5', value: '1' },
  { label: '二级页', value: '2' },
  { label: '弹窗', value: '3' },
]
const rules: FormRules = {
  name: { required: true, whitespace: true, max: 100, message: '请输入名称，最多100字', trigger: ['input', 'blur'] },
  image_url: { required: true, whitespace: true, max: 512, message: '请上传图标或填写 URL / OSS key，最多512字', trigger: ['input', 'blur'] },
  redirect_type: { required: true, type: 'enum', enum: ['0', '1', '2', '3'], message: '请选择跳转类型', trigger: 'change' },
  redirect_value: { required: true, whitespace: true, max: 512, message: '请输入跳转值或上传弹窗图片，最多512字', trigger: ['input', 'blur'] },
}

async function loadConfig() {
  loading.value = true
  loadError.value = false
  try {
    const { error, data } = await fetchKingkongList()
    if (error || !data) {
      loadError.value = true
      return
    }
    const positions = data.list.map(item => item.position)
    if (positions.length !== 4 || ![1, 2, 3, 4].every(position => positions.includes(position))) {
      loadError.value = true
      message.error('金刚区配置必须包含位置1至4各一次，请重新加载')
      return
    }
    form.items = [...data.list].sort((a, b) => a.position - b.position).map(item => ({ ...item }))
    snapshot.value = JSON.stringify(form.items)
    loaded.value = true
    formRef.value?.restoreValidation()
  }
  finally {
    loading.value = false
  }
}

function reloadConfig() {
  if (busy.value)
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
  if (!loaded.value || busy.value)
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
    // 整组提交仅包含可写字段，时间信息由服务端维护。
    const items: KingkongSaveItem[] = form.items.map(item => ({
      position: item.position,
      name: item.name.trim(),
      image_url: item.image_url.trim(),
      redirect_type: item.redirect_type!,
      redirect_value: item.redirect_type === '0' ? '' : item.redirect_value.trim(),
    }))
    const { error } = await saveKingkong(items)
    if (error)
      return
    form.items.forEach((item, index) => Object.assign(item, items[index]))
    snapshot.value = JSON.stringify(form.items)
    message.success('四个位置已保存')
    await loadConfig()
  }
  finally {
    saving.value = false
  }
}

async function uploadImage(item: KingkongItem, { file, onFinish, onError }: UploadCustomRequestOptions, field: 'image_url' | 'redirect_value' = 'image_url') {
  if (!file.file || busy.value) {
    onError()
    return
  }
  uploadingPosition.value = item.position
  try {
    const { error, data } = await uploadKingkongImage(file.file)
    if (error || !data) {
      onError()
      return
    }
    item[field] = data.url
    onFinish()
    message.success(field === 'image_url' ? '图标上传成功' : '弹窗图片上传成功')
  }
  catch {
    onError()
  }
  finally {
    uploadingPosition.value = null
  }
}

onMounted(loadConfig)
</script>

<template>
  <div class="h-full">
    <n-card title="金刚区管理" class="shadow-sm rounded-5px">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" :disabled="busy" @click="reloadConfig">
            重新加载
          </n-button>
          <n-button type="primary" :loading="saving" :disabled="!loaded || busy" @click="handleSave">
            保存全部
          </n-button>
        </n-space>
      </template>
      <n-alert type="info" class="mb-15px">
        金刚区固定为4个位置，按位置顺序展示。每次保存全部四项，名称、图标、跳转类型必填；选择“无动作”时无需填写跳转值。
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
              <n-form-item label="图标" :path="`items.${index}.image_url`" :rule="rules.image_url">
                <div class="w-full">
                  <n-input v-model:value="item.image_url" :maxlength="512" placeholder="图标 URL 或 OSS object key" />
                  <n-upload
                    :custom-request="(options) => uploadImage(item, options)" :show-file-list="false"
                    accept="image/*" :disabled="busy || !loaded" class="mt-10px"
                  >
                    <n-button :loading="uploadingPosition === item.position" :disabled="busy || !loaded">
                      上传图标
                    </n-button>
                  </n-upload>
                  <n-image v-if="/^https?:\/\//i.test(item.image_url)" :src="item.image_url" :width="80" class="mt-10px" />
                </div>
              </n-form-item>
              <n-form-item label="跳转类型" :path="`items.${index}.redirect_type`" :rule="rules.redirect_type">
                <n-select v-model:value="item.redirect_type" :options="redirectOptions" placeholder="请选择跳转类型" @update:value="item.redirect_value = ''" />
              </n-form-item>
              <n-form-item v-if="item.redirect_type !== '0'" label="跳转值" :path="`items.${index}.redirect_value`" :rule="rules.redirect_value">
                <div v-if="item.redirect_type === '3'" class="w-full">
                  <n-upload
                    :custom-request="(options) => uploadImage(item, options, 'redirect_value')" :show-file-list="false"
                    accept="image/*" :disabled="busy || !loaded"
                  >
                    <n-button :loading="uploadingPosition === item.position" :disabled="busy || !loaded">
                      上传弹窗图片
                    </n-button>
                  </n-upload>
                  <n-image v-if="/^https?:\/\//i.test(item.redirect_value)" :src="item.redirect_value" :width="80" class="mt-10px" />
                </div>
                <n-input v-else v-model:value="item.redirect_value" :maxlength="512" placeholder="请输入对应的跳转值" />
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
  </div>
</template>
