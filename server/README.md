# 万步挑战后端模板

这个后端负责：

- 使用 `wx.login` 返回的 `code` 调微信 `jscode2session`
- 保存服务端 `session_key`
- 解密 `wx.getWeRunData` 返回的微信运动加密步数
- 保存用户昵称、挑战金和排行榜

## 本地启动

```bash
set WECHAT_APPID=你的小程序AppID
set WECHAT_SECRET=你的小程序AppSecret
node server.js
```

PowerShell:

```powershell
$env:WECHAT_APPID="你的小程序AppID"
$env:WECHAT_SECRET="你的小程序AppSecret"
node .\server.js
```

## 正式上线必须改造

当前模板用内存保存数据，重启会丢失。正式上线需要换成数据库，例如 MySQL、PostgreSQL、MongoDB、Redis 或云开发数据库。

小程序后台还需要配置合法请求域名，且域名必须是 HTTPS。
