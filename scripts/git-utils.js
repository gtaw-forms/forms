const { execSync } = require('child_process');

function runCommand(command) {
    try {
        console.log(`Executing: ${command}`);
        // Capture output to check for specific error messages
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(output); // Print the output if successful
    } catch (error) {
        const errorMessage = error.message;
        // Check for "nothing to commit" error from git
        if (command.includes('git commit') && errorMessage.includes('nothing to commit, working tree clean')) {
            console.warn(`Warning: ${command} - ${errorMessage.trim()}`);
            console.warn('Proceeding as there were no changes to commit.');
            return; // Do not exit the process
        }
        console.error(`Error executing command: ${command}`);
        console.error(errorMessage);
        process.exit(1); // Exit for other errors
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
