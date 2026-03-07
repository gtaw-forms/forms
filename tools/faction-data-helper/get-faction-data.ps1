# Faction Data Fetcher for PHMC Forms

# Description:
# This script opens a web browser to the GTA World UCP page containing the
# faction member data. Due to login requirements, this script cannot automatically
# download the file.

# Instructions:
# 1. Run this script. It will open a new tab in your default web browser.
# 2. Make sure you are logged into the GTA World UCP in that browser.
# 3. The page will display JSON data.
# 4. Right-click on the page and select "Save As...".
# 5. Save the file as "faction_data.json" in your computer's "Downloads" folder.
# 6. Go back to the PHMC Forms application and upload this JSON file.

$url = "https://ucp.gta.world/view/faction/364/populate?draw=2&columns[0][data]=actions&columns[0][name]=actions&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=characters.id&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=name&columns[2][name]=name&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=rank&columns[3][name]=rank&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=scriptrank&columns[4][name]=scriptrank&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=lastduty&columns[5][name]=lastduty&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=lastonline&columns[6][name]=lastonline&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=abas&columns[7][name]=abas&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&order[0][column]=3&order[0][dir]=desc&start=0&length=1000&search[value]=&search[regex]=false&type=members&filters=&searchTerm="

Write-Host "Opening the UCP faction data page in your browser..."
Write-Host "Please follow the instructions in the script file to download the JSON data."

try {
    Start-Process -FilePath $url
} catch {
    Write-Error "Failed to open the URL. Please copy and paste the following URL into your browser:"
    Write-Error $url
}

