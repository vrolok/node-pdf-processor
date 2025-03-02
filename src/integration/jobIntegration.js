/**
 * Job integration module
 * External interactions for job management
 */

/**
 * Simulates saving a job to a persistent store
 * @param {Object} job - The job to be saved
 * @returns {Promise<Object>} A promise that resolves to the saved job
 */
const saveJob = async (job) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(`Job ${job.id} saved to persistent store`);
  return job; // Return the job as if it was returned from a database
};

/**
 * Simulates notifying an external system about a job status change
 * @param {Object} job - The job with updated status
 * @returns {Promise<boolean>} A promise that resolves to true if notification was successful
 */
const notifyJobStatusChange = async (job) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log(`Notification sent: Job ${job.id} status changed to ${job.status}`);
  return true; // Notification was successful
};

module.exports = {
  saveJob,
  notifyJobStatusChange
};