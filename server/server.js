const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const appId = process.env.WECHAT_APPID;
const appSecret = process.env.WECHAT_SECRET;
const port = Number(process.env.PORT || 8787);

const sessions = new Map();
const players = new Map();

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function createSessionId() {
  return crypto.randomBytes(24).toString("base64url");
}

function requireSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Session expired");
  }
  return session;
}

function decryptWeRunData(sessionKey, encryptedData, iv) {
  const decipher = crypto.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(sessionKey, "base64"),
    Buffer.from(iv, "base64")
  );
  decipher.setAutoPadding(true);
  const decoded = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final()
  ]);
  const data = JSON.parse(decoded.toString("utf8"));
  if (data.watermark && data.watermark.appid !== appId) {
    throw new Error("Invalid appid watermark");
  }
  return data;
}

function getTodaySteps(stepInfoList) {
  if (!Array.isArray(stepInfoList) || stepInfoList.length === 0) {
    return 0;
  }
  const latest = stepInfoList.reduce((best, item) => {
    return item.timestamp > best.timestamp ? item : best;
  }, stepInfoList[0]);
  return Number(latest.step || 0);
}

function summary() {
  const leaderboard = [...players.values()]
    .sort((a, b) => b.steps - a.steps)
    .slice(0, 30)
    .map((player) => ({
      openid: player.openid,
      nickName: player.nickName,
      steps: player.steps,
      stake: player.stake
    }));

  const pool = [...players.values()].reduce((sum, player) => sum + player.stake, 0);
  const lagging = [...players.values()].filter((player) => player.steps < 10000).length;

  return {
    pool,
    players: players.size,
    lagging,
    leaderboard
  };
}

async function handleLogin(body) {
  if (!appId || !appSecret) {
    throw new Error("Server missing WECHAT_APPID or WECHAT_SECRET");
  }
  if (!body.code) {
    throw new Error("Missing code");
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("js_code", body.code);
  url.searchParams.set("grant_type", "authorization_code");

  const result = await requestJson(url);
  if (result.errcode) {
    throw new Error(`WeChat login failed: ${result.errmsg || result.errcode}`);
  }

  const sessionId = createSessionId();
  sessions.set(sessionId, {
    openid: result.openid,
    sessionKey: result.session_key,
    createdAt: Date.now()
  });

  if (!players.has(result.openid)) {
    players.set(result.openid, {
      openid: result.openid,
      nickName: "微信用户",
      steps: 0,
      stake: 19,
      updatedAt: Date.now()
    });
  }

  return { ok: true, sessionId };
}

async function handleProfile(body) {
  const session = requireSession(body.sessionId);
  const player = players.get(session.openid);
  player.nickName = String(body.nickName || "微信用户").slice(0, 24);
  player.updatedAt = Date.now();
  return { ok: true, ...summary() };
}

async function handleSteps(body) {
  const session = requireSession(body.sessionId);
  if (!body.encryptedData || !body.iv) {
    throw new Error("Missing encrypted step data");
  }

  const data = decryptWeRunData(session.sessionKey, body.encryptedData, body.iv);
  const player = players.get(session.openid);
  player.steps = getTodaySteps(data.stepInfoList);
  player.stake = Number(body.stake || player.stake || 19);
  player.updatedAt = Date.now();

  return {
    ok: true,
    steps: player.steps,
    ...summary()
  };
}

async function route(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === "GET" ? {} : await readBody(req);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    json(res, 200, { ok: true, ...summary() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    json(res, 200, await handleLogin(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile") {
    json(res, 200, await handleProfile(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/steps") {
    json(res, 200, await handleSteps(body));
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
}

http.createServer((req, res) => {
  route(req, res).catch((error) => {
    json(res, 400, { ok: false, error: error.message || "Bad request" });
  });
}).listen(port, () => {
  console.log(`Wanbu server listening on http://localhost:${port}`);
});
