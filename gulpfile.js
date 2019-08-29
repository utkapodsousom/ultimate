const { src, dest, watch, series, parallel, lastRun } = require("gulp");
const gulpLoadPlugins = require("gulp-load-plugins");
const browserSync = require("browser-sync");
const del = require("del");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const { argv } = require("yargs");
const svgSprite = require("gulp-svg-sprite");
const compress_images = require("compress-images");
const spritesmith = require("gulp.spritesmith");
const critical = require("critical");

const $ = gulpLoadPlugins();
const server = browserSync.create();

const port = argv.port || 9000;

const isProd = process.env.NODE_ENV === "production";
const isDev = !isProd;

const spriterConfig = {
  dest: "dist",
  log: "info",
  mode: {
    css: {
      example: true,
      render: {
        scss: true
      }
    },
    symbol: {
      example: true
    }
  }
};

function styles() {
  return src("app/styles/*.scss")
    .pipe($.plumber())
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe(
      $.sass
        .sync({
          outputStyle: "expanded",
          precision: 10,
          includePaths: ["."]
        })
        .on("error", $.sass.logError)
    )
    .pipe($.postcss([autoprefixer()]))
    .pipe($.if(!isProd, $.sourcemaps.write()))
    .pipe(dest(".tmp/styles"))
    .pipe(server.reload({ stream: true }));
}

function scripts() {
  return src("app/scripts/**/*.js")
    .pipe($.plumber())
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(!isProd, $.sourcemaps.write(".")))
    .pipe(dest(".tmp/scripts"))
    .pipe(server.reload({ stream: true }));
}

const lintBase = files => {
  return src(files)
    .pipe($.eslint({ fix: true }))
    .pipe(server.reload({ stream: true, once: true }))
    .pipe($.eslint.format())
    .pipe($.if(!server.active, $.eslint.failAfterError()));
};
function lint() {
  return lintBase("app/scripts/**/*.js").pipe(dest("app/scripts"));
}

function html() {
  return src("app/*.html")
    .pipe($.useref({ searchPath: [".tmp", "app", "."] }))
    .pipe($.if(/\.js$/, $.uglify({ compress: { drop_console: true } })))
    .pipe(
      $.if(/\.css$/, $.postcss([cssnano({ safe: true, autoprefixer: false })]))
    )
    .pipe(
      $.if(
        /\.html$/,
        $.htmlmin({
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: { compress: { drop_console: true } },
          processConditionalComments: true,
          removeComments: true,
          removeEmptyAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true
        })
      )
    )
    .pipe(dest("dist"));
}

// compression options
const compressionOptions = {
  compress_force: false,
  statistic: false,
  autoupdate: true,
  pathLog: "./log/lib/compress-images"
};

// Engine for compressing jpeg/png and options compress.
const engineJPEGOptions = {
  jpg: {
    engine: "mozjpeg",
    command: ["-quality", "80", "-progressive"]
  }
};

function compressImages() {
  return new Promise(function(resolve, reject) {
    compress_images(
      "app/images/**/*.{jpg,JPG,jpeg,JPEG,png,svg,gif}",
      "dist/images/",
      compressionOptions,
      false,
      engineJPEGOptions,
      { png: { engine: "pngquant", command: ["--quality=20-50"] } },
      { svg: { engine: "svgo", command: "--multipass" } },
      {
        gif: {
          engine: "gifsicle",
          command: ["--colors", "64", "--use-col=web"]
        }
      },
      function(err) {
        if (err !== null) {
          if (err.engine === "mozjpeg") {
            compress_images(
              err.input,
              err.output,
              { compress_force: false, statistic: true, autoupdate: true },
              false,
              {
                jpg: {
                  engine: "jpegRecompress",
                  command: ["--quality", "high", "--min", "60"]
                }
              },
              { png: { engine: false, command: false } },
              { svg: { engine: false, command: false } },
              { gif: { engine: false, command: false } },
              function(err) {
                if (err !== null) {
                  console.log("No trespassing beyond this point!");
                }
              }
            );
          }
          console.log(err);
        }
      }
    );
    resolve();
  });
}

function pngSprites() {
  return src("app/images/icons/*.png")
    .pipe(
      spritesmith({
        imgName: "sprite.png",
        cssName: "sprite.css",
        padding: 20
      })
    )
    .pipe($.if(!isProd, dest("app/images/icons/"), dest("dist/images/icons")));
}

function svgSprites() {
  return src("app/images/icons/svg/*")
    .pipe(svgSprite(spriterConfig))
    .pipe($.if(!isProd, dest("app/images"), dest("dist/images")));
}

function fonts() {
  return src("app/fonts/**/*.{eot,svg,ttf,woff,woff2}").pipe(
    $.if(!isProd, dest(".tmp/fonts"), dest("dist/fonts"))
  );
}

function extras() {
  return src(["app/*", "!app/*.html"], {
    dot: true
  }).pipe(dest("dist"));
}

function clean() {
  return del([".tmp", "dist", "app/images/icons/sprite.png", "app/images/icons/sprite.css"]);
}

function measureSize() {
  return src("dist/**/*").pipe($.size({ title: "build", gzip: true }));
}

function criticalPath() {
  return new Promise(function(resolve, reject) {
    critical.generate({
      inline: true,
      base: "dist/",
      src: "index.html",
      dest: "critical.html",
      minify: true,
      width: 480,
      height: 540
    });
    resolve();
  })
}

const build = series(
  clean,
  parallel(
    lint,
    series(parallel(styles, scripts), html),
    // images,
    compressImages,
    // fonts,
    extras
  ),
  measureSize,
  svgSprites,
  pngSprites
);

function startAppServer() {
  server.init({
    notify: false,
    port,
    server: {
      baseDir: [".tmp", "app"],
      routes: {
        "/node_modules": "node_modules"
      }
    }
  });

  watch(["app/*.html", "app/images/**/*", ".tmp/fonts/**/*"]).on(
    "change",
    server.reload
  );

  watch("app/styles/**/*.scss", styles);
  watch("app/scripts/**/*.js", scripts);
  watch("app/fonts/**/*", fonts);
}

function startDistServer() {
  server.init({
    notify: false,
    port,
    server: {
      baseDir: "dist",
      routes: {
        "/node_modules": "node_modules"
      }
    }
  });
}

let serve;
if (isDev) {
  serve = series(
    clean,
    parallel(styles, scripts, svgSprites, pngSprites),
    startAppServer
  );
} else if (isProd) {
  serve = series(build, startDistServer);
}

exports.pngsprites = pngSprites;
exports.compress = compressImages;
exports.svgsprites = svgSprites;
exports.criticalPath = criticalPath;
exports.serve = serve;
exports.build = build;
exports.default = build;
