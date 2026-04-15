<script>
export default {
  onLaunch: function () {
    console.log("App Launch")
  },
  onShow: function () {
    console.log("App Show")
  },
  onHide: function () {
    console.log("App Hide")
  },
}
</script>

<style>
page {
  background-color: #f5f8ff;
  color: #1f2937;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-tap-highlight-color: transparent;
}

view,
text,
navigator,
button,
input,
picker,
scroll-view,
image {
  box-sizing: border-box;
}

button {
  border-radius: 12rpx;
}

button::after {
  border: none;
}

.safe-area-bottom {
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.safe-area-only-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
