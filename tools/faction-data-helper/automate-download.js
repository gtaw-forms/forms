// Playwright script for fully automated faction data download.
const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const AUTH_STATE_FILE = path.join(__dirname, 'ucp-auth-state.json');
const UCP_LOGIN_URL = 'https://ucp.gta.world/login';
const FACTION_DATA_URL = "https://ucp.gta.world/view/faction/364/populate?draw=2&columns[0][data]=actions&columns[0][name]=actions&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=characters.id&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=name&columns[2][name]=name&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=rank&columns[3][name]=rank&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=scriptrank&columns[4][name]=scriptrank&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=lastduty&columns[5][name]=lastduty&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=lastonline&columns[6][name]=lastonline&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=abas&columns[7][name]=abas&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&order[0][column]=3&order[0][dir]=desc&start=0&length=1000&search[value]=&search[regex]=false&type=members&filters=&searchTerm=";
const DOWNLOADS_PATH = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Downloads') : __dirname;
const OUTPUT_FILE = path.join(DOWNLOADS_PATH, 'faction_data.json');

(async () => {
    // Check if we have a saved authentication state.
    const hasAuthState = fs.existsSync(AUTH_STATE_FILE);
    
    // Launch Firefox. If we need to log in, launch it with a visible window.
    // Otherwise, we can consider running it headless for speed.
    const browser = await firefox.launch({ headless: hasAuthState });
    const context = await browser.newContext({ storageState: hasAuthState ? AUTH_STATE_FILE : undefined });
    const page = await context.newPage();

    console.log('--- Faction Data Downloader ---');

    // If we don't have an auth state, we need to perform the initial login.
    if (!hasAuthState) {
        console.log('\x1b[33m%s\x1b[0m', 'Authentication file not found. Please log in to the UCP.');
        console.log('The browser window will open. After you log in, this script will save your session for future runs.');
        
        await page.goto(UCP_LOGIN_URL);

        try {
            // A more robust way to detect login is to wait for an element
            // that only appears after a successful login. A "Logout" link is a great candidate.
            console.log('Waiting for you to complete the login process...');
            await page.locator('a:has-text("Logout")').waitFor({ timeout: 300000 });

            console.log('\x1b[32m%s\x1b[0m', 'Login successful! "Logout" link detected.');
            
            // Save the authentication state to the file.
            await context.storageState({ path: AUTH_STATE_FILE });
            console.log(`Authentication state saved to: ${AUTH_STATE_FILE}`);
            console.log('Future runs of this script will be fully automated.');
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', 'Login failed or timed out. If you logged in successfully and still see this, the detection logic may need adjustment.');
            await browser.close();
            return;
        }
    } else {
        console.log('Authentication state found. Proceeding with automated download.');
    }

    // Now, navigate to the faction data URL to get the content.
    console.log('Fetching faction data...');
    try {
        await page.goto(FACTION_DATA_URL);

        // The JSON content is typically inside a <pre> tag in the browser's JSON viewer.
        const jsonContent = await page.locator('pre').innerText();
        
        fs.writeFileSync(OUTPUT_FILE, jsonContent, 'utf-8');
        console.log('\x1b[32m%s\x1b[0m', `Successfully downloaded and saved faction data to: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to fetch faction data: ${error.message}`);
        console.error('Your saved authentication might be expired. Please delete the following file and run the script again to re-authenticate:');
        console.error(AUTH_STATE_FILE);
    } finally {
        await browser.close();
    }
})();
