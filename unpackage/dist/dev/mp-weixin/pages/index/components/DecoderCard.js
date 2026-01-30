"use strict";
const common_vendor = require("../../../common/vendor.js");
const _sfc_main = {
  props: {
    decoderText: {
      type: String,
      required: true
    },
    wpm: {
      type: Number,
      required: true
    },
    toneFreq: {
      type: Number,
      required: true
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t($props.decoderText || "..."),
    b: common_vendor.t($props.wpm),
    c: $props.wpm,
    d: common_vendor.o(($event) => _ctx.$emit("wpm-change", $event)),
    e: common_vendor.t($props.toneFreq),
    f: $props.toneFreq,
    g: common_vendor.o(($event) => _ctx.$emit("tone-change", $event))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-975bf80c"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../../../.sourcemap/mp-weixin/pages/index/components/DecoderCard.js.map
