/**
 * Authentication Middleware
 * Implements Entra ID (Azure AD) token validation
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');


// Configuration
const config = {
  // Azure AD tenant ID or 'common' for multi-tenant apps
  tenantId: process.env.TENANT_ID || 'common',
  // Your application's client ID (audience)
  clientId: process.env.CLIENT_ID || 'your-client-id',
  // Dummy token for development/testing
  validTestToken: 'valid-test-token-123'
};

// JWKS client to retrieve signing keys
const jwksUri = `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`;
const client = jwksClient({
  jwksUri: jwksUri,
  cache: true,
  cacheMaxAge: 86400000 // 24 hours
});

// Function to get the signing key
const getSigningKey = (kid) => {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        return reject(err);
      }
      const signingKey = key.publicKey || key.rsaPublicKey;
      resolve(signingKey);
    });
  });
};

/**
 * Verifies an Entra ID JWT token
 * @param {string} token - The token to verify
 * @returns {Promise<Object>} The decoded token payload
 */
const verifyToken = async (token) => {
  try {
    // For development/testing with dummy token
    if (token === config.validTestToken) {
      return {
        oid: 'user-123',
        name: 'Test User',
        preferred_username: 'test@example.com',
        roles: ['user']
      };
    }

    // Decode the token header to get the key ID (kid)
    const decodedToken = jwt.decode(token, { complete: true });
    
    if (!decodedToken) {
      throw new Error('Invalid token format');
    }

    const kid = decodedToken.header.kid;
    
    // Get the signing key
    const signingKey = await getSigningKey(kid);
    
    // Verify the token
    const verified = jwt.verify(token, signingKey, {
      audience: config.clientId,
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`
    });
    
    return verified;
  } catch (error) {
    throw error;
  }
};

/**
 * Middleware to authenticate requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  // Skip authentication for health endpoint
  if (req.path === '/health') {
    return next();
  }

  // Get authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing Authorization header'
    });
  }

  // Check token format (Bearer token)
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Invalid authentication',
      message: 'Authorization header must be Bearer token'
    });
  }

  // Extract token
  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify the token with Entra ID
    const decodedToken = await verifyToken(token);
    
    // Add user info to request
    req.user = {
      id: decodedToken.oid || decodedToken.sub,
      name: decodedToken.name,
      email: decodedToken.preferred_username || decodedToken.email,
      roles: decodedToken.roles || ['user']
    };
    
    return next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    
    // Invalid token
    return res.status(403).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

module.exports = {
  authenticate
};