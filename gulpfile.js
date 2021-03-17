let distFolder = require("path").basename(__dirname);
let srcFolder = "src";
let fs = require('fs'); //переменная fileSystem для подключения

let path = {
    build: {
        html: distFolder + "/",
        css: distFolder + "/css/",
        js: distFolder + "/js/",
        img: distFolder + "/img/",
        fonts: distFolder + "/fonts/",
    },
    src: {
        html: [srcFolder + "/views/*.html", "!" + srcFolder + "/_*.html"], //отслеживаем все файлы html, кроме тех, что начинаются с _ (пример: _header.html)
        css: srcFolder + "/scss/style.scss",
        js: srcFolder + "/js/script.js",
        img: srcFolder + "/img/**/*.*",
        fonts: srcFolder + "/fonts/*.{ttf, woff, woff2}",
    },
    watch: {
        html: srcFolder + "/**/*.html",
        css: srcFolder + "/scss/**/*.scss",
        js: srcFolder + "/js/**/*.js",
        img: srcFolder + "/img/**/*.*",
        fonts: srcFolder + "/fonts/*.{ttf, woff, woff2}",
    },
    clean: "./" + distFolder + "/"
};

//Это нужно установить. Переменные для плагинов 
let {
    src,
    dest
} = require('gulp'),
    gulp = require('gulp'),
    browsersync = require("browser-sync").create(), //автообновление при изменении
    fileinclude = require("gulp-file-include"), //include в файлы, например в  html бэм-блоки
    del = require("del"), //чистим папку dist при новом запуске Gulp
    scss = require("gulp-sass"),
    autoprefixer = require("gulp-autoprefixer"),
    group_media = require('gulp-group-css-media-queries'), //в css собирает все media Запросы и группирует их и переносит в конец файла их
    cleanCSS = require('gulp-clean-css'), //чистит и сжимает css, чтобы читать легко было - надо отключить
    rename = require("gulp-rename"), //переименовывает итоговые файлы в тех тасках где указан был
    uglify = require('gulp-uglify-es').default, //сжимает js файлы    
    babel = require("gulp-babel"), //конвертация js в es6
    webpack = require('webpack-stream'),
    imagemin = require('gulp-imagemin'),
    webp = require('gulp-webp'), // для конвертирования формата картинок в .webp
    webphtml = require('gulp-webp-html'),
    svgSprite = require("gulp-svg-sprite"), //собирает svg из указаной папки в спрайты
    ttf2woff = require("gulp-ttf2woff"), //конвертирует шрифты ttf в woff
    ttf2woff2 = require("gulp-ttf2woff2"), //конвертирует шрифты ttf в woff2
    fonter = require("gulp-fonter"); //конвертирует шрифт otf в woff


//обновление в браузере BrowserSync
function browserSync(params) {
    browsersync.init({
        server: {
            baseDir: "./" + distFolder + "/"
        },
        port: 3000,
        notify: false,
    })
};

//Отслеживание изменений html, сборка файлов
function html() {
    return src(path.src.html)
        .pipe(fileinclude())
        .pipe(webphtml()) //отключить, чтобы не вставлялись webp картинки
        .pipe(dest(path.build.html))
        .pipe(browsersync.stream())
};

//css task
function css() {
    return src(path.src.css)
        .pipe(
            scss({
                outputStyle: "expanded" //сжатый компилируется
            }))
        .pipe(group_media())
        .pipe(
            autoprefixer({
                overrideBrowserslist: ["last 5 versions"],
                cascade: true
            }))
        .pipe(dest(path.build.css)) //создаем версию css обычную - file.css
        .pipe(cleanCSS()) //сжимаем file.css
        .pipe(
            rename({
                extname: ".min.css"
            })
        )
        .pipe(dest(path.build.css)) //создаем сжатую версию file.min.css
        .pipe(browsersync.stream())
}


//js task
function js() {
    // webpackConfig - конфиг webpack + babel
    let webpackConfig = {
        output: {
            filename: 'script.js'
        },
        watch: true,
        mode: 'production',
        optimization: {
            minimize: false
        },
        module: {
            rules: [{
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: '/node_modules'
            }]
        },
    };
    //конец настройки webpack
    return src(path.src.js)
        .pipe(babel())
        .pipe(webpack(webpackConfig))
        .pipe(dest(path.build.js))
        .pipe(uglify())
        .pipe(
            rename({
                extname: ".min.js"
            })
        )
        .pipe(dest(path.build.js))
        .pipe(browsersync.stream())
};

//конвертация картинок в рабочий проект с webp форматом
function images() {
    return src(path.src.img)
        .pipe(
            webp({
                quality: 70
            })
        )
        .pipe(dest(path.build.img))
        .pipe(src(path.src.img))
        .pipe(
            imagemin({
                progressive: true,
                svgoPlugins: [{
                    removeViewBox: false
                }],
                interlaced: true,
                optimizationLevel: 3 //0 to 7
            })
        )
        .pipe(dest(path.build.img))
        .pipe(browsersync.stream())
};

function fontsStyle(params) {
    let file_content = fs.readFileSync(srcFolder + '/scss/fonts.scss');
    if (file_content == '') {
        fs.writeFile(srcFolder + '/scss/fonts.scss', '', cb);
        return fs.readdir(path.build.fonts, function (err, items) {
            if (items) {
                let c_fontname;
                for (var i = 0; i < items.length; i++) {
                    let fontname = items[i].split('.');
                    fontname = fontname[0];
                    if (c_fontname != fontname) {
                        fs.appendFile(srcFolder + '/scss/fonts.scss', '@include font("' + fontname + '", "' + fontname + '", "400", "normal");\r\n', cb);
                    }
                    c_fontname = fontname;
                }
            }
        })
    }
};

function cb() { };

//отслеживание файлов
function watchFiles(params) {
    gulp.watch([path.watch.html], html);
    gulp.watch([path.watch.css, './src/blocks/**/*.scss'], css);
    gulp.watch([path.watch.js], js);
    gulp.watch([path.watch.img], images);
}

//создание спрайтов svg из папки src/img/iconsprite/
gulp.task('svgSprite', function () {
    return gulp.src([srcFolder + '/img/iconsprite/*.svg'])
        .pipe(
            svgSprite({
                mode: {
                    css: { //  Активируем режим «css»  
                        render: {
                            css: true //  Активировать вывод CSS (с параметрами по умолчанию)  
                        }
                    },
                    stack: {
                        sprite: "../icons/icons.svg", //sprite file name
                        example: true //создаёт пример html файла со спрайтом, чтобы моно было просматривать его отдельно
                    }
                    
                }
            })
        )
        .pipe(dest(path.build.img))
})

function fonts(params) {
    src(path.src.fonts)
        .pipe(ttf2woff())
        .pipe(dest(path.build.fonts));
    return src(path.src.fonts)
        .pipe(ttf2woff2())
        .pipe(dest(path.build.fonts));
}

//удаляет папку dist
function clean(params) {
    return del(path.clean)
}

//Таски
gulp.task('otf2ttf', function () {
    return src([srcFolder + '/fonts/*.otf'])
        .pipe(fonter({
            formats: ['ttf']
        }))
        .pipe(dest(srcFolder + '/fonts/'))
});

let build = gulp.series(clean, gulp.parallel(js, css, html, images, fonts), fontsStyle);
let watch = gulp.parallel(build, watchFiles, browserSync);


exports.fontsStyle = fontsStyle;
exports.fonts = fonts;
exports.images = images;
exports.js = js;
exports.css = css;
exports.html = html;
exports.build = build;
exports.watch = watch;
exports.default = watch;