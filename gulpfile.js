const { src, dest, watch, series, parallel, lastRun } = require("gulp");
const gulpLoadPlugins = require("gulp-load-plugins");
const browserSync = require("browser-sync");
const del = require("del");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const { argv } = require("yargs");
const compress_images = require("compress-images");
const critical = require("critical");

const $ = gulpLoadPlugins();
const server = browserSync.create();

const port = argv.port || 9000;

const isProd = process.env.NODE_ENV === "production";
const isDev = !isProd;

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
          collapseWhitespace: false,
          minifyCSS: false,
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
  statistic: true,
  autoupdate: true,
  pathLog: "./log/lib/compress-images"
};

// Engine for compressing jpeg/png and options compress.
const engineJPEGOptions = {
  jpg: {
    engine: "jpegtran",
    command: ['-trim', '-progressive', '-copy', 'none', '-optimize']
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
      {png: {engine: 'pngquant', command: ['--quality=50-80']}},
      {svg: {engine: 'svgo', command: ['--multipass']}},
      {
        gif: {
          engine: 'giflossy',
          command: false
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
                  command: ["--quality", "high", "--min", "80"]
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
  return del([".tmp", "dist"]);
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
      height: 800,
      target: {
        css: 'dist/critical2.css',
        html: 'dist/critical2.html',
        uncritical: 'dist/uncritical2.css',
      },
      extract: true,
      minify: true,
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
    fonts,
    extras
  ),
  measureSize
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
    parallel(styles, scripts),
    startAppServer
  );
} else if (isProd) {
  serve = series(build, startDistServer);
}

exports.compress = compressImages;
exports.critical = criticalPath;
exports.serve = serve;
exports.build = build;
exports.clean = clean;
exports.default = build;
