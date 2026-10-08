export const giftMallRoute: AuthRoute.Route = {
  name: 'giftMall',
  path: '/giftMall',
  component: 'basic',
  meta: {
    title: '礼品商城',
    icon: 'mdi:gift-outline',
    order: 27,
  },
  children: [
    {
      name: 'giftMall_example',
      path: '/giftMall/example',
      component: 'self',
      meta: {
        title: '示例页面',
        icon: 'mdi:table-outline',
      },
    },
  ],
}
