# Welcome to the Form Generator (PHMC)!

This repository has been re-written from the ground up for simplicity. I'm currently using some modules, namely Google Firebase to handle data storage.

## Project Structure

Here's an overview of the main directories and their purpose:

*   `public/`: Contains static assets like `index.html`, `favicon.ico`, and other files that are served directly by the web server without being processed by the build system.

*   `src/`: This is where the main React application source code resides. It's further organized into subdirectories:
    *   `src/assets/`: [LEGACY CODE STRUCTURE] Contains static assets such as images (`.png`, `.jpg`), fonts (`.otf`), and other media files used within the application, this area is no longer used and is a legacy thing as Firebase handles the Assets. 
    *   `src/components/admin`: Contains the Admin Panel functions and various buttons to handle Recruitment Statuses along with testing buttons to debug issues with upstream providers (Sentry or Firebase). 
    *   `src/components/`: Houses reusable React components that are shared across different parts of the application, like modals, buttons, and navigation elements.
    *   `src/contexts/`: Contains React Context API providers, which are used for managing global state and sharing data across components without prop-drilling.
    *   `src/phmc-bbcode-generators/`: Contains JavaScript modules responsible for generating BBCode output for various PHMC forms.
    *   `src/phmc-civilian-fields/`: Holds React components that define the specific input fields and logic for forms related to civilian interactions.
    *   `src/phmc-field-data/`: Contains React components that define the input fields and data structures for the main PHMC-specific forms.
    *   `src/phmc-recruitment-generators/`: Similar to `phmc-bbcode-generators`, but specifically for generating BBCode for recruitment-related forms.

*   `functions/`: This directory holds various daily Database Triggers to run essential functions, such as Bingo Rotations, cache clearing and to rotate API keys on a 31 day basis.

*   `migration-script-rtdb/`: Contains scripts specifically designed for migrating or transforming data within the Firebase Realtime Database (RTDB).


## Installation and Deployment Instructions

These instructions will guide you through forking the repository, setting it up locally, and deploying your own version to GitHub Pages.

### Step 1: Fork the Repository

1.  Navigate to the main GitHub repository page: [https://github.com/GTAW-PHMC/forms](https://github.com/GTAW-PHMC/forms)
2.  Click the **Fork** button in the top-right corner of the page. This will create a copy of the repository under your own GitHub account.

### Step 2: Clone Your Forked Repository

1.  On your forked repository's GitHub page, click the **Code** button.
2.  Copy the URL (either HTTPS or SSH).
3.  Open a terminal or command prompt on your local machine and run the following command, replacing `<your-fork-url>` with the URL you just copied:
    ```bash
    git clone <your-fork-url>
    ```
4.  Navigate into the newly created project directory:
    ```bash
    cd phmc-forms
    ```

### Step 3: Install Dependencies

Once you are in the project directory, install the necessary Node.js dependencies by running:

```bash
npm install
```

### Step 4: Configure for Deployment

This is a crucial step for deploying to your own GitHub Pages site.

1.  Open the `package.json` file in the root of the project.
2.  Locate the `"homepage"` field. It will originally look something like this:
    ```json
    "homepage": "https://gtaw-forms.github.io/forms/"
    ```
3.  You **must** change this URL to match your own GitHub username and the repository name. The format is `https://<your-username>.github.io/<your-repo-name>/`.
    *   For example, if your GitHub username is `john-doe` and your repository is named `phmc-forms`, you would change it to:
        ```json
        "homepage": "https://john-doe.github.io/phmc-forms/"
        ```
4.  Save the `package.json` file.

### Step 5: Deploy Your Application

After configuring the homepage, you can deploy the application by running the following command in your terminal:

```bash
npm run deploy
```

This command will first build the application for production and then publish the contents of the `build` folder to a new `gh-pages` branch in your repository. Your new site will be live at the URL you specified in the `homepage` field shortly after.

### Running Locally

If you want to run the application locally for development, you can use the start script:

```bash
npm start
```

This will open the application in your default web browser at `http://localhost:3000`.
