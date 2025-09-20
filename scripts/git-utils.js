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

function switchGitRemote(remoteName, remoteUrl, branchName = 'source') {
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

    // Fetch to ensure we have the latest remote branches
    runCommand(`git fetch ${remoteName}`);

    // Set upstream branch
    try {
        runCommand(`git branch --set-upstream-to=${remoteName}/${branchName} ${branchName}`);
        console.log(`Branch '${branchName}' is now tracking '${remoteName}/${branchName}'.`);
    } catch (error) {
        console.warn(`Could not set upstream for branch '${branchName}'. Attempting to push and set upstream...`);
        // If setting upstream fails, it might be because the remote branch doesn't exist.
        // Try to push the branch and set upstream in one go.
        try {
            runCommand(`git push -u ${remoteName} ${branchName}`);
            console.log(`Successfully pushed and set upstream for branch '${branchName}'.`);
        } catch (pushError) {
            console.error(`Failed to push and set upstream for branch '${branchName}'.`);
            console.error(pushError.message);
            process.exit(1);
        }
    }

    console.log('Git remote switch complete.');
    runCommand('git remote -v'); // Verify remotes
}

module.exports = {
    runCommand,
    switchGitRemote
};
