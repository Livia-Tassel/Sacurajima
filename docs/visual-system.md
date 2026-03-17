# 视觉系统

## 视觉关键词

- 樱花
- 奶油感
- 柔和
- 陪伴感
- 半透明

## 色彩

- `--color-blush`: `#f7c7d9`
- `--color-rose`: `#ef96b4`
- `--color-cream`: `#fff7f3`
- `--color-mist`: `#f3eef7`
- `--color-ink`: `#443247`
- `--color-accent`: `#ff8ab2`
- `--color-danger`: `#dd5d74`

## 字体策略

- 标题：圆润、偏展示型字体
- 正文：高可读性、柔和笔触或圆角字体
- 若系统无自带字体，允许内置开源可商用字体资源

## 组件语言

- 圆角大于常规企业后台风格
- 半透明面板结合柔和阴影
- 按钮优先胶囊或圆角矩形
- 图标线条圆润，不使用尖锐棱角

## 角色规范

- 主角色名称：Sakurajima
- 形象方向：樱花主题少女风桌宠，柔和配色，透明背景
- v1 状态图至少覆盖 `idle / happy / thinking / sleepy / error`

## 资产清单

- `sakurajima-idle`：默认桌宠状态
- `sakurajima-happy`：连接成功、完成回应
- `sakurajima-thinking`：聊天生成中
- `sakurajima-sleepy`：未完成配置或低打扰状态
- `sakurajima-error`：错误提示状态
- `sakura-mark`：品牌标识与按钮装饰

## 当前落地策略

- 当前开发环境未配置图片生成所需 `OPENAI_API_KEY`
- Feature 5 先内置统一风格 SVG 资产，确保应用可直接使用
- 后续若补齐图片生成环境，可在不改动组件结构的前提下替换为更精细的生成式资产

## 动效

- 轻微呼吸
- 偶发眨眼
- 面板滑入
- 柔和背景光晕
