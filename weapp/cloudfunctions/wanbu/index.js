const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const players = db.collection("players");
const targetSteps = 10000;
let playersCollectionReady = false;

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
  await ensurePlayersCollection();
  const day = todayKey();
  const id = `${day}_${openid}`;
  const now = db.serverDate();
  const data = {
    openid,
    day,
    nickName: cleanName(payload.nickName),
    stake: Number(payload.stake || 1),
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
  await ensurePlayersCollection();
  const day = todayKey();
  const result = await players
    .where({ day })
    .orderBy("steps", "desc")
    .limit(50)
    .get();

  const rows = result.data || [];
  const joinedRows = rows.filter((row) => row.joined);
  const lagging = joinedRows.filter((row) => Number(row.steps || 0) < targetSteps).length;
  const incentivePool = joinedRows
    .filter((row) => Number(row.steps || 0) < targetSteps)
    .reduce((sum, row) => sum + Number(row.stake || 0), 0);
  const winners = joinedRows.filter((row) => Number(row.steps || 0) >= targetSteps);
  const bonus = winners.length > 0 ? Number((incentivePool / winners.length).toFixed(2)) : 0;

  return {
    pool: incentivePool,
    players: joinedRows.length,
    lagging,
    leaderboard: rows.map((row) => ({
      openid: row.openid,
      nickName: row.nickName || "微信用户",
      stake: Number(row.stake || 1),
      steps: Number(row.steps || 0),
      bonus: Number(row.steps || 0) >= targetSteps ? bonus : 0,
      joined: Boolean(row.joined)
    }))
  };
}

async function buildHistory() {
  await ensurePlayersCollection();
  const result = await players
    .orderBy("day", "desc")
    .orderBy("steps", "desc")
    .limit(300)
    .get();

  const days = [];
  const byDay = {};

  for (const row of result.data || []) {
    if (!byDay[row.day]) {
      byDay[row.day] = {
        day: row.day,
        players: 0,
        reached: 0,
        top: []
      };
      days.push(byDay[row.day]);
    }

    const group = byDay[row.day];
    if (row.joined) {
      group.players += 1;
    }
    if (Number(row.steps || 0) >= targetSteps) {
      group.reached += 1;
    }
    if (group.top.length < 3) {
      group.top.push({
        openid: row.openid,
        nickName: row.nickName || "微信用户",
        stake: Number(row.stake || 1),
        steps: Number(row.steps || 0),
        joined: Boolean(row.joined)
      });
    }
  }

  return {
    history: days.slice(0, 7)
  };
}

async function ensurePlayersCollection() {
  if (playersCollectionReady) {
    return;
  }

  try {
    await db.createCollection("players");
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!message.includes("collection exists") && !message.includes("already exists")) {
      // If the collection already exists, some runtimes return a localized message.
      // A harmless count probes whether it is usable before surfacing the original error.
      try {
        await players.limit(1).get();
      } catch {
        throw error;
      }
    }
  }

  playersCollectionReady = true;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || "leaderboard";

  if (action === "leaderboard") {
    return {
      ok: true,
      ...(await buildSummary()),
      ...(await buildHistory())
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
    ...(await buildSummary()),
    ...(await buildHistory())
  };
};
