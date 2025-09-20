const { execSync } = require('child_process');

function runCommand(command) {
    try {
        console.log(`Executing: ${command}`);
        // Use stdio: 'inherit' to show command output in real-time
        execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

function switchGitRemote(remoteName, remoteUrl, branchName = 'main') {
    console.log(`Attempting to switch remote '${remoteName}' to '${remoteUrl}' for branch '${branchName}'`);

    // Check if remote exists
    try {
        execSync(`git remote get-url ${remoteName}`, { stdio: 'pipe' }); // Use pipe to suppress output
        console.log(`Remote '${remoteName}' already exists. Removing it...`);
        runCommand(`git remote remove ${remoteName}`);
    } catch (error) {
        // Remote does not exist, which is fine.
        console.log(`Remote '${remoteName}' does not exist. Proceeding to add.`);
    }

    // Add the new remote
    runCommand(`git remote add ${remoteName} ${remoteUrl}`);
    console.log(`Remote '${remoteName}' added with URL '${remoteUrl}'.`);

    // Set upstream branch
    try {
        runCommand(`git branch --set-upstream-to=${remoteName}/${branchName} ${branchName}`);
        console.log(`Branch '${branchName}' is now tracking '${remoteName}/${branchName}'.`);
    } catch (error) {
        console.warn(`Could not set upstream for branch '${branchName}'. You might need to do this manually if it's a new branch or if the remote branch doesn't exist yet.`);
    }

    console.log('Git remote switch complete.');
    runCommand('git remote -v'); // Verify remotes
}

module.exports = {
    runCommand,
    switchGitRemote
};
