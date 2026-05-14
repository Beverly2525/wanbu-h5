App({
  onLaunch() {
    const { cloudEnvId } = require("./config");
    if (wx.cloud) {
      wx.cloud.init({
        env: cloudEnvId || undefined,
        traceUser: true
      });
    }
  },

  globalData: {
    user: null
  }
});
