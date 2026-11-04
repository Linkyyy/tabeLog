# 我的菜单 · AI 与扫码点餐

以下均为实际运行界面截图，使用隔离的演示账户与示例菜谱。食物图片沿用项目明确标注的 AI 演示图片。截图中的 `tabelog.example` 和二维码仅作展示，不能作为线上点餐入口；实际请在已部署、手机可访问的网站生成二维码。

## 手机扫码选菜与下单

<img src="guest-menu-mobile.png" alt="手机扫码点餐菜单" width="320" /> <img src="guest-checkout.png" alt="确认点餐与填写忌口" width="320" />

<img src="order-submitted.png" alt="点餐成功回执" width="320" /> <img src="menu-tools-mobile.png" alt="我的菜单中的 AI 与点餐工具入口（示例地图）" width="320" />

## 分享与接单

选择自己公开的菜谱并导出二维码，访客无需注册即可点餐。私人菜谱不可选；分享可以关闭或更换二维码。

![二维码分享设置](qr-sharing.png)

主人查看点餐、接单并标记完成；称呼、位置和忌口只对主人可见。

![主人点餐订单](owner-orders.png)

## AI 接口与批量导入

默认 DeepSeek API 基础地址为 **`https://api.deepseek.com`**，模型 ID 默认为 `deepseek-chat`。也支持 OpenAI、通义千问、Kimi、GLM、Claude、Gemini 和管理员允许的自定义 OpenAI 兼容接口。API Key 按账户加密保存。

![AI 接口设置](ai-settings.png)

下图通过实际 JSON 解析产生预览，可修改、选择后批量保存为私人菜谱。普通文字可使用配置后的 AI 整理。截图与自动化测试不代表已使用真实付费模型；真实调用需要用户自己的 API Key。

![菜谱导入预览](recipe-import-preview.png)

## 桌面点餐页

![桌面扫码菜单](guest-menu-desktop.png)
