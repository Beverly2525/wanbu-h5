const { apiBase } = require("../../config");

const app = getApp();
const targetSteps = 10000;

Page({
  data: {
    steps: 0,
    stepsText: "0",
    progress: 0,
    timeLeft: "--:--",
    nickName: "",
    stake: 19,
    stakes: [19, 39, 69, 99],
    joined: false,
    pool: 0,
    players: 0,
    lagging: 0,
    leaderboard: []
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
      wx.showToast({ title: "先填写昵称", icon: "none" });
      return;
    }

    this.ensureSession()
      .then(() => this.saveProfile())
      .then(() => this.syncSteps())
      .then(() => {
        this.setData({ joined: true });
        wx.showToast({ title: "已加入挑战", icon: "success" });
      })
      .catch((error) => this.showError(error));
  },

  syncSteps() {
    return this.ensureSession()
      .then(() => this.getWeRunData())
      .then((res) => this.request("/api/steps", {
        sessionId: app.globalData.sessionId,
        encryptedData: res.encryptedData,
        iv: res.iv,
        stake: this.data.stake
      }))
      .then((result) => {
        this.updateSteps(result.steps || 0);
        this.setData({
          pool: result.pool || 0,
          players: result.players || 0,
          lagging: result.lagging || 0,
          leaderboard: result.leaderboard || []
        });
      });
  },

  ensureSession() {
    if (app.globalData.sessionId) {
      return Promise.resolve(app.globalData.sessionId);
    }

    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => {
          if (!code) {
            reject(new Error("微信登录失败"));
            return;
          }
          this.request("/api/login", { code })
            .then((res) => {
              app.globalData.sessionId = res.sessionId;
              resolve(res.sessionId);
            })
            .catch(reject);
        },
        fail: reject
      });
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

  saveProfile() {
    return this.request("/api/profile", {
      sessionId: app.globalData.sessionId,
      nickName: this.data.nickName.trim()
    });
  },

  loadLeaderboard() {
    this.request("/api/leaderboard", {}, "GET")
      .then((res) => {
        this.setData({
          pool: res.pool || 0,
          players: res.players || 0,
          lagging: res.lagging || 0,
          leaderboard: res.leaderboard || []
        });
      })
      .catch(() => {});
  },

  updateSteps(steps) {
    const progress = Math.min(100, Math.round((steps / targetSteps) * 100));
    this.setData({
      steps,
      stepsText: new Intl.NumberFormat("zh-CN").format(steps),
      progress
    });
  },

  request(path, data, method = "POST") {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBase}${path}`,
        method,
        data,
        success: ({ statusCode, data: body }) => {
          if (statusCode >= 200 && statusCode < 300 && body && body.ok !== false) {
            resolve(body);
            return;
          }
          reject(new Error((body && body.error) || "请求失败"));
        },
        fail: reject
      });
    });
  },

  showError(error) {
    wx.showToast({
      title: error && error.message ? error.message : "操作失败",
      icon: "none"
    });
  }
});
