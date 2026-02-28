import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BUILD_DIR = 'build';
const REMOTE = 'origin';
const BRANCH = 'gh-pages';

console.log('🚀 Starting robust deployment...');

try {
    // 1. Build the project
    console.log('📦 Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    // 2. Initialize or verify the build folder as a git repo
    console.log('🔧 Preparing build folder...');
    if (!fs.existsSync(path.join(BUILD_DIR, '.git'))) {
        execSync('git init', { cwd: BUILD_DIR });
        execSync(`git remote add origin ${execSync('git remote get-url origin').toString().trim()}`, { cwd: BUILD_DIR });
    }

    // 3. Fetch latest gh-pages branch to stay in sync
    try {
        execSync(`git fetch ${REMOTE} ${BRANCH}`, { cwd: BUILD_DIR, stdio: 'ignore' });
        execSync(`git checkout ${BRANCH}`, { cwd: BUILD_DIR, stdio: 'ignore' });
    } catch (e) {
        console.log('ℹ️ Creating new gh-pages branch...');
        execSync(`git checkout -b ${BRANCH}`, { cwd: BUILD_DIR });
    }

    // 4. Deploy
    console.log('📤 Committing and Pushing (this may take a moment with many tiles)...');
    execSync('git add .', { cwd: BUILD_DIR });
    
    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { cwd: BUILD_DIR }).toString();
    if (status) {
        execSync('git commit -m "Deploy to GitHub Pages"', { cwd: BUILD_DIR });
        execSync(`git push ${REMOTE} ${BRANCH} --force`, { cwd: BUILD_DIR });
        console.log('✅ Deployment successful!');
    } else {
        console.log('✨ No changes to deploy.');
    }

} catch (error) {
    console.error('❌ Deployment failed:');
    console.error(error.message);
    process.exit(1);
}
