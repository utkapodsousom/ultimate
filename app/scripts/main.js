function Timer(options) {
  this.hour = document.querySelectorAll("".concat(options.hour));
  this.min = document.querySelectorAll("".concat(options.min));
  this.sec = document.querySelectorAll("".concat(options.sec));
  this.separation = options.separation;

  Timer.prototype.start = function () {
    var _this = this;

    var update = function update() {
      var date = new Date();
      var tz = date.getTimezoneOffset();
      var now = Math.floor(date / 1000 - tz * 60);
      var next = Math.ceil((date / 1000 / 60 - tz) / 60 / 24) * 60 * 60 * 24;
      var left = next - now;
      var hourString = ("0" + ~~(left / 60 / 60)).slice(-2);
      var minString = ("0" + ~~((left / 60) % 60)).slice(-2);
      var secString = ("0" + ~~(left % 60)).slice(-2); // каждая цифра в отдельном элементе

      var separation = function separation() {
        for (var i = 0; i < _this.min.length; i++) {
          _this.hour[i].innerHTML = "<span>"
            .concat(hourString[0], "</span><span>")
            .concat(hourString[1], "</span>");
          _this.min[i].innerHTML = "<span>"
            .concat(minString[0], "</span><span>")
            .concat(minString[1], "</span>");
          _this.sec[i].innerHTML = "<span>"
            .concat(secString[0], "</span><span>")
            .concat(secString[1], "</span>");
        }
      }; // цифры вместе

      var together = function together() {
        for (var i = 0; i < _this.min.length; i++) {
          _this.hour[i].innerHTML = hourString;
          _this.min[i].innerHTML = minString;
          _this.sec[i].innerHTML = secString;
        }
      };

      _this.separation ? separation() : together();
    };

    setInterval(function () {
      update();
    }, 1000);
  };
} // инициализация

var timer = new Timer({
  hour: ".t-hour",
  min: ".t-min",
  sec: ".t-sec",
  separation: false, // разделяет цифры
}).start();

// works with zepto
function easeInOutQuart(t) {
  const t1 = t - 1;
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
}
function smoothScroll(el, to, duration) {
  var initial = $(window).scrollTop();
  var dest = to - initial;
  var start = null;
  function step(timestamp) {
    if (!start) start = timestamp;
    var progress = timestamp - start;
    var percentage = progress / duration;
    var tick = easeInOutQuart(percentage) * dest + initial;
    window.scrollTo(0, tick);
    if (progress < duration) {
      window.requestAnimationFrame(step);
    } else {
      return;
    }
  }
  window.requestAnimationFrame(step);
}

$(document).on("click", 'a[href^="#"]', function (e) {
  var id = $(this).attr("href");
  var $id = $(id);
  if ($id.length === 0) {
    return;
  }
  e.preventDefault();
  var pos = $id.offset().top - 70;
  smoothScroll($(window), $($(e.currentTarget).attr("href")).offset().top, 600);
});
