const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Variables para login
const psmUsuario = process.env.PSM_USUARIO || 'rcarvajal@emaservicios.com.ar';
const psmPassword = process.env.PSM_PASSWORD || '10003';
const psmBaseUrl = 'https://psm.emaservicios.com.ar/api';

// Token management
let psmToken = null;
let psmTokenExpiry = 0;

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(path.join(__dirname, 'proxy.log'), logMessage);
}

async function getPSMToken() {
  if (psmToken && Date.now() < psmTokenExpiry) {
    log('Using cached token');
    return psmToken;
  }
  
  try {
    const url = `${psmBaseUrl}/login`;
    const payload = { nombreUsuario: psmUsuario, password: psmPassword };
    
    log('Getting token from PSM...');
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    psmToken = response.data.access_token || response.data.token;
    psmTokenExpiry = Date.now() + 3600000; // 1 hora
    
    log('Token obtained');
    return psmToken;
  } catch (error) {
    log('Error getting token: ' + error.message);
    throw error;
  }
}

// Middleware para log
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});

// Endpoint para login del PSM (pasa las credenciales correctas)
app.post('/api/login', async (req, res) => {
  try {
    log('Login request received');
    const token = await getPSMToken();
    res.json({ access_token: token });
  } catch (error) {
    log('Login error: ' + error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para consumos
app.get('/api/consumos', async (req, res) => {
  try {
    const token = await getPSMToken();
    const { odt, fecha, fechaDesde, fechaHasta } = req.query;
    
    let url;
    if (odt) {
      url = `${psmBaseUrl}/consumos?odt=${odt}`;
    } else if (fechaDesde && fechaHasta) {
      url = `${psmBaseUrl}/consumos?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`;
    } else if (fecha) {
      url = `${psmBaseUrl}/consumos?fechaDesde=${fecha}&fechaHasta=${fecha}`;
    } else {
      // Default to today if no date specified
      const today = new Date().toISOString().split('T')[0];
      url = `${psmBaseUrl}/consumos?fechaDesde=${today}&fechaHasta=${today}`;
    }
    
    log('Consumos to PSM: ' + url);
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    log('Consumos success: ' + response.status);
    res.json(response.data);
  } catch (error) {
    log('Consumos error: ' + error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para ODTs
app.get('/api/informePiezas/tablaFiltradaOdt', async (req, res) => {
  try {
    const token = await getPSMToken();
    const pageSize = 5000;
    let page = 0;
    let allData = [];
    let totalCount = 0;
    
    // Try with larger pageSize first
    const url = `${psmBaseUrl}/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=${page}&pageSize=${pageSize}`;
    log(`ODTs to PSM: ` + url);
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 120000
    });
    
    const pageData = response.data;
    allData = pageData.data || [];
    totalCount = pageData.totalCount || allData.length;
    
    log(`ODTs success: ${response.status}, got ${allData.length} items`);
    res.json({ data: allData, totalCount: allData.length });
  } catch (error) {
    log('ODTs error: ' + error.message);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all para debugging
app.use((req, res) => {
  log('No route matched: ' + req.method + ' ' + req.url);
  res.status(404).json({ error: 'Route not found', method: req.method, url: req.url });
});

const PORT = 3000;
app.listen(PORT, () => {
  log('Proxy server running on port ' + PORT);
  log('PSM_BASE_URL: ' + psmBaseUrl);
  log('PSM_USUARIO: ' + psmUsuario);
});
