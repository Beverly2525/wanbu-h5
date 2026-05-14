const targetSteps = 10000;
const circumference = 2 * Math.PI * 76;

const state = {
  steps: Number(localStorage.getItem("steps") || 7260),
  stake: Number(localStorage.getItem("stake") || 19),
  joined: localStorage.getItem("joined") === "true",
  pool: Number(localStorage.getItem("pool") || 8932),
  players: Number(localStorage.getItem("players") || 312),
  failing: Number(localStorage.getItem("failing") || 48)
};

const names = ["你", "小林", "Mia", "阿哲", "Summer", "陈晨"];
const baseRows = [
  { name: "小林", steps: 12880, stake: 39 },
  { name: "Mia", steps: 11320, stake: 69 },
  { name: "阿哲", steps: 9960, stake: 39 },
  { name: "Summer", steps: 8420, stake: 19 },
  { name: "陈晨", steps: 5810, stake: 99 }
];

const $ = (selector) => document.querySelector(selector);

const elements = {
  stepCount: $("#stepCount"),
  meterCircle: $("#meterCircle"),
  timeLeft: $("#timeLeft"),
  winChance: $("#winChance"),
  stakeButtons: [...document.querySelectorAll(".stake")],
  joinStatus: $("#joinStatus"),
  joinBtn: $("#joinBtn"),
  poolAmount: $("#poolAmount"),
  playerCount: $("#playerCount"),
  failCount: $("#failCount"),
  syncBtn: $("#syncBtn"),
  simulateBtn: $("#simulateBtn"),
  settleBtn: $("#settleBtn"),
  shareBtn: $("#shareBtn"),
  leaderboard: $("#leaderboard"),
  toast: $("#toast")
};

elements.meterCircle.style.strokeDasharray = String(circumference);

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function persist() {
  localStorage.setItem("steps", String(state.steps));
  localStorage.setItem("stake", String(state.stake));
  localStorage.setItem("joined", String(state.joined));
  localStorage.setItem("pool", String(state.pool));
  localStorage.setItem("players", String(state.players));
  localStorage.setItem("failing", String(state.failing));
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function updateClock() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const ms = Math.max(0, end - now);
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  elements.timeLeft.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function renderLeaderboard() {
  const rows = [
    { name: "你", steps: state.steps, stake: state.stake },
    ...baseRows
  ].sort((a, b) => b.steps - a.steps);

  elements.leaderboard.innerHTML = rows.map((row, index) => {
    const done = row.steps >= targetSteps;
    const status = done ? "已完成" : `差 ${formatNumber(targetSteps - row.steps)}`;
    const riskClass = done ? "" : " is-risk";
    const self = row.name === "你" ? " · 我的进度" : "";

    return `
      <li>
        <span class="rank">${index + 1}</span>
        <span class="person">
          <strong>${row.name}</strong>
          <small>${formatNumber(row.steps)} 步 · 挑战金 ¥${row.stake}${self}</small>
        </span>
        <span class="result${riskClass}">${status}</span>
      </li>
    `;
  }).join("");
}

function render() {
  const progress = Math.min(state.steps / targetSteps, 1);
  elements.stepCount.textContent = formatNumber(state.steps);
  elements.winChance.textContent = `${Math.round(progress * 100)}%`;
  elements.meterCircle.style.strokeDashoffset = String(circumference * (1 - progress));
  elements.poolAmount.textContent = `¥${formatNumber(state.pool)}`;
  elements.playerCount.textContent = `${formatNumber(state.players)} 人参与`;
  elements.failCount.textContent = `${formatNumber(state.failing)} 人落后`;
  elements.joinStatus.textContent = state.joined ? "已加入" : "未加入";
  elements.joinBtn.textContent = state.joined ? "已加入，继续冲刺" : "加入今日 10,000 步挑战";
  elements.joinBtn.disabled = state.joined;
  elements.stakeButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.stake) === state.stake);
  });
  renderLeaderboard();
  persist();
}

function joinChallenge() {
  if (state.joined) {
    toast("你已经在今天的挑战里了。");
    return;
  }

  state.joined = true;
  state.pool += state.stake;
  state.players += 1;
  toast(`已加入：今日挑战金 ¥${state.stake}。`);
  render();
}

function addSteps(amount, message) {
  state.steps = Math.min(16888, state.steps + amount);
  if (state.steps >= targetSteps && state.failing > 0) {
    state.failing -= 1;
  }
  toast(message);
  render();
}

function settleToday() {
  if (!state.joined) {
    toast("先加入挑战，再进行今日结算。");
    return;
  }

  if (state.steps >= targetSteps) {
    const estimatedReward = Math.max(3, Math.round((state.pool * 0.12) / Math.max(1, state.players - state.failing)));
    toast(`挑战成功，预计获得 ¥${estimatedReward} 达标奖励。`);
  } else {
    toast(`还差 ${formatNumber(targetSteps - state.steps)} 步，暂时不能结算成功。`);
  }
}

elements.stakeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.joined) {
      toast("加入后今日挑战金不可修改。");
      return;
    }
    state.stake = Number(button.dataset.stake);
    render();
  });
});

elements.joinBtn.addEventListener("click", joinChallenge);
elements.syncBtn.addEventListener("click", () => {
  addSteps(Math.floor(180 + Math.random() * 640), "已模拟同步微信运动步数。");
});
elements.simulateBtn.addEventListener("click", () => {
  addSteps(520, "刚刚多走了 520 步。");
});
elements.settleBtn.addEventListener("click", settleToday);
elements.shareBtn.addEventListener("click", async () => {
  const shareData = {
    title: "万步挑战",
    text: "今天 10,000 步，用步数证明执行力。",
    url: location.href
  };

  if (navigator.share) {
    await navigator.share(shareData).catch(() => {});
    return;
  }

  await navigator.clipboard?.writeText(location.href).catch(() => {});
  toast("链接已复制，可粘贴到微信分享。");
});

updateClock();
render();
setInterval(updateClock, 30000);

if (!names.length) {
  console.info("Leaderboard names are unavailable.");
}
