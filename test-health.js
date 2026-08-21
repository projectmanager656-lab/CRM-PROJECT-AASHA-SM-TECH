const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
