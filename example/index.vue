<script setup lang="ts">
import { ref } from 'vue'
import { componentType } from '@/components/business/QueryForm/types'
import type { FormItemsProps } from '@/components/business/QueryForm/types'
import type { BasicColumns } from '@/components/business/Table/types'

interface ExampleGift {
  id: number
  name: string
  status: '0' | '1'
  status_name: string
}

interface ExampleQuery {
  name?: string
  status?: string
  page?: number
  step?: number
}

const basicTableRef = ref()
const formItems: FormItemsProps = [
  { label: '礼品名称', field: 'name', component: componentType.input },
  {
    label: '上架状态',
    field: 'status',
    component: componentType.select,
    componentProps: {
      options: [
        { label: '已上架', value: '1' },
        { label: '已下架', value: '0' },
      ],
    },
  },
]

const basicColumns: BasicColumns = [
  { title: '编号', key: 'id' },
  { title: '礼品名称', key: 'name' },
  { title: '上架状态', key: 'status_name' },
]

// 演示数据仅用于验证公共列表组件，不对应真实商品或商城接口。
const exampleGifts: ExampleGift[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `示例礼品 ${index + 1}`,
  status: index % 2 === 0 ? '1' : '0',
  status_name: index % 2 === 0 ? '已上架' : '已下架',
}))

async function fetchExampleList({ name = '', status = '', page = 1, step = 10 }: ExampleQuery = {}) {
  const filtered = exampleGifts.filter(item =>
    item.name.includes(name.trim()) && (!status || item.status === status),
  )
  const start = (page - 1) * step
  return {
    error: null,
    data: { list: filtered.slice(start, start + step), total: filtered.length },
  }
}

function handleSearch(options: ExampleQuery) {
  basicTableRef.value.fetchDataSource(options)
}
</script>

<template>
  <div class="h-full">
    <n-card class="shadow-sm rounded-5px">
      <n-alert type="info" class="mb-15px" :show-icon="true">
        当前为礼品商城示例页面，使用本地演示数据，支持查询和分页。
      </n-alert>
      <QueryForm :form-items="formItems" @search="handleSearch" />
    </n-card>
    <n-card class="shadow-sm rounded-5px mt-5px">
      <BasicTable
        ref="basicTableRef" :basic-columns="basicColumns" :request="fetchExampleList"
        :row-key="(row) => row.id"
      />
    </n-card>
  </div>
</template>
