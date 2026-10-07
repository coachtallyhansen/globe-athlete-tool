// Public app configuration. Keep private Sheet IDs and secrets out of browser code.
window.ATHLETE_DATA_URL = 'https://script.google.com/macros/s/AKfycby0MH9fvwiX2v2HXRWPKj_4d0MuIp9WnSlqXlaPWZwM0RmBwrA57P_Y2syPquFgDYc-zg/exec';

// Google Identity Services Web Client ID. This value is public by design, but must match
// the GOOGLE_CLIENT_ID Script Property in Apps Script before student login will work.
window.GOOGLE_CLIENT_ID = '455136024480-en0j24mfa7n06od7ijt4polcj2lf7l9o.apps.googleusercontent.com';
window.AUTH_ALLOWED_DOMAIN = 'globeschools.org';

// Config is already loaded with a timestamp by live-data.js, so use it as a reliable
// cache-busting hook for lightweight profile enhancements on the permanent site.
(function(){
  if (document.querySelector('script[data-globe-external-profiles]')) return;
  const s = document.createElement('script');
  s.src = 'maxpreps-links.js?v=' + Date.now();
  s.async = true;
  s.dataset.globeExternalProfiles = '1';
  document.head.appendChild(s);
})();
