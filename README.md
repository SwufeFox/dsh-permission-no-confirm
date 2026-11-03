# dsh-permission-no-confirm

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

DSH（DeepSeek Harness）插件：切换权限模式时不再弹出风险确认弹窗。

> A DeepSeek Harness plugin that switches permission modes without the “Enable Full access?” / “Auto review” risk-confirmation dialog.

- 当前会话：输入框旁的权限按钮（只可查看 / 工作区内修改 / 完全权限 / 自动审查）
- 新会话默认：设置 → 通用 → 权限
- 斜杠命令：`/permission`

以上三个入口选中「完全权限」或「自动审查」时，原版会先弹出「确认启用完全权限？」弹窗，必须勾选风险声明后再点确认。本插件让选择直接生效，其余交互、图标、文案、校验逻辑保持不变。

## 实现方式

Harness 原版把风险弹窗写死在权限界面的组件里（`@deepseek-ai/dsh-client-ui-permission-presets` 的浏览器端组件，以及 `/permission` 弹层里由选项元数据 `confirmation` 驱动的通用确认框），没有对外暴露关闭开关。因此本插件是该客户端模块的**无弹窗分叉**：

1. `cordis.patch.yml` 把原版行 `ui-permission` 置为 `disabled: true`，使其浏览器模块不再进入启动图；
2. 同一补丁插入本包的行 `permission-no-confirm`，由 `lib/client.js` 提供同样的权限界面；
3. `lib/client.js` 仅移除三处风险门禁：弹层选择分支、设置行选择分支、`/permission` 选项的 `confirmation` 元数据；其余代码与原版一致。

`lib/client.js` 由 `scripts/build-client.mjs` 从已安装的原版模块派生，脚本对每一处改动都做了行断言，原版结构变化时会直接报错而不是静默产出错误产物；改造后文件中也已不存在 `RiskConfirmation` 相关引用。

## 安装

```text
plugin_manager install_bundle  target=<本目录绝对路径>
```

或直接用 `plugin_manager install_bundle` 工具指向本目录。安装后插件行出现在设置 → 插件中，名称为「权限切换免确认」。

从 GitHub 安装：

```sh
git clone https://github.com/SwufeFox/dsh-permission-no-confirm.git
```

再把 `plugin_manager install_bundle` 的 `target` 指向克隆下来的目录（profile 里是目录链接，之后 `git pull` 即更新）。

## 测试

```text
node --test test/client.test.mjs
```

测试在 Node 里加载真实产物 `lib/client.js`（stub 掉 React、快照存储与客户端服务），断言：

- 两个权限插槽与 `/permission` 装饰正常注册；
- 输入框权限选择器与设置行选中「完全权限」「自动审查」时立即调用切换函数，渲染树中不存在 `RiskConfirmation`；
- `/permission` 弹层选项不再携带 `confirmation` 元数据。

## 已知取舍

- 这是对官方权限界面的替换：官方后续若调整该界面（新增入口、新增权限预设、新增风险门禁），本插件不会自动跟随，需要重新运行 `build`（`node scripts/build-client.mjs`）再复核差异。原版行被 `disabled` 后，界面完全由本包提供。
- 关闭的是「风险确认弹窗」，不是权限本身：切到完全权限后的沙箱/审批行为仍由当前权限模式决定。
- **不要单独停用插件行** `permission-no-confirm`：原版行已被本补丁禁用，单独停用会让权限控件从界面上消失。恢复原版请按 bundle 级别停用（`plugin_manager` 的 `set_bundle`）或直接卸载：

  ```text
  plugin_manager remove_bundle target=dsh-permission-no-confirm
  ```

  移除后原版行恢复启用，弹窗回归。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` 与 `dsh.client`（web 平台、模块依赖） |
| `cordis.patch.yml` | 禁用原版 `ui-permission` 行并插入本包行 |
| `lib/index.js` | Host 侧空 `apply`（仅为让 Host 组合出客户端模块） |
| `lib/client.js` | 浏览器端权限界面（无风险弹窗的派生版本） |
| `scripts/build-client.mjs` | 从已安装原版模块重新派生 `lib/client.js` 的构建脚本 |
| `locale/*.json` | 插件列表中的标题与描述 |
| `icon.svg` | 插件图标 |

## License

[MIT](LICENSE) © Magixyne
