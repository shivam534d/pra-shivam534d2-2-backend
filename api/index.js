const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { validateCollectionId, fetchProductsMiddleware } = require('./graphqlMiddleware');

app.get('/api/collection/:collectionId', validateCollectionId, fetchProductsMiddleware, (req, res) => {
  const { collectionId, products, collection } = req;

  res.json({
    success: true,
    collectionId,
    collection: collection || null,
    products: products || [],
    totalCount: products ? products.length : 0,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    availableRoutes: ['/api/collection/:collectionId'],
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
