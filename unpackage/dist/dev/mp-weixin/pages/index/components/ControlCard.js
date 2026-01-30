"use strict";
const common_vendor = require("../../../common/vendor.js");
const _sfc_main = {};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o(($event) => _ctx.$emit("start", ".")),
    b: common_vendor.o(($event) => _ctx.$emit("stop", ".")),
    c: common_vendor.o(($event) => _ctx.$emit("stop", ".")),
    d: common_vendor.o(($event) => _ctx.$emit("start", "-")),
    e: common_vendor.o(($event) => _ctx.$emit("stop", "-")),
    f: common_vendor.o(($event) => _ctx.$emit("stop", "-"))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-41834b91"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../../../.sourcemap/mp-weixin/pages/index/components/ControlCard.js.map
