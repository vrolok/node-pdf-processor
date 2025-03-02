/**
 * Document Integration Module
 * Handles external interactions related to document processing
 */

// Simple token bucket rate limiter
class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxRequests || 10;
    this.refillRate = options.perTimeWindow || 60000; // default 1 minute
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async execute(fn) {
    // Refill tokens based on time elapsed
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed > 0) {
      const tokensToAdd = Math.floor(elapsed / this.refillRate) * this.maxTokens;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }

    // Check if we have tokens available
    if (this.tokens < 1) {
      const waitTime = Math.ceil((this.refillRate - elapsed) / 1000);
      console.log(`Rate limit reached. Try again in ${waitTime} seconds.`);
      throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds.`);
    }

    // Consume a token and execute the function
    this.tokens--;
    return await fn();
  }
}

// Create a rate limiter for Gemini API calls
const geminiApiLimiter = new RateLimiter({
  maxRequests: 5,
  perTimeWindow: 60000 // 5 calls per minute
});

/**
 * Simulates fetching a document from storage
 * @param {string} documentUrl - URL of the document to fetch
 * @returns {Promise<Object>} A promise that resolves to the document object
 */
const fetchDocument = async (documentUrl) => {
  // Simulate network delay (200-500ms)
  const delay = 200 + Math.random() * 300;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  console.log(`Fetching document from: ${documentUrl}`);
  
  // Create a dummy document based on the URL
  const documentId = documentUrl.split('/').pop().replace(/\.[^/.]+$/, '');
  
  return {
    id: documentId,
    url: documentUrl,
    content: `This is sample content for document ${documentId}. It would normally contain the actual document text.`,
    format: documentUrl.includes('.pdf') ? 'pdf' : 
            documentUrl.includes('.docx') ? 'docx' : 'txt',
    size: Math.floor(Math.random() * 1000000) + 50000, // Random size between 50KB and 1MB
    fetchedAt: new Date().toISOString()
  };
};

/**
 * Simulates calling Gemini API for document analysis with rate limiting
 * @param {string} documentText - The text to analyze
 * @returns {Promise<Object>} A promise that resolves to analysis results
 */
const callGeminiForAnalysis = async (documentText) => {
  try {
    // Execute within rate limiter
    return await geminiApiLimiter.execute(async () => {
      // Simulate processing time (1-2 seconds)
      const processingTime = 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      console.log(`Analyzing document text (${documentText.length} chars) with Gemini API`);
      
      // Generate a dummy analysis result
      return {
        summary: `This appears to be a ${documentText.length > 500 ? 'long' : 'short'} document about various topics.`,
        topics: ['business', 'technology', 'documentation'].filter(() => Math.random() > 0.5),
        entities: [
          { name: 'Example Corp', type: 'organization', confidence: 0.85 },
          { name: 'Processing Engine', type: 'product', confidence: 0.92 }
        ],
        sentiment: Math.random() > 0.7 ? 'positive' : Math.random() > 0.4 ? 'neutral' : 'negative',
        language: 'en',
        confidence: 0.75 + (Math.random() * 0.2),
        processingTime: `${processingTime}ms`,
        model: 'gemini-1.5-pro-simulation'
      };
    });
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    throw error;
  }
};

module.exports = {
  fetchDocument,
  callGeminiForAnalysis
};