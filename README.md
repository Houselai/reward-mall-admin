# 礼品商城后台子仓库

礼品商城模块接入 HSL-PD-Admin，沿用 Vue 3、TypeScript、Naive UI、Pinia、Vite 和 UnoCSS。

- 仓库：git@github.com:lintmx/reward-mall-admin.git
- 开发 / 测试 API：https://api-rem.llnovel.com
- 预发布 / 正式 API：https://api-rem.errli.cn
- 模块别名：`giftMall-package`
- Banner 管理：`/giftMall/banner`
- 品牌管理：`/giftMall/brand`
- 分类管理：`/giftMall/category`
- 金刚区管理：`/giftMall/kingkong`
- 首页栏目配置：`/giftMall/homeCategory`
- 商品管理：`/giftMall/product`
- 小程序公开配置：`/giftMall/appletConfig`

## 目录

- `config/giftMallRoute.ts`：模块路由。
- `config/route.d.ts`：路由名称类型。
- `config/request.ts`：环境地址和统一请求实例 `giftMallRequest`。
- `api/banner.ts`、`banner/index.vue`：Banner 分页列表、详情、新增、编辑、软删除及图片上传。
- `api/brand.ts`：品牌查询、新增、详情、编辑、删除和图片上传接口。
- `brand/index.vue`：品牌管理页面，支持名称查询、分页、详情、新增、编辑和删除。
- `api/category.ts`：分类 CRUD、列表筛选选项、启用一级分类选项及图标上传接口。
- `category/index.vue`：分类管理页面，支持一级和二级分类。
- `api/kingkong.ts`：金刚区列表、整组保存及图标上传接口。
- `kingkong/index.vue`：四个固定位置的金刚区配置页面。
- `api/homeCategory.ts`：首页栏目列表、整体保存及商品选择接口。
- `homeCategory/index.vue`：两个固定首页栏目的名称、副标题及有序商品配置。
- `api/product.ts`、`product/index.vue`：商品CRUD、筛选、有序图片上传及完整商品表单。

## Banner 管理

依据 reward-mall-api 的 `docs/openapi.yaml`，列表仅发送页码和每页条数，按服务端的排序降序、ID降序展示。表单包含图片 URL / OSS key、跳转类型、跳转值、非负整数排序和启停状态；跳转类型为无动作（0）、H5（1）、二级页（2）、弹窗（3）。选择无动作时隐藏跳转值并提交空字符串，其他类型的跳转值必填且不额外校验内容格式。图片可上传到 `banner` 目录，完整 HTTP(S) URL 支持预览，OSS key 原样保存和展示。新增、编辑仅提交可写字段，删除调用独立软删除接口，失败时保留表单内容。

## 品牌管理

接口契约来自 reward-mall-api 的 `docs/openapi.yaml`。列表只发送名称、页码及每页条数；状态为启用或禁用，删除使用独立的软删除接口。表单包含名称、图片 URL / OSS key、非负整数排序、状态及备注，图片可通过 `/admin/tool/upload.json` 上传至 `brand` 目录。OSS key 原样保存和展示，完整 HTTP(S) URL 支持图片预览。

## 分类管理

分类接口同样依据 `docs/openapi.yaml`。列表支持名称、层级和上级分类组合筛选及分页，查询或重置回到第一页，翻页保留已提交条件；全部层级、全部上级分类提交 `null`。筛选选项从 `/admin/category/filter_options.json` 获取，上级选项包含启用和停用的未删除一级分类；一级层级与指定上级同时筛选时按接口返回空列表。列表及详情展示 `parent_name`，缺失时回退到上级 ID。上级为空表示一级分类，新增或编辑只能选择启用的一级分类作为上级，二级分类图标必填，一级分类图标选填。图标支持 URL / OSS key，也可上传到 `category` 目录。编辑时回显当前上级，不将已停用上级自动替换；上级未变时不提交 `parent_id`，更换上级只能选择当前启用项，清空上级提交 `null`。存在子分类或商品引用时由后端拒绝删除并提示原因。

## 金刚区管理

依据 `docs/openapi.yaml`，金刚区固定为位置1至4，无分页，不提供新增、删除或启停操作。页面完整读取四项，首次未配置时允许编辑空白默认值；名称、图标、跳转类型必填，每次通过 `/admin/kingkong/save.json` 整组提交。跳转类型为无动作（0）、H5（1）、二级页（2）、弹窗（3）。选择无动作时隐藏跳转值并提交空字符串，其他类型的跳转值必填且不额外校验格式。图标支持 URL / OSS key，也可上传到 `kingkong` 目录。时间字段只展示，不提交；保存失败保留编辑内容，重新加载未保存的内容前会提示确认。

## 首页栏目配置

依据 `docs/openapi.yaml`，固定位置1、2整体保存，名称必填，副标题最多500字且可为空，商品列表可为空。商品选择使用 `/admin/product/list.json` 查询全部未删除商品（包含停用商品），支持名称查询和分页；栏目内不能重复添加，跨栏目允许复用，通过上移、下移调整展示顺序。已有配置原样保留商品ID，不自动过滤停用或已删除商品；未加载名称的商品展示ID，保存时由服务端校验全部商品是否存在且未删除。保存失败保留编辑内容，时间信息只展示，不提交。

## 商品管理

依据 `docs/openapi.yaml`，支持标题、二级分类、品牌、状态筛选及分页，新增、详情、编辑与软删除。二级分类和品牌必填；商品表单及请求不包含价格、销量字段。图片有序且至少一张，支持URL / OSS key及上传。卡数量使用整数输入，前端限制1至4294967295，默认值为1；适用银行、状态从枚举接口读取，兑换规则使用纯文本。分类选项只包含启用的一、二级分类分支，品牌只包含启用项；编辑回显原关联，未修改的关联和状态不提交，修改关联或启用商品时由后端校验最终关联。保存失败保留表单内容。

## 小程序公开配置

`api/appletConfig.ts`、`appletConfig/index.vue` 对接 `/admin/applet_config/list.json` 与 `/admin/applet_config/save.json`。按接口顺序、名称、说明及类型动态生成表单，展示默认值，支持字符串、整数、布尔开关、有序字符串数组及 `pic` 图片。图片通过 `/admin/tool/upload.json` 上传至 `applet_config` 目录，使用返回的 `url` 作为配置值，支持预览、更换及清空；上传后需保存配置，上传期间禁止保存或重新加载，上传失败保留原值。仅保存修改项的 `key`、`value`，保留空字符串、0、false 和空数组，不提供配置定义的新增或删除。保存失败保留编辑内容，重新加载未保存的修改前提示确认。

## 商品、分类、品牌导入导出

三个管理页面均提供“导入”和“导出全部”。共用 `api/catalogTransfer.ts` 和 `components/CatalogTransfer.vue`，分别调用 `/admin/{product|category|brand}/import.json`、`export.json`。

导出不提交列表筛选和分页条件，包含全部未删除的启用及禁用数据；成功后展示数量和 OSS 下载链接，导出文件同时作为导入模板。导入通过 multipart 的 `file` 字段提交 XLSX，前端检查扩展名、非空及 10 MiB 上限，其余结构和业务校验交由服务端。弹窗说明完整行更新、空文本清空及原子导入语义；成功展示总数、新增、更新、未变化数量并刷新列表，分类同步刷新筛选选项；失败保留文件并按 Excel 行号、列名、字段及原因展示服务端错误。请求层仅在本次导入中保留错误明细，沿用统一鉴权和错误提示。

## 主项目接入

配置 Vite 与 TypeScript 的 `giftMall-package` 别名，在主项目路由类型中合并 `GiftMallRoute.RouteKey`，并在动态路由初始化时追加 `giftMallRoute`。权限接入与点读相同：当前点读未配置权限编号，而是登录后直接追加模块菜单。

业务 API 放在模块内 `api/`，通过 `giftMallRequest` 调用。页面目录与路由名称保持对应，例如 `giftMall_brand` 对应 `brand/index.vue`。模块需在 HSL-PD-Admin 中运行。
