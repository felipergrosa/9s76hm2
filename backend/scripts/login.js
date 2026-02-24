const axios = require('axios');

async function login() {
  try {
    const res = await axios.post('http://localhost:8080/auth/login', {
      email: 'admin@whaticket.com',
      password: '123456'
    });
    console.log('Token:', res.data.token);
    console.log('User:', res.data.user.name);
  } catch(e) {
    console.log('Erro:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Data:', e.response.data);
    }
  }
}

login();
