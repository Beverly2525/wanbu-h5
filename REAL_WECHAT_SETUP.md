# 真实微信步数版接入说明

当前仓库有三套东西：

- `index.html` / `styles.css` / `app.js`：GitHub Pages 上的静态演示版。
- `weapp/` + `weapp/cloudfunctions/wanbu`：推荐使用的微信云开发真实步数版。
- `server/`：外部服务器后端模板，适合以后不用云开发时迁移。

真实版不能只靠普通 H5 完成，因为微信运动步数属于小程序开放能力，需要用户授权后调用 `wx.getWeRunData`，并在服务端解密。

## 你需要准备

1. 微信小程序账号
2. 小程序 `AppID`
3. 微信开发者工具里的云开发环境

云开发版本不需要你把 `AppSecret` 发给任何人。

## 接入流程

1. 打开微信开发者工具。
2. 导入 `weapp/` 目录。
3. 把 `weapp/project.config.json` 里的 `appid` 从 `touristappid` 改成你的小程序 AppID。
4. 点击微信开发者工具顶部的“云开发”，按提示开通环境。
5. 复制云开发环境 ID，填入 `weapp/config.js` 的 `cloudEnvId`。
6. 在资源管理器里右键 `cloudfunctions/wanbu`，选择“上传并部署：云端安装依赖”。
7. 在云开发控制台创建数据库集合 `players`。
8. 在真机微信里测试授权微信运动。

## 昵称说明

现在的小程序不能静默读取用户昵称。更稳妥的方式是让用户在加入挑战时通过昵称输入框填写，微信会在 `input type="nickname"` 上提供昵称能力。

## 步数说明

小程序端调用：

```js
wx.login()
wx.getWeRunData()
```

云开发版本使用 `res.cloudID` + `wx.cloud.CloudID`。云函数收到后会直接得到开放数据里的 `stepInfoList`，不用你手动管理 `session_key`。

## 资金规则提醒

“未达标用户的钱分给达标用户”容易触发博彩、抽奖、资金池等审核风险。真实上线建议先做以下任一版本：

- 虚拟积分版
- 商家赞助券版
- 失败挑战金进入公益池
- 固定奖励，不做用户之间输赢转移

如果一定接真实支付，需要先做完整合规方案、退款规则、用户协议、资金流水和风控。
