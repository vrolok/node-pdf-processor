/**
 * Job management pure functions
 * Uses immutable techniques to create and update job objects
 */

/**
 * Generates a UUID v4
 * @returns {string} A random UUID
 */
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Creates a new job with default fields and merged job data
 * @param {Object} jobData - Data for the new job
 * @returns {Object} A new job object
 */
const createJob = (jobData) => {
  return {
    id: generateId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...jobData
  };
};

/**
 * Updates a job's status without modifying the original
 * @param {Object} job - The original job object
 * @param {string} newStatus - The new status to apply
 * @returns {Object} A new job object with updated status
 */
const updateJobStatus = (job, newStatus) => {
  return {
    ...job,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
};

module.exports = {
  createJob,
  updateJobStatus
};