const fetch = require("node-fetch");

const toGlobalId = (type, id) => {
  return Buffer.from(`gid://shopify/${type}/${id}`).toString("base64");
};

const validateCollectionId = (req, res, next) => {
  const collectionId = req.body.collectionId || req.params.collectionId;

  if (!collectionId) {
    return res.status(400).json({
      success: false,
      error: "Collection ID is required as a URL parameter",
    });
  }

  if (typeof collectionId !== "string" || collectionId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Collection ID must be a valid non-empty string",
    });
  }

  req.collectionId = collectionId.trim();
  next();
};

const fetchProductsMiddleware = async (req, res, next) => {
  try {
    const collectionId = req.collectionId;
    const globalCollectionId = toGlobalId("Collection", collectionId);
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

    if (limit > 50) {
      return res.status(400).json({
        success: false,
        error: "Limit cannot exceed 50 products",
      });
    }

    const result = await fetchProductsByCollection(globalCollectionId, {
      limit,
    });

    req.products = result.products;
    req.collection = result.collection;

    next();
  } catch (error) {
    if (error.message.includes("Collection not found")) {
      return res.status(404).json({
        success: false,
        error: "Collection not found",
        collectionId: req.collectionId,
      });
    }

    if (error.message.includes("HTTP error")) {
      return res.status(502).json({
        success: false,
        error: "Failed to connect to GraphQL API",
        details: error.message,
      });
    }

    if (error.message.includes("GraphQL errors")) {
      return res.status(400).json({
        success: false,
        error: "GraphQL query error",
        details: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch products",
      details: error.message,
    });
  }
};

async function fetchProductsByCollection(collectionId, options = {}) {
  const { limit = 10 } = options;

  const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
  const API_TOKEN = process.env.API_TOKEN;

  if (!GRAPHQL_ENDPOINT) {
    throw new Error("GRAPHQL_ENDPOINT environment variable is required");
  }

  if (!API_TOKEN) {
    throw new Error("API_TOKEN environment variable is required");
  }

  const query = `
  query ($id: ID!) {
    collection(id: $id) {
     id
      products(first: 250) {
        nodes {
          id
          handle
          images(first: 25) {
            nodes {
              altText
              height
              id
              url
              width
            }
          }
          category {
            name
            id
          }
          createdAt
          description
          descriptionHtml
          availableForSale
          compareAtPriceRange {
            maxVariantPrice {
              amount
              currencyCode
            }
            minVariantPrice {
              amount
              currencyCode
            }
          }
          onlineStoreUrl
          priceRange {
            maxVariantPrice {
              amount
              currencyCode
            }
            minVariantPrice {
              amount
              currencyCode
            }
          }
          productType
          publishedAt
          tags
          title
          totalInventory
          vendor
          variants(first: 15) {
            nodes {
              availableForSale
              compareAtPrice {
                amount
                currencyCode
              }
              id
              image {
                altText
                height
                id
                url
                width
              }
              price {
                amount
                currencyCode
              }
              sku
              title
              taxable
              weight
              quantityAvailable
            }
          }
        }
      }
    }
  }
`;

  const variables = { id: collectionId, limit };

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": API_TOKEN,
  };

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status} - ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  if (!data.data) {
    throw new Error("No data returned from GraphQL API");
  }

  if (!data.data.collection) {
    throw new Error("Collection not found");
  }

  const collection = data.data.collection;
  const products = collection.products.nodes;

  return {
    collection: {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      handle: collection.handle,
    },
    products,
  };
}

module.exports = {
  validateCollectionId,
  fetchProductsMiddleware,
  fetchProductsByCollection,
};
