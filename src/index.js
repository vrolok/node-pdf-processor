const express = require('express');
const jobRoutes = require('./api/jobRoutes');
const { authenticate } = require('./api/authMiddleware');
const { processJob } = require('./processor/taskProcessor');
const queueManager = require('./queue/jobQueueManager');

// Configuration
const PORT = process.env.PORT || 3000;
const QUEUE_CHECK_INTERVAL = 5000; // 5 seconds

/**
 * Bootstrap the application
 */
const bootstrap = async () => {
  console.log('Initializing asynchronous task processing service...');
  
  // Create Express app
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(authenticate); // Apply authentication to all routes
  
  // Initialize the job queue manager with the task processor
  const jobQueueManager = queueManager.initialize(processJob, {
    interval: QUEUE_CHECK_INTERVAL
  });
  
  // Make queue manager accessible to routes
  app.locals.jobQueueManager = jobQueueManager;
  
  // Routes
  app.get('/health', (req, res) => {
    const queueLength = jobQueueManager.getQueueLength();
    res.json({ 
      status: 'ok',
      queueStats: {
        pendingJobs: queueLength
      },
      timestamp: new Date().toISOString()
    });
  });
  
  // Mount job routes
  app.use(jobRoutes);
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`✨ Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    console.log(`Job queue processing interval: ${QUEUE_CHECK_INTERVAL}ms`);
    console.log('Server is ready to accept requests');
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down server...');
    
    // Shutdown queue manager
    if (jobQueueManager) {
      jobQueueManager.shutdown();
    }
    
    process.exit(0);
  };
  
  // Register shutdown handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

// Start the application
bootstrap().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});