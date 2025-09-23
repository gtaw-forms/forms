Overview
This documentation provides all the details required to integrate with our OAuth API. It covers the complete authentication flow, how to exchange an authorization code for an access token, and how to access protected API endpoints.

OAuth Flow
Redirect the User: Direct your user to the authorization endpoint with the following URL:
https://ucp.gta.world/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK_URL&response_type=code&scope=
client_id: Your Client ID.
redirect_uri: The callback URL where the user is redirected after authentication.
response_type: Must always be code.
scope: Optional (can be left empty).
User Authentication: Once the user authenticates, they will be redirected back to your callback URL with a code query parameter.
Exchange Code for Token: Send a POST request to the token endpoint to exchange the authorization code for an access token.
POST https://ucp.gta.world/oauth/token
Parameters:
  grant_type=authorization_code
  client_id=YOUR_CLIENT_ID
  client_secret=YOUR_CLIENT_SECRET
  redirect_uri=YOUR_CALLBACK_URL
  code=AUTHORIZATION_CODE
Access Protected Resources: Use the access token to call the API by including it in the Authorization header as a Bearer token.
GET /api/user HTTP/1.1
Host: ucp.gta.world
Authorization: Bearer YOUR_ACCESS_TOKEN
Endpoints
Endpoint	Method	Description
https://ucp.gta.world/oauth/authorize	GET	Redirect user for authentication.
https://ucp.gta.world/oauth/token	POST	Exchange authorization code for an access token.
https://ucp.gta.world/api/user	GET	Access protected user data.
CURL Examples
1. Requesting an Access Token
curl -X POST https://ucp.gta.world/oauth/token \
  -d 'grant_type=authorization_code' \
  -d 'client_id=YOUR_CLIENT_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'redirect_uri=https://your-domain.com/auth/callback' \
  -d 'code=YOUR_AUTHORIZATION_CODE'
2. Accessing User Data
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://ucp.gta.world/api/user
PHP Examples
1. Requesting an Access Token (cURL)
<?php
// Define the token URL and parameters
$tokenUrl = 'https://ucp.gta.world/oauth/token';
$postData = [
    'grant_type'    => 'authorization_code',
    'client_id'     => 'YOUR_CLIENT_ID',
    'client_secret' => 'YOUR_CLIENT_SECRET',
    'redirect_uri'  => 'https://your-domain.com/auth/callback',
    'code'          => 'YOUR_AUTHORIZATION_CODE'
];

// Initialize cURL session
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $tokenUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if(curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
}
curl_close($ch);

// Decode and output the token response
$tokenData = json_decode($response, true);
print_r($tokenData);
?>
2. Accessing User Data (cURL)
<?php
// Set your access token and user endpoint URL
$accessToken = 'YOUR_ACCESS_TOKEN';
$userUrl = 'https://ucp.gta.world/api/user';

// Setup headers including the Authorization header
$headers = [
    "Authorization: Bearer $accessToken"
];

// Initialize cURL session
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $userUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
if(curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
}
curl_close($ch);

// Decode and output the user data response
$userData = json_decode($response, true);
print_r($userData);
?>
3. Requesting an Access Token (GuzzleHttp)
<?php
require 'vendor/autoload.php';

use GuzzleHttp\Client;

$client = new Client();
$response = $client->request('POST', 'https://ucp.gta.world/oauth/token', [
    'form_params' => [
        'grant_type'    => 'authorization_code',
        'client_id'     => 'YOUR_CLIENT_ID',
        'client_secret' => 'YOUR_CLIENT_SECRET',
        'redirect_uri'  => 'https://your-domain.com/auth/callback',
        'code'          => 'YOUR_AUTHORIZATION_CODE'
    ]
]);

$body = $response->getBody();
$data = json_decode($body, true);
print_r($data);
?>
Node.js Examples
1. Requesting an Access Token (Axios)
const axios = require('axios');

async function getAccessToken() {
  try {
    const response = await axios.post('https://ucp.gta.world/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: 'YOUR_CLIENT_ID',
        client_secret: 'YOUR_CLIENT_SECRET',
        redirect_uri: 'https://your-domain.com/auth/callback',
        code: 'YOUR_AUTHORIZATION_CODE'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}

getAccessToken();
2. Accessing User Data (Axios)
const axios = require('axios');

async function getUserData() {
  try {
    const response = await axios.get('https://ucp.gta.world/api/user', {
      headers: {
        Authorization: 'Bearer YOUR_ACCESS_TOKEN'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}

getUserData();
Python Examples
1. Requesting an Access Token (Requests)
import requests

url = "https://ucp.gta.world/oauth/token"
payload = {
    "grant_type": "authorization_code",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "https://your-domain.com/auth/callback",
    "code": "YOUR_AUTHORIZATION_CODE"
}

response = requests.post(url, data=payload)
print(response.json())
2. Accessing User Data (Requests)
import requests

url = "https://ucp.gta.world/api/user"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}

response = requests.get(url, headers=headers)
print(response.json())
Example Response
The following is an example response from the /api/user endpoint:


{
  "user": {
    "id": 1,
    "username": "TestUser",
    "confirmed": 1,
    "role": {
      "id": 585,
      "user_id": 1,
      "role_id": "Manager",
      "server": 0
    },
    "character": [
      {
        "id": 425345,
        "memberid": 1,
        "firstname": "Testttt",
        "lastname": "Testiti"
      },
      {
        "id": 5442345,
        "memberid": 1,
        "firstname": "Johnny",
        "lastname": "Parker"
      },
      {
        "id": 24523534,
        "memberid": 1,
        "firstname": "Lester",
        "lastname": "Dawson"
      },
      {
        "id": 9355356,
        "memberid": 1,
        "firstname": "Angela",
        "lastname": "Rosetti"
      },
      {
        "id": 64364344,
        "memberid": 1,
        "firstname": "Justin",
        "lastname": "Sanderson"
      },
      {
        "id": 5436635,
        "memberid": 1,
        "firstname": "Spencer",
        "lastname": "Simon"
      },
      {
        "id": 1235162,
        "memberid": 1,
        "firstname": "Richard",
        "lastname": "Watts"
      }
    ]
  }
}
      
© 2025 GTA World. All Rights Reserved.

