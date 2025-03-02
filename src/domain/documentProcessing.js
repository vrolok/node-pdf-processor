/**
 * Document Processing Domain Module
 * Pure functions for document text extraction and analysis
 */

/**
 * Extracts text from a document
 * @param {Object} document - The document object with id and content
 * @returns {Object} A new object with extracted text and metadata
 */
const extractTextFromDocument = (document) => {
  // Simulate text extraction from document content
  // In a real implementation, this would use PDF parsing libraries or similar
  
  const extractedText = document.content 
    ? `Simulated extraction from ${document.content.substring(0, 30)}...`
    : 'No content available for extraction';
    
  // Return a new object with the extraction results
  return {
    ...document,
    extractedText,
    metadata: {
      extractedAt: new Date().toISOString(),
      charCount: extractedText.length,
      format: document.format || 'unknown'
    }
  };
};

/**
 * Analyzes the text content of a document
 * @param {Object} documentWithText - Document with extractedText property
 * @returns {Object} A new object with analysis results
 */
const analyzeDocument = (documentWithText) => {
  // Check if document has extracted text
  if (!documentWithText.extractedText) {
    return {
      ...documentWithText,
      analysis: {
        error: 'No extracted text available for analysis',
        status: 'failed'
      }
    };
  }
  
  // Simulate text analysis (in real world, this might call an AI model)
  const sampleKeywords = ['important', 'document', 'analysis', 'processing'];
  const randomSentiment = ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)];
  
  // Generate simulated analysis results
  const analysis = {
    summary: `This document appears to be about ${documentWithText.metadata?.format || 'unknown'} processing.`,
    sentiment: randomSentiment,
    keywords: sampleKeywords.filter(() => Math.random() > 0.5),
    confidence: Math.round(Math.random() * 100) / 100,
    analyzedAt: new Date().toISOString()
  };
  
  // Return a new object with the original data plus analysis
  return {
    ...documentWithText,
    analysis
  };
};

module.exports = {
  extractTextFromDocument,
  analyzeDocument
};