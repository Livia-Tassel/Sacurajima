# Feature 02: 桌宠窗口与托盘

## 目标

实现悬浮桌宠窗口、聊天面板窗口、托盘控制、单实例约束和窗口状态持久化。

## 核心行为

- 透明桌宠窗口始终可见，可拖动
- 点击桌宠切换聊天面板
- 托盘菜单支持隐藏、显示、设置、退出
- 重启应用后恢复窗口状态
- 重复启动应用时，不创建第二个实例

## 实现约束

- 使用单一 renderer 工程，通过视图参数区分 `companion` 和 `panel`
- 窗口状态以本地 JSON 文件持久化
- 托盘图标先采用内置轻量模板资源，后续可替换为正式图标
- `PanelWindow` 关闭时转为隐藏而不是销毁

## 实现结果

- 已新增 `WindowStateStore`，在用户数据目录持久化 companion 与 panel 的 bounds/visible
- 已实现 `CompanionWindow` 与 `PanelWindow` 双窗口，二者使用同一套 renderer 构建，通过 `view` 参数分流
- 已实现单实例约束；重复启动时恢复 companion，并拉起 panel
- 已实现托盘菜单，可切换桌宠显隐、打开面板、退出应用
- 已通过 preload 暴露 `window.togglePanel()` 与 `window.showPanel()`，未向 renderer 暴露额外高权限能力
- 已补充窗口避让逻辑：panel 显示时会自动尝试避开 companion
- 已补充 panel 顶部拖动条，降低移动窗口的发现成本

## 验证结果

- `npm run typecheck`：通过
- `npm test`：通过
- `npm run build`：通过
- `npm run dev`：主进程、preload、renderer 均成功启动，未观察到启动期报错

## 风险点

- 透明窗口与鼠标事件
- 多窗口同步与焦点管理
- macOS 托盘图标适配

## 验收标准

- 桌宠和面板窗口可正常显示、隐藏、聚焦
- 位置和显隐状态可恢复
- 托盘菜单和单实例行为正确

## 安全与严谨性审查

- 双窗口均保持 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- 窗口状态恢复使用显式边界收敛，损坏或越界数据会回退到安全范围
- 关闭 panel 时仅隐藏不销毁，避免反复创建窗口带来的状态丢失
- 已发现并修正一处恢复逻辑缺陷：通用尺寸夹紧会错误放大桌宠窗口，现已通过共享纯函数和测试锁定
- 托盘能力只绑定固定动作，不接受 renderer 动态指令，避免“任意窗口控制”扩大攻击面
