/**
 * Job Queue Manager
 * Manages a queue of jobs waiting to be processed
 */

// Queue to hold pending jobs
let jobQueue = [];
let isProcessing = false;
let taskProcessor = null;
let checkInterval = null;

/**
 * Initializes the job queue with a task processor
 * @param {Function} processor - The task processor function
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Check interval in ms (default: 5000)
 * @returns {Object} The queue manager instance
 */
const initialize = (processor, options = {}) => {
  if (typeof processor !== 'function') {
    throw new Error('Task processor must be a function');
  }
  
  taskProcessor = processor;
  const interval = options.interval || 5000;
  
  // Start the processing timer if not already running
  if (!checkInterval) {
    checkInterval = setInterval(processNextJob, interval);
    console.log(`Job queue initialized, checking every ${interval}ms`);
  }
  
  return {
    addJob,
    getQueueLength: () => jobQueue.length,
    shutdown
  };
};

/**
 * Adds a job to the processing queue
 * @param {Object} job - The job to be processed
 * @returns {Object} The added job
 */
const addJob = (job) => {
  if (!job || !job.id) {
    throw new Error('Invalid job: must have an id property');
  }
  
  // Add to queue with scheduled time (default to now)
  const queuedJob = {
    ...job,
    queuedAt: new Date().toISOString(),
    scheduledFor: job.scheduledFor || new Date().toISOString()
  };
  
  jobQueue.push(queuedJob);
  console.log(`Job ${job.id} added to queue. Queue length: ${jobQueue.length}`);
  
  return queuedJob;
};

/**
 * Processes the next job in the queue
 * @returns {Promise<void>}
 */
const processNextJob = async () => {
  // Don't process if we're already processing or no task processor
  if (isProcessing || !taskProcessor || jobQueue.length === 0) {
    return;
  }
  
  // Sort jobs by scheduled time
  jobQueue.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  
  const now = new Date();
  const nextJob = jobQueue[0];
  
  // Check if the job is scheduled for now or in the past
  if (new Date(nextJob.scheduledFor) <= now) {
    isProcessing = true;
    
    try {
      // Remove job from queue
      jobQueue = jobQueue.filter(job => job.id !== nextJob.id);
      console.log(`Processing job ${nextJob.id}. Remaining queue: ${jobQueue.length}`);
      
      // Process the job
      await taskProcessor(nextJob);
    } catch (error) {
      console.error(`Error processing job ${nextJob.id}:`, error);
      
      // Put the job back in queue with a delay if it should be retried
      if (nextJob.retries < (nextJob.maxRetries || 3)) {
        const retryDelay = calculateBackoff(nextJob.retries || 0);
        const retryTime = new Date(Date.now() + retryDelay);
        
        addJob({
          ...nextJob,
          retries: (nextJob.retries || 0) + 1,
          scheduledFor: retryTime.toISOString(),
          lastError: error.message
        });
        
        console.log(`Job ${nextJob.id} rescheduled for retry in ${retryDelay}ms`);
      } else {
        console.error(`Job ${nextJob.id} failed permanently after ${nextJob.retries} retries`);
      }
    } finally {
      isProcessing = false;
    }
  }
};

/**
 * Calculate exponential backoff delay
 * @param {number} retryCount - Number of retries so far
 * @returns {number} Delay in milliseconds
 */
const calculateBackoff = (retryCount) => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  
  // Exponential backoff: 2^retry * baseDelay with jitter
  const delay = Math.min(
    maxDelay,
    Math.pow(2, retryCount) * baseDelay + (Math.random() * 1000)
  );
  
  return delay;
};

/**
 * Shuts down the queue manager
 */
const shutdown = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Job queue manager shut down');
  }
};

module.exports = {
  initialize
};