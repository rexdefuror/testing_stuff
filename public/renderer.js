// public/renderer.js

// Determine if running in Electron or in a plain browser.
const isElectron = !!(window && window.process && window.process.type);

// Global variables to hold the UserManager instance and access token.
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

  // In web mode, check if the URL contains a callback parameter.
  if (!isElectron) {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get('callback');
    if (callback) {
      // We assume userManager is already created if a callback is present.
      // (In a production app you might store the state in localStorage as well.)
      if (userManager) {
        userManager.signinRedirectCallback(callback).then(user => {
          accessToken = user.access_token;
          document.getElementById('result').textContent = 'User info:\n' + JSON.stringify(user, null, 2);
          // Remove the callback parameter from the URL.
          window.history.replaceState({}, document.title, '/index.html');
        }).catch(err => {
          document.getElementById('result').textContent = 'Error during signinRedirectCallback:\n' + err;
        });
      }
    }
  }
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

  // Create the signin URL and open it.
  userManager.createSigninRequest().then(response => {
    const signinUrl = response.url;
    if (isElectron) {
      // (In Electron, you would use Electron's shell module.)
      const { shell } = require('electron');
      shell.openExternal(signinUrl);
    } else {
      // In a plain browser, simply redirect.
      window.location.href = signinUrl;
    }
  }).catch(err => {
    document.getElementById('result').textContent = 'Error during createSigninRequest:\n' + err;
  });
});

// API Request: This part works the same in either mode.
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

  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  };

  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && bodyText) {
    options.headers['Content-Type'] = 'application/json';
    try {
      options.body = JSON.stringify(JSON.parse(bodyText));
    } catch (e) {
      document.getElementById('apiResponse').textContent = 'Invalid JSON body: ' + e;
      return;
    }
  }

  fetch(url, options)
    .then(async (response) => {
      const text = await response.text();
      document.getElementById('apiResponse').textContent = `Status: ${response.status}\n\n${text}`;
    })
    .catch(err => {
      document.getElementById('apiResponse').textContent = 'Error during API call:\n' + err;
    });
});
