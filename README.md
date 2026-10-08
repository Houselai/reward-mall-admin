# 礼品商城后台子仓库

礼品商城模块接入 HSL-PD-Admin，沿用 Vue 3、TypeScript、Naive UI、Pinia、Vite 和 UnoCSS。

- 仓库：git@github.com:lintmx/reward-mall-admin.git
- 开发 / 测试 API：https://api-rem.llnovel.com
- 预发布 / 正式 API：https://api-rem.errli.cn
- 模块别名：`giftMall-package`
- 示例页：`/giftMall/example`

## 目录

- `config/giftMallRoute.ts`：模块路由。
- `config/route.d.ts`：路由名称类型。
- `config/request.ts`：环境地址和统一请求实例 `giftMallRequest`。
- `example/index.vue`：本地演示列表，展示查询和分页，不请求业务 API。

## 主项目接入

配置 Vite 与 TypeScript 的 `giftMall-package` 别名，在主项目路由类型中合并 `GiftMallRoute.RouteKey`，并在动态路由初始化时追加 `giftMallRoute`。权限接入与点读相同：当前点读未配置权限编号，而是登录后直接追加模块菜单。

后续业务 API 放在模块内 `api/`，通过 `giftMallRequest` 调用。页面目录与路由名称保持对应，例如 `giftMall_example` 对应 `example/index.vue`。模块需在 HSL-PD-Admin 中运行。
