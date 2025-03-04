const express = require('express');
const router = express.Router();
const { createJob, updateJobStatus } = require('../domain/jobManagement');
const { 
  saveJob, 
  notifyJobStatusChange,
  fetchJobFromFirebase 
} = require('../integration/jobIntegration');
const queueManager = require('../queue/jobQueueManager');

// In-memory job storage for this example
// Acts as a fallback if Firebase fetch fails
const jobStore = new Map();

/**
 * Helper function to find a job by ID
 * Primary implementation uses Firebase, falls back to in-memory if not found
 * @param {string} jobId - The job ID to look for
 * @returns {Promise<Object|null>} A promise that resolves to the job object or null if not found
 */
const findJobById = async (jobId) => {
  try {
    // Try to fetch from Firebase first
    const firebaseJob = await fetchJobFromFirebase(jobId);
    if (firebaseJob) {
      return firebaseJob;
    }
    
    // Fall back to in-memory store if not found in Firebase
    console.log(`Job ${jobId} not found in Firebase, checking in-memory store`);
    return jobStore.get(jobId) || null;
  } catch (error) {
    console.warn(`Error fetching job ${jobId} from Firebase, falling back to in-memory:`, error);
    return jobStore.get(jobId) || null;
  }
};

/**
 * POST /api/v1/jobs
 * Creates a new job and persists it
 */
router.post('/api/v1/jobs', async (req, res) => {
  try {
    // Extract job parameters from request body
    const jobData = req.body;
    
    // Create a new job using domain function
    const newJob = createJob(jobData);
    
    // Persist the job using integration function
    await saveJob(newJob);
    
    // Store in our in-memory store
    jobStore.set(newJob.id, newJob);
    
    // Return the job ID and status URL
    res.status(201).json({
      id: newJob.id,
      status: newJob.status,
      statusUrl: `/api/v1/jobs/${newJob.id}/status`
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({
      error: 'Failed to create job',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/jobs/:jobId
 * Retrieves full details of a specific job
 */
router.get('/api/v1/jobs/:jobId', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await findJobById(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    // Return the complete job object
    res.json(job);
  } catch (error) {
    console.error(`Error retrieving job ${req.params.jobId}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve job',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/jobs/:jobId/status
 * Returns a lightweight status for a specific job
 */
router.get('/api/v1/jobs/:jobId/status', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await findJobById(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    // Prepare a lightweight status response
    const statusResponse = {
      id: job.id,
      status: job.status,
      type: job.type,
      progress: calculateJobProgress(job),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
    
    // Include results if job is completed
    if (job.status === 'completed' && job.result) {
      statusResponse.result = {
        summary: job.result.analysis?.summary,
        processedAt: job.result.processedAt
      };
    }
    
    // Include error information if job failed
    if (job.status === 'failed' && job.error) {
      statusResponse.error = {
        message: job.error.message,
        timestamp: job.error.timestamp
      };
    }
    
    res.json(statusResponse);
  } catch (error) {
    console.error(`Error retrieving job status ${req.params.jobId}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve job status',
      message: error.message
    });
  }
});

/**
 * Helper function to calculate job progress percentage
 * @param {Object} job - The job to calculate progress for
 * @returns {number} Progress percentage (0-100)
 */
const calculateJobProgress = (job) => {
  switch (job.status) {
    case 'pending':
      return 0;
    case 'processing':
      // For simplicity, return 50% for all processing jobs
      // In a real implementation, this would be based on actual progress
      return 50;
    case 'completed':
      return 100;
    case 'failed':
      // For failed jobs, return the progress at time of failure
      return job.progress || 0;
    case 'cancelled':
      return job.progress || 0;
    default:
      return 0;
  }
};

/**
 * DELETE /api/v1/jobs/:jobId
 * Cancels a job if it's in a cancellable state
 */
router.delete('/api/v1/jobs/:jobId', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await findJobById(jobId);
    
    // Check if job exists
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    // Check if job is in a cancellable state
    if (job.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: `Job with status "${job.status}" cannot be cancelled. Only pending jobs can be cancelled.`
      });
    }
    
    // Update job status to cancelled
    const cancelledJob = updateJobStatus(job, 'cancelled');
    
    // Add cancellation metadata
    const jobWithCancellationInfo = {
      ...cancelledJob,
      cancellation: {
        cancelledAt: new Date().toISOString(),
        cancelledBy: req.user?.id || 'unknown',
        reason: req.body.reason || 'User cancelled'
      }
    };
    
    // Persist the updated job
    await saveJob(jobWithCancellationInfo);
    
    // Notify about the status change
    await notifyJobStatusChange(jobWithCancellationInfo);
    
    // Update the job in the store
    jobStore.set(jobId, jobWithCancellationInfo);
    
    // Return success response
    res.json({
      id: jobId,
      status: 'cancelled',
      message: 'Job cancelled successfully',
      cancelledAt: jobWithCancellationInfo.cancellation.cancelledAt
    });
  } catch (error) {
    console.error(`Error cancelling job ${req.params.jobId}:`, error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/jobs/:jobId/retry
 * Retries a failed job
 */
router.put('/api/v1/jobs/:jobId/retry', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await findJobById(jobId);
    
    // Check if job exists
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    // Check if job is eligible for retry
    const retryableStatuses = ['failed', 'retry'];
    if (!retryableStatuses.includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot retry job',
        message: `Job with status "${job.status}" cannot be retried. Only jobs with status ${retryableStatuses.join(', ')} can be retried.`
      });
    }
    
    // Reset job for retry
    const resetJob = {
      ...job,
      status: 'pending',      // Reset status to pending
      retries: 0,             // Reset retry count
      error: undefined,       // Clear any error information
      progress: 0,            // Reset progress
      updatedAt: new Date().toISOString(),
      retryInfo: {
        originalStatus: job.status,
        retriedAt: new Date().toISOString(),
        retriedBy: req.user?.id || 'unknown',
        previousErrors: job.error ? [job.error] : (job.retryInfo?.previousErrors || [])
      }
    };
    
    // Update job status using domain function
    const retriedJob = updateJobStatus(resetJob, 'pending');
    
    // Persist the updated job
    await saveJob(retriedJob);
    await notifyJobStatusChange(retriedJob);
    
    // Update the job in the store
    jobStore.set(jobId, retriedJob);
    
    // Access the queue manager from app.locals and re-enqueue the job
    // This is more complex because we need to access the Express app
    // In a real application with proper dependency injection, this would be cleaner
    if (req.app.locals.jobQueueManager) {
      req.app.locals.jobQueueManager.addJob(retriedJob);
    } else {
      console.warn('Queue manager not available in request context. Job not re-enqueued.');
    }
    
    // Return success response
    res.json({
      id: jobId,
      status: 'pending',
      message: 'Job scheduled for retry',
      retriedAt: retriedJob.retryInfo.retriedAt
    });
  } catch (error) {
    console.error(`Error retrying job ${req.params.jobId}:`, error);
    res.status(500).json({
      error: 'Failed to retry job',
      message: error.message
    });
  }
});

module.exports = router;