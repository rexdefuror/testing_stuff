// public/renderer.js
const { ipcRenderer, shell } = require('electron');

// Global variable to hold the UserManager instance and access token.
let userManager = null;
let accessToken = null;

// Load stored configuration on page load.
document.addEventListener('DOMContentLoaded', () => {
  const storedAuthority = localStorage.getItem('oidc.authority');
  const storedClientId = localStorage.getItem('oidc.clientId');
  const storedClientSecret = localStorage.getItem('oidc.clientSecret');
  const storedRedirectUri = localStorage.getItem('oidc.redirectUri');
  const storedScope = localStorage.getItem('oidc.scope');

  if (storedAuthority) document.getElementById('authority').value = storedAuthority;
  if (storedClientId) document.getElementById('clientId').value = storedClientId;
  if (storedClientSecret) document.getElementById('clientSecret').value = storedClientSecret;
  if (storedRedirectUri) document.getElementById('redirectUri').value = storedRedirectUri;
  if (storedScope) document.getElementById('scope').value = storedScope;
});

document.getElementById('loginBtn').addEventListener('click', () => {
  let authority = document.getElementById('authority').value.trim();
  const clientId = document.getElementById('clientId').value.trim();
  const clientSecret = document.getElementById('clientSecret').value.trim();
  const redirectUri = document.getElementById('redirectUri').value.trim();
  const scope = document.getElementById('scope').value.trim();

  if (!authority || !clientId || !redirectUri || !scope) {
    document.getElementById('result').textContent = 'Please fill in all fields (client secret is optional).';
    return;
  }

  // Save the entered values to localStorage.
  localStorage.setItem('oidc.authority', authority);
  localStorage.setItem('oidc.clientId', clientId);
  localStorage.setItem('oidc.clientSecret', clientSecret);
  localStorage.setItem('oidc.redirectUri', redirectUri);
  localStorage.setItem('oidc.scope', scope);

  // Ensure the authority uses the v2.0 endpoint.
  if (!authority.endsWith('/v2.0')) {
    authority += '/v2.0';
  }

  const config = {
    authority: authority,
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope
  };

  // Include client_secret if provided.
  if (clientSecret) {
    config.client_secret = clientSecret;
  }

  // Create a new UserManager instance with the configuration.
  userManager = new Oidc.UserManager(config);

  console.log('localStorage keys before signin:', Object.keys(window.localStorage));

  // Instead of calling signinRedirect(), create the signin URL and open it externally.
  userManager.createSigninRequest().then(response => {
    const signinUrl = response.url;
    console.log('Opening signin URL in external browser:', signinUrl);
    shell.openExternal(signinUrl);
  }).catch(err => {
    document.getElementById('result').textContent = 'Error during createSigninRequest:\n' + err;
  });
});

// Listen for the callback URL sent from the Express server.
ipcRenderer.on('oidc-callback', (event, callbackUrl) => {
  console.log('Callback URL received in renderer:', callbackUrl);
  document.getElementById('result').textContent = 'Received callback URL:\n' + callbackUrl;

  if (!userManager) {
    document.getElementById('result').textContent += '\nError: UserManager instance not found.';
    return;
  }

  console.log('localStorage keys at callback:', Object.keys(window.localStorage));

  // Complete the OIDC flow by processing the callback URL.
  userManager.signinRedirectCallback(callbackUrl).then(user => {
    console.log('User info received:', user);
    document.getElementById('result').textContent = 'User info:\n' + JSON.stringify(user, null, 2);
    // Save the access token for later API calls.
    accessToken = user.access_token;
  }).catch(err => {
    console.error('Error during signinRedirectCallback:', err);
    document.getElementById('result').textContent = 'Error during signinRedirectCallback:\n' + err;
  });
});

// New: Send API Request using the access token.
document.getElementById('sendRequestBtn').addEventListener('click', () => {
  const method = document.getElementById('requestMethod').value;
  const url = document.getElementById('requestUrl').value.trim();
  const bodyText = document.getElementById('requestBody').value.trim();

  if (!url) {
    document.getElementById('apiResponse').textContent = 'Please enter a request URL.';
    return;
  }

  if (!accessToken) {
    document.getElementById('apiResponse').textContent = 'No access token available. Authenticate first.';
    return;
  }

  // Prepare request options.
  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  };

  // If the method is POST, PUT, or PATCH and a body is provided, add JSON headers and body.
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && bodyText) {
    options.headers['Content-Type'] = 'application/json';
    try {
      options.body = JSON.stringify(JSON.parse(bodyText));
    } catch (e) {
      document.getElementById('apiResponse').textContent = 'Invalid JSON body: ' + e;
      return;
    }
  }

  // Call the API endpoint.
  fetch(url, options)
    .then(async (response) => {
      const text = await response.text();
      document.getElementById('apiResponse').textContent = `Status: ${response.status}\n\n${text}`;
    })
    .catch(err => {
      document.getElementById('apiResponse').textContent = 'Error during API call:\n' + err;
    });
});
