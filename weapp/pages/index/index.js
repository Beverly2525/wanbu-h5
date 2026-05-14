const targetSteps = 10000;

function formatNumber(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

Page({
  data: {
    steps: 0,
    stepsText: "0",
    progress: 0,
    timeLeft: "--:--",
    nickName: "",
    stake: 1,
    stakes: [1, 5, 10],
    joined: false,
    pool: 0,
    players: 0,
    lagging: 0,
    leaderboard: [],
    history: [],
    boardMode: "today"
  },

  onLoad() {
    this.tickClock();
    this.loadLeaderboard();
    this.clock = setInterval(() => this.tickClock(), 30000);
  },

  onUnload() {
    clearInterval(this.clock);
  },

  tickClock() {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const ms = Math.max(0, end - now);
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    this.setData({
      timeLeft: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    });
  },

  chooseStake(event) {
    if (this.data.joined) return;
    this.setData({ stake: Number(event.currentTarget.dataset.value) });
  },

  onNickNameInput(event) {
    this.setData({ nickName: event.detail.value || "" });
  },

  joinChallenge() {
    if (!this.data.nickName.trim()) {
      wx.showToast({ title: "先填昵称", icon: "none" });
      return;
    }

    this.syncSteps(true)
      .then(() => {
        this.setData({ joined: true });
        wx.showToast({ title: "已加入", icon: "success" });
      })
      .catch((error) => this.showError(error));
  },

  syncSteps(joined = false) {
    return this.getWeRunData()
      .then((res) => {
        if (!res.cloudID) {
          throw new Error("请先开通云开发");
        }

        return this.callWanbu({
          action: "syncSteps",
          joined: joined || this.data.joined,
          nickName: this.data.nickName.trim(),
          stake: this.data.stake,
          weRunData: wx.cloud.CloudID(res.cloudID)
        });
      })
      .then((result) => {
        this.updateSteps(result.steps || 0);
        this.renderSummary(result);
      });
  },

  getWeRunData() {
    return new Promise((resolve, reject) => {
      wx.getWeRunData({
        success: resolve,
        fail: () => reject(new Error("需要授权微信运动步数"))
      });
    });
  },

  loadLeaderboard() {
    this.callWanbu({ action: "leaderboard" })
      .then((res) => this.renderSummary(res))
      .catch(() => {});
  },

  switchBoard(event) {
    this.setData({
      boardMode: event.currentTarget.dataset.mode
    });
  },

  callWanbu(data) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) {
        reject(new Error("当前基础库不支持云开发"));
        return;
      }

      wx.cloud.callFunction({
          name: "wanbu",
          data,
        success: ({ result }) => {
          if (result && result.ok !== false) {
            resolve(result);
            return;
          }
          reject(new Error((result && result.error) || "云函数请求失败"));
        },
        fail: reject
      });
    });
  },

  renderSummary(result) {
    const leaderboard = (result.leaderboard || []).map((item, index) => {
      const nickName = item.nickName || "微信用户";
      const rankIcons = ["🏆", "🥈", "🥉"];
      const rankClasses = ["gold", "silver", "bronze"];
      return {
        ...item,
        nickName,
        rankIcon: rankIcons[index] || "•",
        rankNumber: String(index + 1),
        rankClass: rankClasses[index] || ""
      };
    });
    const history = (result.history || []).map((day) => ({
      ...day,
      label: this.formatDayLabel(day.day),
      top: (day.top || []).map((item, index) => ({
        ...item,
        rankText: String(index + 1)
      }))
    }));

    this.setData({
      pool: result.pool || 0,
      players: result.players || 0,
      lagging: result.lagging || 0,
      leaderboard,
      history
    });
  },

  formatDayLabel(day) {
    if (!day) return "";
    const parts = day.split("-");
    return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : day;
  },

  updateSteps(steps) {
    const progress = Math.min(100, Math.round((steps / targetSteps) * 100));
    this.setData({
      steps,
      stepsText: formatNumber(steps),
      progress
    });
  },

  showError(error) {
    wx.showToast({
      title: error && error.message ? error.message : "操作失败",
      icon: "none"
    });
  }
});
