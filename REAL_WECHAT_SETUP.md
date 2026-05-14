# 真实微信步数版接入说明

当前仓库有两套东西：

- `index.html` / `styles.css` / `app.js`：GitHub Pages 上的静态演示版。
- `weapp/` + `server/`：真实微信步数版的起步代码。

真实版不能只靠普通 H5 完成，因为微信运动步数属于小程序开放能力，需要用户授权后调用 `wx.getWeRunData`，并在服务端解密。

## 你需要准备

1. 微信小程序账号
2. 小程序 `AppID`
3. 小程序 `AppSecret`
4. 一个 HTTPS 后端域名
5. 一个数据库，正式版必须持久化用户、步数、挑战记录和结算记录

不要把 `AppSecret` 写进前端、小程序包或 GitHub。它只能放在后端环境变量里。

## 接入流程

1. 打开微信开发者工具。
2. 导入 `weapp/` 目录。
3. 把 `weapp/project.config.json` 里的 `appid` 从 `touristappid` 改成你的小程序 AppID。
4. 部署 `server/server.js` 到一个 HTTPS 后端。
5. 在后端环境变量里配置：

```bash
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序AppSecret
```

6. 把 `weapp/config.js` 里的 `apiBase` 改成你的 HTTPS 后端域名。
7. 到微信公众平台后台配置小程序合法请求域名。
8. 在真机微信里测试授权微信运动。

## 昵称说明

现在的小程序不能静默读取用户昵称。更稳妥的方式是让用户在加入挑战时通过昵称输入框填写，微信会在 `input type="nickname"` 上提供昵称能力。

## 步数说明

小程序端调用：

```js
wx.login()
wx.getWeRunData()
```

后端调用微信 `jscode2session` 得到 `session_key`，再解密 `wx.getWeRunData` 返回的 `encryptedData` 和 `iv`，得到 `stepInfoList`。

## 资金规则提醒

“未达标用户的钱分给达标用户”容易触发博彩、抽奖、资金池等审核风险。真实上线建议先做以下任一版本：

- 虚拟积分版
- 商家赞助券版
- 失败挑战金进入公益池
- 固定奖励，不做用户之间输赢转移

如果一定接真实支付，需要先做完整合规方案、退款规则、用户协议、资金流水和风控。
