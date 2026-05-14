const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const players = db.collection("players");
const targetSteps = 10000;

function todayKey() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8.toISOString().slice(0, 10);
}

function getTodaySteps(stepInfoList) {
  if (!Array.isArray(stepInfoList) || stepInfoList.length === 0) {
    return 0;
  }

  const latest = stepInfoList.reduce((best, item) => {
    return Number(item.timestamp) > Number(best.timestamp) ? item : best;
  }, stepInfoList[0]);

  return Number(latest.step || 0);
}

function cleanName(value) {
  const name = String(value || "").trim();
  return name ? name.slice(0, 24) : "微信用户";
}

async function upsertPlayer(openid, payload) {
  const day = todayKey();
  const id = `${day}_${openid}`;
  const now = db.serverDate();
  const data = {
    _id: id,
    openid,
    day,
    nickName: cleanName(payload.nickName),
    stake: Number(payload.stake || 19),
    joined: Boolean(payload.joined),
    steps: Number(payload.steps || 0),
    updatedAt: now
  };

  try {
    await players.doc(id).set({
      data: {
        ...data,
        createdAt: now
      }
    });
  } catch (error) {
    await players.doc(id).update({
      data: {
        nickName: data.nickName,
        stake: data.stake,
        joined: data.joined,
        steps: data.steps,
        updatedAt: now
      }
    });
  }

  return data;
}

async function buildSummary() {
  const day = todayKey();
  const result = await players
    .where({ day })
    .orderBy("steps", "desc")
    .limit(50)
    .get();

  const rows = result.data || [];
  const joinedRows = rows.filter((row) => row.joined);
  const pool = joinedRows.reduce((sum, row) => sum + Number(row.stake || 0), 0);
  const lagging = joinedRows.filter((row) => Number(row.steps || 0) < targetSteps).length;

  return {
    pool,
    players: joinedRows.length,
    lagging,
    leaderboard: rows.map((row) => ({
      openid: row.openid,
      nickName: row.nickName || "微信用户",
      stake: Number(row.stake || 19),
      steps: Number(row.steps || 0),
      joined: Boolean(row.joined)
    }))
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || "leaderboard";

  if (action === "leaderboard") {
    return {
      ok: true,
      ...(await buildSummary())
    };
  }

  if (action !== "syncSteps") {
    return { ok: false, error: "Unknown action" };
  }

  const weRunData = event.weRunData && event.weRunData.data;
  if (!weRunData || !Array.isArray(weRunData.stepInfoList)) {
    return { ok: false, error: "没有拿到微信运动步数，请确认已授权" };
  }

  const steps = getTodaySteps(weRunData.stepInfoList);
  await upsertPlayer(openid, {
    nickName: event.nickName,
    stake: event.stake,
    joined: event.joined,
    steps
  });

  return {
    ok: true,
    steps,
    ...(await buildSummary())
  };
};
