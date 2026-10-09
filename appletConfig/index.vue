<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialog, useMessage, useThemeVars } from 'naive-ui'
import type { UploadCustomRequestOptions } from 'naive-ui'
import { fetchAppletConfigs, saveAppletConfigs, uploadAppletConfigImage } from '../api/appletConfig'
import type { AppletConfig, AppletConfigSaveItem, AppletConfigValue } from '../api/appletConfig'

type ConfigFormItem = Exclude<AppletConfig, { type: 'integer' }> | (Omit<Extract<AppletConfig, { type: 'integer' }>, 'value'> & { value: number | null })

const theme = useThemeVars()
const pageStyle = computed(() => ({
  '--config-border': theme.value.borderColor,
  '--config-muted': theme.value.textColor3,
  '--config-surface': theme.value.actionColor,
  '--config-primary': theme.value.primaryColor,
}))
const message = useMessage()
const dialog = useDialog()
const items = ref<ConfigFormItem[]>([])
const savedValues = ref<Record<string, string>>({})
const loading = ref(false)
const saving = ref(false)
const uploadingKey = ref<string | null>(null)
const loadError = ref(false)
const loaded = ref(false)
const changedItems = computed(() => items.value.filter(item => JSON.stringify(item.value) !== savedValues.value[item.key]))

function formatDefault(value: AppletConfigValue) {
  if (value === '')
    return '未设置'
  if (typeof value === 'boolean')
    return value ? '开启' : '关闭'
  if (Array.isArray(value))
    return value.length ? value.map(item => item === '' ? '（空字符串）' : item).join('、') : '暂无内容'
  return String(value)
}

function rememberValues() {
  savedValues.value = Object.fromEntries(items.value.map(item => [item.key, JSON.stringify(item.value)]))
}

async function loadConfigs() {
  if (loading.value || saving.value || uploadingKey.value !== null)
    return
  loading.value = true
  loadError.value = false
  try {
    const { error, data } = await fetchAppletConfigs()
    if (error || !data) {
      loadError.value = true
      return
    }
    items.value = data.list
    rememberValues()
    loaded.value = true
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function reloadConfigs() {
  if (changedItems.value.length) {
    dialog.warning({
      title: '重新加载配置',
      content: '重新加载将丢弃尚未保存的修改，确定继续吗？',
      positiveText: '重新加载',
      negativeText: '取消',
      onPositiveClick: loadConfigs,
    })
    return
  }
  loadConfigs()
}

function isValid(item: ConfigFormItem) {
  switch (item.type) {
    case 'string':
    case 'pic': return typeof item.value === 'string'
    case 'integer': return Number.isSafeInteger(item.value)
    case 'boolean': return typeof item.value === 'boolean'
    case 'array[str]': return Array.isArray(item.value) && item.value.every(value => typeof value === 'string')
    default: return false
  }
}

async function saveConfigs() {
  if (!loaded.value || loading.value || saving.value || uploadingKey.value !== null || !changedItems.value.length)
    return
  const invalidItem = items.value.find(item => !isValid(item))
  if (invalidItem) {
    message.error(`请检查“${invalidItem.name}”的值${invalidItem.type === 'integer' ? '，须填写有效整数' : ''}`)
    return
  }
  if (changedItems.value.length > 100) {
    message.error('每次最多保存100项配置')
    return
  }
  // 只提交 key 和原生值，保留空字符串、0、false 和空数组。
  const payload: AppletConfigSaveItem[] = changedItems.value.map(({ key, value }) => ({ key, value: value as AppletConfigValue }))
  saving.value = true
  try {
    const { error } = await saveAppletConfigs(payload)
    if (error)
      return
    rememberValues()
    message.success('保存成功，小程序配置已生效')
  }
  catch {
    message.error('保存失败，编辑内容已保留，请重试')
  }
  finally {
    saving.value = false
  }
}

async function uploadImage(item: ConfigFormItem, { file, onFinish, onError }: UploadCustomRequestOptions) {
  if (item.type !== 'pic' || !file.file || loading.value || saving.value || uploadingKey.value !== null) {
    onError()
    return
  }
  uploadingKey.value = item.key
  try {
    const { error, data } = await uploadAppletConfigImage(file.file)
    if (error || !data?.url) {
      onError()
      message.error('图片上传失败，请重试')
      return
    }
    item.value = data.url
    onFinish()
    message.success('上传成功，请保存配置以生效')
  }
  catch {
    onError()
    message.error('图片上传失败，请重试')
  }
  finally {
    uploadingKey.value = null
  }
}

loadConfigs()
</script>

<template>
  <div class="config-page" :style="pageStyle">
    <header class="config-header">
      <div>
        <h2 class="config-title">小程序公开配置</h2>
        <p class="config-subtitle">管理小程序展示内容，修改后保存即可生效。</p>
      </div>
      <n-button :loading="loading" :disabled="loading || saving || uploadingKey !== null" @click="reloadConfigs">
        重新加载
      </n-button>
    </header>

    <n-alert v-if="loadError" type="error" class="mb-20px">
      配置加载失败，请重新加载。已有编辑内容已保留。
    </n-alert>
    <n-spin :show="loading">
      <n-card v-if="loaded && !items.length" class="config-card">
        <n-empty description="暂无可管理的公开配置" />
      </n-card>
      <n-form v-else :disabled="loading || saving" class="config-list">
        <n-card v-for="item in items" :key="item.key" class="config-card" :content-style="{ padding: '0' }">
          <section class="config-item" :aria-label="item.name">
            <div class="config-info">
              <div class="config-item-heading">
                <h3 class="config-item-title">{{ item.name }}</h3>
                <n-tag v-if="JSON.stringify(item.value) !== savedValues[item.key]" size="small" type="warning" :bordered="false">
                  未保存
                </n-tag>
              </div>
              <p v-if="item.desc" class="config-description">{{ item.desc }}</p>
            </div>

            <div class="config-editor">
              <n-input v-if="item.type === 'string'" v-model:value="item.value" :input-props="{ 'aria-label': item.name }" placeholder="请输入配置内容，可留空" />
              <div v-else-if="item.type === 'pic'" class="config-picture">
                <div class="config-picture-preview">
                  <n-image v-if="item.value" :src="item.value" :alt="item.name" :width="120" :height="120" object-fit="contain" />
                  <div v-else class="config-picture-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8" cy="8" r="1.5" />
                      <path d="m3 17 5-5 4 4 4-6 5 7" />
                    </svg>
                    <span>暂无图片</span>
                  </div>
                </div>
                <div class="config-picture-controls">
                  <n-space align="center" :size="16">
                    <n-upload :custom-request="options => uploadImage(item, options)" :show-file-list="false" accept="image/*" :disabled="loading || saving || uploadingKey !== null">
                      <n-button secondary type="primary" :loading="uploadingKey === item.key" :disabled="loading || saving || uploadingKey !== null">
                        {{ item.value ? '更换图片' : '上传图片' }}
                      </n-button>
                    </n-upload>
                    <n-button v-if="item.value" text type="error" :disabled="loading || saving || uploadingKey !== null" @click="item.value = ''">
                      清空
                    </n-button>
                  </n-space>
                  <p class="config-hint">{{ item.value ? '点击图片可预览，上传后请保存配置。' : '上传图片后，请保存配置以生效。' }}</p>
                </div>
              </div>
              <n-input-number v-else-if="item.type === 'integer'" v-model:value="item.value" :input-props="{ 'aria-label': item.name }" :precision="0" :min="Number.MIN_SAFE_INTEGER" :max="Number.MAX_SAFE_INTEGER" class="config-number" />
              <div v-else-if="item.type === 'boolean'" class="config-switch">
                <n-switch v-model:value="item.value" :aria-label="item.name" />
                <span>{{ item.value ? '已开启' : '已关闭' }}</span>
              </div>
              <n-dynamic-input v-else-if="item.type === 'array[str]'" v-model:value="item.value" :min="0" :disabled="loading || saving" :placeholder="`请输入${item.name}`" />
              <n-alert v-else type="warning">
                暂不支持该配置类型，请联系管理员。
              </n-alert>
              <div class="config-default">
                <span class="config-default-label">默认值</span>
                <span>{{ formatDefault(item.default_value) }}</span>
              </div>
            </div>
          </section>
        </n-card>
      </n-form>
    </n-spin>

    <n-card class="config-footer" :content-style="{ padding: '16px 24px' }">
      <div class="config-footer-content">
        <span class="config-status" role="status">
          <template v-if="uploadingKey !== null">图片上传中，请稍候…</template>
          <template v-else-if="changedItems.length">有 <strong>{{ changedItems.length }}</strong> 项配置尚未保存</template>
          <template v-else>{{ loaded ? '所有配置均已保存' : '等待加载配置' }}</template>
        </span>
        <n-button type="primary" :loading="saving" :disabled="!loaded || loading || saving || uploadingKey !== null || !changedItems.length" @click="saveConfigs">
          保存配置
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.config-page {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 8px 0 24px;
}

.config-header,
.config-footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.config-header {
  margin-bottom: 24px;
}

.config-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.5;
}

.config-subtitle,
.config-description,
.config-hint {
  color: var(--config-muted);
  line-height: 1.7;
}

.config-subtitle {
  margin: 6px 0 0;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 120px;
}

.config-card,
.config-footer {
  border-radius: 12px;
}

.config-item {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr);
  gap: 32px;
  padding: 28px;
}

.config-item-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.config-item-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.config-description {
  margin: 10px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.config-editor {
  min-width: 0;
}

.config-picture {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.config-picture-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 144px;
  height: 144px;
  border: 1px dashed var(--config-border);
  border-radius: 10px;
  background: var(--config-surface);
}

.config-picture-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8px;
  color: var(--config-muted);
  font-size: 12px;
}

.config-picture-controls {
  flex: 1 1 200px;
  min-width: 0;
}

.config-hint {
  margin: 12px 0 0;
  font-size: 12px;
}

.config-number {
  max-width: 280px;
}

.config-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
}

.config-default {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--config-border);
  font-size: 12px;
  line-height: 1.7;
  color: var(--config-muted);
  overflow-wrap: anywhere;
}

.config-default-label {
  flex-shrink: 0;
}

.config-footer {
  margin-top: 24px;
}

.config-status {
  color: var(--config-muted);
}

.config-status strong {
  color: var(--config-primary);
  font-weight: 600;
}

@media (max-width: 640px) {
  .config-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .config-item {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
  }

  .config-footer-content {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
