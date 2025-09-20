const { runCommand, switchGitRemote } = require('./git-utils');

const REMOTE_NAME = 'origin'; // Assuming 'origin' is the remote you want to switch
const URL_1 = 'https://github.com/gtaw-forms/forms.git';
const URL_2 = 'https://github.com/fr0styJS/phmc-code-archive.git';
const DEPLOY_COMMAND = 'npm run build'; // The actual deployment command

async function orchestrateDeploy() {
    console.log('Starting orchestrated deployment...');

    // Deploy to URL 1
    console.log(`\n--- Deploying to ${URL_1} ---`);
    switchGitRemote(REMOTE_NAME, URL_1);
    runCommand(DEPLOY_COMMAND);
    runCommand('git add .');
    const statusOutput1 = runCommand('git status --porcelain', true).trim(); // Pass true to return output
    if (statusOutput1) {
        runCommand('git commit -m "Staging"');
        runCommand('git push origin source');
    } else {
        console.log('No changes to commit for URL 1. Skipping commit and push.');
    }
    console.log(`Deployment to ${URL_1} complete.`);

    // Deploy to URL 2
    console.log(`\n--- Deploying to ${URL_2} ---`);
    switchGitRemote(REMOTE_NAME, URL_2);
    runCommand(DEPLOY_COMMAND);
    runCommand('git add .');
    const statusOutput2 = runCommand('git status --porcelain', true).trim(); // Pass true to return output
    if (statusOutput2) {
        runCommand('git commit -m "Staging"');
        runCommand('git push origin source');
    } else {
        console.log('No changes to commit for URL 2. Skipping commit and push.');
    }
    console.log('Orchestrated deployment finished.');
}

orchestrateDeploy();