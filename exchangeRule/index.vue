<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { fetchExchangeRule, saveExchangeRule } from '../api/exchangeRule'
import { centsToYuan, yuanToCents } from '../product/sku'

const message = useMessage()
const minimum = ref('')
const tiers = ref<{ end: string; base: string; cards: number | null }[]>([])
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const busy = computed(() => loading.value || saving.value)

async function load() {
  loading.value = true
  try {
    const { data, error } = await fetchExchangeRule()
    if (error || !data)
      return
    minimum.value = centsToYuan(data.min_supply_price)
    tiers.value = data.tiers.map(tier => ({
      end: centsToYuan(tier.end_price),
      base: centsToYuan(tier.base_price),
      cards: tier.card_count,
    }))
    loaded.value = true
  }
  finally {
    loading.value = false
  }
}

async function save() {
  if (busy.value || !loaded.value)
    return
  try {
    const minSupplyPrice = yuanToCents(minimum.value, '最低供应链价')
    let start = minSupplyPrice
    const values = tiers.value.map((row, index) => {
      const label = `第 ${index + 1} 档`
      const end = yuanToCents(row.end, `${label}结束价`)
      const base = yuanToCents(row.base, `${label}免补差上限`)
      if (end <= start || base < start || base > end)
        throw new Error(`${label}结束价须大于起始价，免补差上限须在本档范围内`)
      if (row.cards === null || !Number.isInteger(row.cards) || row.cards < 0 || row.cards > 4294967295)
        throw new Error(`请填写${label}的有效卡数`)
      start = end
      return { end_price: end, base_price: base, card_count: row.cards }
    })
    saving.value = true
    const { error } = await saveExchangeRule({ min_supply_price: minSupplyPrice, tiers: values })
    if (!error)
      message.success('兑换规则已保存')
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  }
  finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <n-card title="供应链价兑换规则">
    <n-spin :show="loading">
      <template v-if="loaded">
        <p class="mb-12px">交界价归下一档，最后一档包含结束价。超出免补差上限的部分向上取到 5 元的倍数。</p>
        <div class="overflow-x-auto">
          <n-table size="small" :single-line="false">
            <thead>
              <tr><th>起始价（元）</th><th>结束价（元）</th><th>免补差上限（元）</th><th>卡数</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in tiers" :key="index">
                <td>
                  <n-input v-if="index === 0" v-model:value="minimum" :disabled="busy" placeholder="最低供应链价" />
                  <span v-else>{{ tiers[index - 1].end || '—' }}</span>
                </td>
                <td><n-input v-model:value="row.end" :disabled="busy" placeholder="结束价" /></td>
                <td><n-input v-model:value="row.base" :disabled="busy" placeholder="免补差上限" /></td>
                <td><n-input-number v-model:value="row.cards" :disabled="busy" :min="0" :max="4294967295" :precision="0" /></td>
                <td><n-button text type="error" :disabled="busy || tiers.length === 1" @click="tiers.splice(index, 1)">移除</n-button></td>
              </tr>
            </tbody>
          </n-table>
        </div>
        <n-space class="mt-16px">
          <n-button :disabled="busy" @click="tiers.push({ end: '', base: '', cards: null })">新增档位</n-button>
          <n-button type="primary" :loading="saving" :disabled="busy" @click="save">保存规则</n-button>
        </n-space>
      </template>
      <n-result v-else-if="!loading" status="error" title="规则加载失败">
        <template #footer><n-button @click="load">重新加载</n-button></template>
      </n-result>
    </n-spin>
  </n-card>
</template>
