const fs = require('fs');
const path = require('path');
const { runCommand, switchGitRemote } = require('./git-utils');

const REMOTE_NAME = 'origin';
const URL_1 = 'https://github.com/gtaw-forms/forms.git';
const URL_2 = 'https://github.com/fr0styJS/phmc-code-archive.git';
const URL_3 = 'https://github.com/Ancad-Studios/phmc-tools.git';
const DEPLOY_COMMAND = 'npm run build';

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../package.json');

function updatePackageJsonHomepage(newHomepageUrl) {
    console.log(`Updating homepage in package.json to: ${newHomepageUrl}`);
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    packageJson.homepage = newHomepageUrl;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('package.json homepage updated.');
}

async function orchestrateDeploy() {
    console.log('Starting orchestrated deployment...');

    // Deploy to URL 1
    console.log(`\n--- Deploying to ${URL_1} ---`);
    updatePackageJsonHomepage('https://gtaw-forms.github.io/forms/');
    switchGitRemote(REMOTE_NAME, URL_1);
    runCommand(DEPLOY_COMMAND); // This runs 'npm run build'
    runCommand(`gh-pages -d build --repo ${URL_1}`); // Corrected: using backticks
    console.log(`Deployment to ${URL_1} complete.`);

    // Deploy to URL 2
    console.log(`\n--- Deploying to ${URL_2} ---`);
    updatePackageJsonHomepage('https://fr0styJS.github.io/phmc-code-archive/');
    switchGitRemote(REMOTE_NAME, URL_2);
    runCommand(DEPLOY_COMMAND); // This runs 'npm run build'
    runCommand(`gh-pages -d build --repo ${URL_2}`); // Already correct
    console.log(`Deployment to ${URL_2} complete.`);

    // Deploy to URL 3
    console.log(`\n--- Deploying to ${URL_3} ---`);
    updatePackageJsonHomepage('https://phmc-tools.gta.world/');
    switchGitRemote(REMOTE_NAME, URL_3);
    runCommand(DEPLOY_COMMAND); // This runs 'npm run build'
    runCommand(`gh-pages -d build --repo ${URL_3}`); // Already correct
    console.log(`Deployment to ${URL_3} complete.`);

    console.log('Orchestrated deployment finished.');
}

orchestrateDeploy();
