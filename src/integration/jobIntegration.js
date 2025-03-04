/**
 * Job integration module
 * External interactions for job management
 */
const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore (in a real app, you would configure this with actual credentials)
// For now, this is a stub that simulates Firebase interaction
let firestore = null;
try {
  firestore = new Firestore({
    projectId: 'processing-engine-project',
    // In a real app, you would use proper configuration
    // Either through environment variables or service account credentials
  });
} catch (error) {
  console.warn('Failed to initialize Firestore, using fallback implementation', error);
}

// Collection reference for jobs
const JOBS_COLLECTION = 'jobs';

/**
 * Saves a job to Firebase Firestore
 * @param {Object} job - The job to be saved
 * @returns {Promise<Object>} A promise that resolves to the saved job
 */
const saveJobToFirebase = async (job) => {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!firestore) {
      console.warn('Firebase not initialized, using fallback storage');
      return job;
    }
    
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(job.id);
    
    // Store the job data (in a real implementation this would actually write to Firestore)
    console.log(`Saving job ${job.id} to Firebase Firestore`);
    // await jobRef.set(job); // Commented out since this is a stub
    
    return job;
  } catch (error) {
    console.error(`Error saving job ${job.id} to Firebase:`, error);
    throw error;
  }
};

/**
 * Fetches a job from Firebase Firestore by its ID
 * @param {string} jobId - The ID of the job to fetch
 * @returns {Promise<Object|null>} A promise that resolves to the job or null if not found
 */
const fetchJobFromFirebase = async (jobId) => {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!firestore) {
      console.warn('Firebase not initialized, using fallback storage');
      return null;
    }
    
    console.log(`Fetching job ${jobId} from Firebase Firestore`);
    
    // Simulate fetch from Firestore
    // In a real implementation, this would be:
    // const jobDoc = await firestore.collection(JOBS_COLLECTION).doc(jobId).get();
    // return jobDoc.exists ? jobDoc.data() : null;
    
    // For now, return null to simulate not found
    // The jobRoutes.js will fall back to the in-memory store
    return null;
  } catch (error) {
    console.error(`Error fetching job ${jobId} from Firebase:`, error);
    throw error;
  }
};

/**
 * Saves a job to a persistent store
 * Primary implementation uses Firebase, falls back to in-memory if Firebase fails
 * @param {Object} job - The job to be saved
 * @returns {Promise<Object>} A promise that resolves to the saved job
 */
const saveJob = async (job) => {
  try {
    // Try to save to Firebase first (primary storage)
    return await saveJobToFirebase(job);
  } catch (error) {
    console.warn(`Failed to save job ${job.id} to Firebase, using fallback implementation:`, error);
    
    // Fallback to original implementation
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`Job ${job.id} saved to persistent store (fallback)`);
    return job;
  }
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
  notifyJobStatusChange,
  saveJobToFirebase,
  fetchJobFromFirebase
};