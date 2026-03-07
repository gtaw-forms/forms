#!/bin/bash

# Faction Data Fetcher (Automated with curl)

# --- INSTRUCTIONS ---
# 1. Open your web browser and log in to the GTA World UCP.
# 2. Open the Developer Tools (usually by pressing F12).
# 3. Go to the "Network" tab.
# 4. Refresh the UCP page or navigate around to see the list of web requests.
# 5. Find any request made to the "ucp.gta.world" domain. Click on it.
# 6. In the panel that appears, find the "Request Headers" section.
# 7. Find the "cookie" header, right-click its value, and select "Copy value".
# 8. Paste the entire copied string into the `UCP_COOKIE` variable below, replacing the placeholder text.

# --- CONFIGURATION ---
UCP_COOKIE="PASTE_YOUR_BROWSER_COOKIE_STRING_HERE"

# The URL to fetch the faction data from
URL="https://ucp.gta.world/view/faction/364/populate?draw=2&columns[0][data]=actions&columns[0][name]=actions&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=characters.id&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=name&columns[2][name]=name&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=rank&columns[3][name]=rank&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=scriptrank&columns[4][name]=scriptrank&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=lastduty&columns[5][name]=lastduty&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=lastonline&columns[6][name]=lastonline&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=abas&columns[7][name]=abas&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&order[0][column]=3&order[0][dir]=desc&start=0&length=1000&search[value]=&search[regex]=false&type=members&filters=&searchTerm="

# The path to your Downloads folder and the desired filename
# This uses a standard Windows environment variable to find your Downloads folder.
DOWNLOADS_PATH="$USERPROFILE/Downloads"
OUTPUT_FILE="$DOWNLOADS_PATH/faction_data.json"

# --- EXECUTION ---
if [[ "$UCP_COOKIE" == "PASTE_YOUR_BROWSER_COOKIE_STRING_HERE" ]]; then
  echo -e "\e[31mError: Please edit this script and replace the placeholder with your UCP cookie.\e[0m"
  exit 1
fi

echo "Downloading faction data to $OUTPUT_FILE..."

# Use curl to download the data
# -s: Silent mode (don't show progress meter)
# -S: Show error message if it fails
# -H "Cookie: ...": Pass the authentication cookie
# -o: Output file
curl -sS -H "Cookie: $UCP_COOKIE" -o "$OUTPUT_FILE" "$URL"

# Check if curl was successful
if [ $? -eq 0 ]; then
  echo -e "\e[32mSuccessfully downloaded faction data to $OUTPUT_FILE\e[0m"
  # Check if the file contains an error (e.g., if the cookie is invalid)
  if grep -q "You need to sign in or sign up before continuing." "$OUTPUT_FILE"; then
    echo -e "\e[31mError: The downloaded file indicates you are not logged in. Your cookie may be invalid or expired.\e[0m"
    rm "$OUTPUT_FILE"
  fi
else
  echo -e "\e[31mError: Failed to download faction data.\e[0m"
fi
