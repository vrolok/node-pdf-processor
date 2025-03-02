/**
 * Task Processor
 * Processes jobs from the queue
 */

const { updateJobStatus } = require('../domain/jobManagement');
const { extractTextFromDocument, analyzeDocument } = require('../domain/documentProcessing');
const { fetchDocument, callGeminiForAnalysis } = require('../integration/documentIntegration');
const { saveJob, notifyJobStatusChange } = require('../integration/jobIntegration');

/**
 * Processes a job based on its type
 * @param {Object} job - The job to process
 * @returns {Promise<Object>} A promise that resolves to the processed job
 */
const processJob = async (job) => {
  try {
    console.log(`Starting processing for job ${job.id} of type ${job.type}`);
    
    // Update job status to processing
    let updatedJob = updateJobStatus(job, 'processing');
    await saveJob(updatedJob);
    await notifyJobStatusChange(updatedJob);
    
    // Process based on job type
    switch (job.type) {
      case 'pdf-processing':
        updatedJob = await processPdfJob(updatedJob);
        break;
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }
    
    // Update job status to completed
    updatedJob = updateJobStatus(updatedJob, 'completed');
    await saveJob(updatedJob);
    await notifyJobStatusChange(updatedJob);
    
    console.log(`Job ${job.id} processed successfully`);
    return updatedJob;
    
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    
    // Check if this is a transient error that should be retried
    const isTransient = isTransientError(error);
    const retryStatus = isTransient ? 'retry' : 'failed';
    
    // Update job with error information
    const failedJob = updateJobStatus(job, retryStatus);
    const jobWithError = {
      ...failedJob,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        isTransient,
        timestamp: new Date().toISOString()
      }
    };
    
    await saveJob(jobWithError);
    await notifyJobStatusChange(jobWithError);
    
    // Rethrow the error to trigger retry logic in queue manager
    throw error;
  }
};

/**
 * Processes a PDF job
 * @param {Object} job - The job to process
 * @returns {Promise<Object>} A promise that resolves to the processed job with results
 */
const processPdfJob = async (job) => {
  if (!job.documentUrl) {
    throw new Error('Missing documentUrl for PDF processing job');
  }
  
  // Step 1: Fetch the document
  console.log(`Fetching document from ${job.documentUrl}`);
  const document = await fetchDocument(job.documentUrl);
  
  // Step 2: Extract text from the document
  console.log(`Extracting text from document ${document.id}`);
  const documentWithText = extractTextFromDocument(document);
  
  // Step 3: Analyze the document with Gemini if the job requests it
  let processedDocument = documentWithText;
  if (job.analyzeContent !== false) {
    console.log(`Analyzing document content for ${document.id}`);
    
    try {
      // Call Gemini API (rate-limited)
      const analysisResult = await callGeminiForAnalysis(documentWithText.extractedText);
      
      // Add analysis from Gemini to our document analysis
      processedDocument = analyzeDocument({
        ...documentWithText,
        geminiAnalysis: analysisResult
      });
    } catch (error) {
      console.warn(`Gemini analysis failed: ${error.message}. Continuing with extracted text only.`);
      processedDocument = analyzeDocument(documentWithText);
    }
  }
  
  // Step 4: Add results to job
  return {
    ...job,
    result: {
      documentId: document.id,
      extractedText: processedDocument.extractedText,
      analysis: processedDocument.analysis,
      processedAt: new Date().toISOString()
    }
  };
};

/**
 * Determines if an error is transient and should be retried
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is transient
 */
const isTransientError = (error) => {
  // For demonstration, treat rate limit errors as transient
  if (error.message && error.message.includes('Rate limit exceeded')) {
    return true;
  }
  
  // Treat network and timeout errors as transient
  if (error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNRESET' || 
      error.code === 'ECONNREFUSED' ||
      error.message.includes('timeout')) {
    return true;
  }
  
  // Default to non-transient
  return false;
};

module.exports = {
  processJob
};