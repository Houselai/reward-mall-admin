<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { uploadProductImage } from '../api/product'

const props = defineProps<{ value: string[]; readonly: boolean; disabled: boolean; emptyText: string }>()
const emit = defineEmits<{
  (event: 'update:value', value: string[]): void
  (event: 'uploading', value: boolean): void
}>()
const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const message = useMessage()

function move(index: number, offset: number) {
  const images = [...props.value]
  images.splice(index + offset, 0, ...images.splice(index, 1))
  emit('update:value', images)
}

async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  target.value = ''
  if (!files.length || props.disabled || props.readonly || uploading.value)
    return
  uploading.value = true
  emit('uploading', true)
  const images = [...props.value]
  let uploaded = 0
  try {
    for (const file of files) {
      try {
        const { error, data } = await uploadProductImage(file)
        if (error || !data)
          continue
        images.push(data.url)
        uploaded++
        emit('update:value', [...images])
      }
      catch {
        continue
      }
    }
    if (uploaded === files.length)
      message.success('上传成功')
    else
      message.error(`已上传 ${uploaded} 张，${files.length - uploaded} 张上传失败`)
  }
  finally {
    uploading.value = false
    emit('uploading', false)
  }
}
</script>

<template>
  <div class="w-full">
    <div v-if="!value.length" class="mb-5px text-gray-500">{{ emptyText }}</div>
    <n-image-group>
      <n-space v-for="(image, index) in value" :key="index" align="center" class="mb-10px">
        <n-image v-if="/^https?:\/\//i.test(image)" :src="image" :alt="`图片 ${index + 1}`" :width="80" :height="80" object-fit="contain" />
        <span v-else class="text-gray-500">图片 {{ index + 1 }} 暂无预览</span>
        <template v-if="!readonly">
          <n-button size="small" :disabled="disabled || index === 0" @click="move(index, -1)">上移</n-button>
          <n-button size="small" :disabled="disabled || index === value.length - 1" @click="move(index, 1)">下移</n-button>
          <n-button size="small" :disabled="disabled" type="error" @click="$emit('update:value', value.filter((_, i) => i !== index))">移除</n-button>
        </template>
      </n-space>
    </n-image-group>
    <template v-if="!readonly">
      <input ref="input" type="file" accept="image/*" multiple hidden @change="upload">
      <n-button :loading="uploading" :disabled="disabled" @click="input?.click()">上传图片</n-button>
    </template>
  </div>
</template>
