# Automation Scripts

This directory contains helper scripts for automating common development and administrative tasks.

## `update-database.js` (End-to-End Faction Data Update)

This is the primary script for fully automating the process of updating the faction member database. It performs a two-part process:

1.  **Downloads** the latest faction member data from the GTA World User Control Panel (UCP).
2.  **Uploads** that data directly to the Forms application database.

### How it Works

The script uses the Playwright browser automation framework. It requires a separate one-time interactive login for **both** the UCP and the Forms application. After the initial setup, it saves your authenticated sessions and runs the entire process in the background.

### Setup & Usage

1.  **Install Dependencies**: If you haven't already, open your terminal at the project root and run:
    ```bash
    npm install
    ```
2.  **Run the Script**: From the project root, execute the script:
    ```bash
    node tools/update-database.js
    ```

### First-Time Run

The first time you run the script, you will be prompted to log in twice:

1.  **UCP Login**: A browser will open for you to log in to the UCP. Once you're logged in, the script will save your session to `tools/faction-data-helper/ucp-auth-state.json`.
2.  **Forms App Login**: A second browser will open for you to log in to the `gtaw-forms` application (via OAuth). Once logged in, the script will save this session to `tools/forms-auth-state.json`.

After these two one-time logins, the script will complete the download and upload process.

### Subsequent Runs

On all future runs, the script will be fully automated and run in the background (headless). Simply execute `node tools/update-database.js`.

### Troubleshooting

If the script fails with an authentication error for either the UCP or the Forms App, the corresponding saved session has likely expired. To fix this:

*   **For UCP errors**: Delete `tools/faction-data-helper/ucp-auth-state.json`.
*   **For Forms App errors**: Delete `tools/forms-auth-state.json`.

The next time you run the script, you will be prompted to log in again for the site whose auth file you deleted.
