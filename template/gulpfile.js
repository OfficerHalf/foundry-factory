const { rollup } = require('rollup');
const argv = require('yargs').argv;
const chalk = require('chalk');
const fs = require('fs-extra');
const gulp = require('gulp');
const path = require('path');
const rollupConfig = require('./rollup.config');
const semver = require('semver');

// TODO: Conditional on template parameter
const cssPreProcessor = require('gulp-sass');
sass.compiler = require('sass');
// const cssPreProcessor = require('gulp-less');

/********************/
/*  CONFIGURATION   */
/********************/

const name = path.basename(path.resolve('.'));
const sourceDirectory = 'src';
const distDirectory = 'dist';
const stylesDirectory = path.join(sourceDirectory, 'styles');
const stylesExtension = '.scss'; // TODO: Template parameter
const sourceFileExtension = '.ts'; // TODO: Template parameter
const staticFiles = ['assets', 'fonts', 'lang', 'packs', 'templates', 'module.json', 'system.json', 'template.json'];
const getDownloadURL = (version) => `https://host/path/to/${version}.zip`;

/********************/
/*      BUILD       */
/********************/

/**
 * Build the distributable JavaScript code
 */
async function buildCode() {
    const build = await rollup({ input: rollupConfig.input, plugins: rollupConfig.plugins });
    return build.write(rollupConfig.output);
}

/**
 * Build style sheets
 */
function buildStyles() {
    return gulp
        .src(path.join(stylesDirectory, `${name}${stylesExtension}`))
        .pipe(cssPreProcessor().on('error', sass.logError)) // TODO: Insert as template parameter
        .pipe(gulp.dest(path.join(distDirectory, 'css')));
}

/**
 * Copy static files
 */
async function copyFiles() {
    for (const file of staticFiles) {
        if (fs.existsSync(path.join(sourceDirectory, file))) {
            await fs.copy(path.join(sourceDirectory, file), path.join(distDirectory, file));
        }
    }
}

/**
 * Watch for changes for each build step
 */
function buildWatch() {
    gulp.watch(path.join(sourceDirectory, '**', sourceFileExtension), { ignoreInitial: false }, buildCode);
    gulp.watch(path.join(stylesDirectory, '**', `*.${stylesExtension}`), { ignoreInitial: false }, buildStyles);
    gulp.watch(
        staticFiles.map((file) => path.join(sourceDirectory, file)),
        { ignoreInitial: false },
        copyFiles,
    );
}

/********************/
/*      CLEAN       */
/********************/

/**
 * Remove built files from `dist` folder while ignoring source files
 */
async function clean() {
    const files = [...staticFiles, 'module'];

    if (fs.existsSync(path.join(stylesDirectory, `${name}${stylesExtension}`))) {
        files.push('css');
    }

    console.log(' ', chalk.yellow('Files to clean:'));
    console.log('   ', chalk.blueBright(files.join('\n    ')));

    for (const filePath of files) {
        await fs.remove(path.join(distDirectory, filePath));
    }
}

/********************/
/*       LINK       */
/********************/

/**
 * Get the data path of Foundry VTT based on what is configured in `foundryconfig.json`
 */
async function getDataPath() {
    const config = fs.readJSONSync('foundryconfig.json');

    if (config?.dataPath) {
        if (!fs.existsSync(path.join(config.dataPath, 'Data'))) {
            throw new Error('User Data path invalid, no Data directory found');
        }

        return path.join(config.dataPath, 'Data');
    } else {
        throw new Error('No User Data path defined in foundryconfig.json');
    }
}

/**
 * Link build to User Data folder
 */
async function linkUserData() {
    let destinationDirectory;
    if (fs.existsSync(path.resolve('.', sourceDirectory, 'module.json'))) {
        destinationDirectory = 'modules';
    } else if (fs.existsSync(path.resolve('.', sourceDirectory, 'system.json'))) {
        destinationDirectory = 'systems';
    } else {
        throw new Error(`Could not find ${chalk.blueBright('module.json')} or ${chalk.blueBright('system.json')}`);
    }

    const linkDirectory = path.join(await getDataPath(), destinationDirectory, name);

    if (argv.clean || argv.c) {
        console.log(chalk.yellow(`Removing build in ${chalk.blueBright(linkDirectory)}.`));

        await fs.remove(linkDirectory);
    } else if (!fs.existsSync(linkDirectory)) {
        console.log(chalk.green(`Copying build to ${chalk.blueBright(linkDirectory)}.`));
        await fs.symlink(path.resolve('.', distDirectory), linkDirectory);
    }
}

/********************/
/*    VERSIONING    */
/********************/

/**
 * Get the contents of the manifest file as object.
 */
function getManifest() {
    const modulePath = path.join(sourceDirectory, 'module.json');
    const systemPath = path.join(sourceDirectory, 'system.json');

    if (fs.existsSync(modulePath)) {
        return {
            file: fs.readJSONSync(modulePath),
            name: 'module.json',
        };
    } else if (fs.existsSync(systemPath)) {
        return {
            file: fs.readJSONSync(systemPath),
            name: 'system.json',
        };
    }
}

/**
 * Get the target version based on on the current version and the argument passed as release.
 */
function getTargetVersion(currentVersion, release) {
    if (['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(release)) {
        return semver.inc(currentVersion, release);
    } else {
        return semver.valid(release);
    }
}

/**
 * Update version and download URL.
 */
function bumpVersion(cb) {
    const packageJson = fs.readJSONSync('package.json');
    const packageLockJson = fs.existsSync('package-lock.json') ? fs.readJSONSync('package-lock.json') : undefined;
    const manifest = getManifest();

    if (!manifest) cb(Error(chalk.red('Manifest JSON not found')));

    try {
        const release = argv.release || argv.u;

        const currentVersion = packageJson.version;

        if (!release) {
            return cb(Error('Missing release type'));
        }

        const targetVersion = getTargetVersion(currentVersion, release);

        if (!targetVersion) {
            return cb(new Error(chalk.red('Error: Incorrect version arguments')));
        }

        if (targetVersion === currentVersion) {
            return cb(new Error(chalk.red('Error: Target version is identical to current version')));
        }

        console.log(`Updating version number to '${targetVersion}'`);

        packageJson.version = targetVersion;
        fs.writeJSONSync('package.json', packageJson, { spaces: 4 });

        if (packageLockJson) {
            packageLockJson.version = targetVersion;
            fs.writeJSONSync('package-lock.json', packageLockJson, { spaces: 4 });
        }

        manifest.file.version = targetVersion;
        manifest.file.download = getDownloadURL(targetVersion);
        fs.writeJSONSync(path.join(sourceDirectory, manifest.name), manifest.file, { spaces: 4 });

        return cb();
    } catch (err) {
        cb(err);
    }
}

const execBuild = gulp.parallel(buildCode, buildSASS, buildLess, copyFiles);

exports.build = gulp.series(clean, execBuild);
exports.watch = buildWatch;
exports.clean = clean;
exports.link = linkUserData;
exports.bumpVersion = bumpVersion;