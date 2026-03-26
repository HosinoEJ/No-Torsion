// 显示/隐藏按钮
window.onscroll = function() {
  const btn = document.getElementById("backToTop");
  if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    btn.style.display = "block"; // 下滑200px显示
  } else {
    btn.style.display = "none";
  }
};

// 平滑返回顶部
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth" // 平滑滚动
  });
}