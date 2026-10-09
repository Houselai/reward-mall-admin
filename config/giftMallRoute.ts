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
      name: 'giftMall_appletConfig',
      path: '/giftMall/appletConfig',
      component: 'self',
      meta: {
        title: '小程序公开配置',
        icon: 'mdi:cog-outline',
      },
    },
    {
      name: 'giftMall_banner',
      path: '/giftMall/banner',
      component: 'self',
      meta: {
        title: 'Banner 管理',
        icon: 'mdi:image-multiple-outline',
      },
    },
    {
      name: 'giftMall_product',
      path: '/giftMall/product',
      component: 'self',
      meta: {
        title: '商品管理',
        icon: 'mdi:shopping-outline',
      },
    },
    {
      name: 'giftMall_category',
      path: '/giftMall/category',
      component: 'self',
      meta: {
        title: '分类管理',
        icon: 'mdi:shape-outline',
      },
    },
    {
      name: 'giftMall_brand',
      path: '/giftMall/brand',
      component: 'self',
      meta: {
        title: '品牌管理',
        icon: 'mdi:tag-outline',
      },
    },
    {
      name: 'giftMall_kingkong',
      path: '/giftMall/kingkong',
      component: 'self',
      meta: {
        title: '金刚区管理',
        icon: 'mdi:view-grid-outline',
      },
    },
    {
      name: 'giftMall_homeCategory',
      path: '/giftMall/homeCategory',
      component: 'self',
      meta: {
        title: '首页栏目配置',
        icon: 'mdi:view-dashboard-outline',
      },
    },
  ],
}
