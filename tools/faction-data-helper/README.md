# Faction Data Helper Scripts

This directory contains scripts to simplify downloading the latest faction data from the GTA World User Control Panel (UCP). The recommended method is the fully automated Playwright script.

---

## **Recommended: `automate-download.js` (Fully Automated for OAuth)**

This script uses **Playwright** to control a Firefox browser, automating the download process after a one-time interactive authentication.

*   **Pros**: Fully automated after initial login. No manual downloading or cookie copying required for subsequent runs. This is the most secure and practical automation for an OAuth-based login.
*   **Cons**: Requires Node.js and a one-time installation of dependencies. The *initial* login to the external OAuth provider (GTA World) cannot be automated by this script due to the nature of OAuth security.

### One-Time Setup (Initial Authentication)

1.  **Install Dependencies**: Open your terminal or command prompt at the project root and run `npm install`. This will install Playwright and other necessary packages.
2.  **First Run (Interactive Login)**: Run the script for the first time from your terminal:
    ```bash
    node tools/faction-data-helper/automate-download.js
    ```
3.  A Firefox window will open and navigate to the UCP login page. **You must manually log in to the UCP** as you normally would (e.g., via OAuth with GTA World).
4.  Once you've successfully logged in and are redirected back to the main UCP dashboard (where a "Logout" link is visible), the script will automatically detect this, save your session information to a `ucp-auth-state.json` file in this directory, and then close the browser.

### Subsequent Runs

For all future runs, simply execute the same command in your terminal:

```bash
node tools/faction-data-helper/automate-download.js
```

The script will now run in the background (headless) using your saved authentication state and automatically save the `faction_data.json` file to your computer's **Downloads** folder. You can then upload this file to the PHMC Forms application.

**Troubleshooting**: If the script fails with an authentication error, your saved session has likely expired. Simply delete the `ucp-auth-state.json` file in this directory and run the script again to perform the one-time interactive login.

---

## Alternative Scripts (Less Automated)

These scripts are simpler but require more manual work for each download.

### `get-faction-data.sh` (Bash Script)

*   Requires manual copying of your browser cookie for every session.
*   See the instructions inside the script file for details.

### `get-faction-data.ps1` (PowerShell Script)

*   Opens the URL in your browser, requiring you to manually "Save As..." the file each time.
*   See the instructions inside the script file for details.
