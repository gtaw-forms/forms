const { execSync } = require('child_process');

function runCommand(command) {
    try {
        console.log(`Executing: ${command}`);
        const output = execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
        return output;
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
        runCommand(`git remote get-url ${remoteName}`);
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
        console.warn(`Could not set upstream for branch '${branchName}'. You might need to do this manually if it's a new branch.`);
    }

    console.log('Git remote switch complete.');
    runCommand('git remote -v'); // Verify remotes
}

// Parse command line arguments
const args = process.argv.slice(2); // Skip 'node' and script name

if (args.length < 2 || args.length > 3) {
    console.log('Usage: node switch-git-remote.js <remoteName> <remoteUrl> [branchName]');
    console.log('Example: node switch-git-remote.js origin https://github.com/user/repo.git main');
    process.exit(1);
}

const remoteName = args[0];
const remoteUrl = args[1];
const branchName = args[2] || 'main'; // Default to 'main' if not provided

switchGitRemote(remoteName, remoteUrl, branchName);
