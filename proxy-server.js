const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Endpoint para el login del PSM
app.post('/api/login', async (req, res) => {
  try {
    const psmUrl = 'https://psm.emaservicios.com.ar/api/login';
    console.log('Redirecting to PSM:', psmUrl);
    const response = await axios.post(psmUrl, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Login success:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para consumos
app.get('/api/consumos', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const { odt, fecha } = req.query;
    const baseUrl = 'https://psm.emaservicios.com.ar/api';
    const url = odt
      ? `${baseUrl}/consumos?odt=${odt}`
      : `${baseUrl}/consumos?fechaDesde=${fecha}&fechaHasta=${fecha}`;
    console.log('Redirecting to PSM:', url);
    const response = await axios.get(url, {
      headers: { Authorization: token }
    });
    console.log('Consumos success:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Consumos error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
