const argv = require('the-argv');
const arrify = require('arrify');
const execa = require('execa');
const hasYarn = require('has-yarn');
const minimist = require('minimist');
const path = require('path');
const pathExists = require('path-exists');
const readPkgUp = require('read-pkg-up');
const writePkg = require('write-pkg');

const PLURAL_OPTIONS = [
  'env',
  'global',
  'ignore'
];

const CONFIG_FILES = [
  '.eslintrc.js',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  '.eslintrc',
  '.jshintrc',
  '.jscsrc',
  '.jscs.json',
  '.jscs.yaml'
];

const warnConfigFile = packageCwd => {
  const files = CONFIG_FILES.filter(file => pathExists.sync(path.join(packageCwd, file)));

  if (files.length === 0) {
    return;
  }

  console.log(`${files.join(' & ')} can probably be deleted now that you're using XO.`);
};

module.exports = async (options = {}) => {
  const packageResult = readPkgUp.sync({
    cwd: options.cwd,
    normalize: false
  }) || {};
  const packageJson = packageResult.package || {};
  const packagePath = packageResult.path || path.resolve(options.cwd || '', 'package.json');
  const packageCwd = path.dirname(packagePath);

  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.pretest = 'xo';

  const cli = minimist(options.args || argv());
  delete cli._;

  for (const option of PLURAL_OPTIONS) {
    if (cli[option]) {
      cli[`${option}s`] = arrify(cli[option]);
      delete cli[option];
    }
  }

  packageJson.xo = { env: 'mocha', extends: 'semistandard', ...packageJson.xo, ...cli };

  writePkg.sync(packagePath, packageJson);

  const post = () => {
    warnConfigFile(packageCwd);
  };

  if (options.skipInstall) {
    post();
    return;
  }

  if (hasYarn(packageCwd)) {
    try {
      await execa('yarn', ['add', '--dev', '--ignore-workspace-root-check', 'xo'], { cwd: packageCwd });
      post();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error('This project uses Yarn but you don\'t seem to have Yarn installed.\nRun `npm install --global yarn` to install it.');
        return;
      }

      throw error;
    }

    return;
  }

  await execa('npm', ['uninstall', 'semistandard'], { cwd: packageCwd });
  await execa('npm', ['install', '--save-dev', 'eslint-config-semistandard', 'eslint-config-standard', 'eslint-plugin-standard'], { cwd: packageCwd });
  await execa('npm', ['install', '--save-dev', 'xo'], { cwd: packageCwd });
  post();
};
