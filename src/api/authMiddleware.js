/**
 * Authentication Middleware
 * Simulates Entra ID (Azure AD) token validation
 */

// Dummy token for development/testing
const VALID_TEST_TOKEN = 'valid-test-token-123';

/**
 * Middleware to authenticate requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = (req, res, next) => {
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
  
  // In a real implementation, this would validate the token with Entra ID
  // For this simulation, we'll use a simple token check
  if (token === VALID_TEST_TOKEN || isValidSimulatedToken(token)) {
    // Add user info to request (would be extracted from token in real impl)
    req.user = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      roles: ['user']
    };
    
    return next();
  }
  
  // Invalid token
  return res.status(403).json({
    error: 'Authentication failed',
    message: 'Invalid or expired token'
  });
};

/**
 * Checks if a token looks like a valid JWT
 * @param {string} token - The token to check
 * @returns {boolean} Whether the token appears valid
 */
const isValidSimulatedToken = (token) => {
  // In a real implementation, this would verify the token signature
  // For development, check if it has the structure of a JWT (header.payload.signature)
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
};

module.exports = {
  authenticate
};