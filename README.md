# Asynchronous Task Processing Service Specification

## Overview

This document outlines the specifications for an asynchronous task processing service built using functional programming principles. The service processes tasks submitted via HTTP POST requests from a front-end application, with a focus on handling long-running API calls to external services. The system manages a queue of background jobs with different priorities and provides status updates to users through polling endpoints.

## System Architecture

### Core Components

1. **API Layer**
   - RESTful HTTP endpoints for job submission, management, and status polling
   - Authentication via Entra ID (Azure)
   - User-specific access controls

2. **Job Queue Manager**
   - Manages the queue of pending jobs
   - Handles scheduling of future jobs
   - Implements retry logic with exponential backoff

3. **Task Processor**
   - Executes jobs asynchronously
   - Processes different types of tasks (initially PDF processing with Gemini)
   - Maintains job state throughout processing

4. **State Management**
   - Firebase for persistent job state storage
   - Google Cloud Storage for file storage

5. **Monitoring and Observability**
   - Comprehensive logging at multiple levels
   - Metrics collection for job lifecycle events
   - Prometheus and Grafana integration
  
  
The architecture consists of two primary components:  

1. **Data Transformation Engine**: Houses all business logic as pure functions that accept input data and return output data without modifying the original or producing side effects. This approach makes code easier to test, debug, and maintain because functions always produce the same output given the same input.  

2. **External Integration Layer**: Manages all interactions with external systems (databases, APIs, file systems) and handles data conversion between external formats and internal representations. This layer encapsulates all side effects, providing a clean boundary that simplifies testing and isolates potential sources of failure.  


### Representing Data with Generic Structures

All domain entities in the system are represented using basic data structures (objects/maps and arrays) rather than specialized classes. For example:

```javascript
// Instead of creating a Job class with methods
const job = {
  id: "9448ef0d-2621-45e4-8053-286cafa47306",
  status: "pending",
  documentUrl: "gs://example-bucket/folder/file.pdf",
  createdAt: "2025-03-01T12:00:00Z"
};
```

### Immutability for Practical Benefits

The system treats all data as immutable after creation. Instead of modifying existing data:

```javascript
// Instead of modifying the original job
function updateJobStatus(job, newStatus) {
  // Create a new job object with the updated status
  return { ...job, status: newStatus };
}

// Original data remains unchanged
const updatedJob = updateJobStatus(job, "processing");
```

### Idempotent Processing

Design data transformations to be idempotent, ensuring repeated processing produces the same result:

```javascript
// Idempotent job processing function
function processJob(job, processingResult) {
  // Check if job was already processed
  if (job.status === "completed" && job.resultId) {
    return job; // Return unchanged if already processed
  }
  
  // Otherwise create a new job object with updated properties
  return {
    ...job,
    status: "completed",
    resultId: processingResult.id,
	documentUrl: "gs://example-bucket/folder/processed_file.txt",
    completedAt: getCurrentTimestamp()
  };
}
```

### Rate Limiting

Implement rate limiting in the External Integration Layer. For example:

```javascript
const geminiApiLimiter = new RateLimiter({
  maxRequests: 100,
  perTimeWindow: 60000, // 1 minute
  strategy: "token-bucket"
});

async function analyzeDocumentWithGemini(document) {
  return geminiApiLimiter.execute(async () => {
    return await geminiApi.analyze(document);
  });
}
```

## Domain-Driven Service Boundaries

To reorganize your specification around domain-driven boundaries, structure it as follows:

### Job Management Domain

This domain handles everything related to job lifecycle:

```javascript
// Pure data transformation functions
const JobManagement = {
  createJob: (jobData) => {
    // Return a new job with generated ID, timestamps, etc.
    return {
      id: generateId(),
      status: "pending",
      ...jobData,
      createdAt: getCurrentTimestamp()
    };
  },
  
  updateJobStatus: (job, newStatus) => {
    // Return a new job with updated status
    return {
      ...job,
      status: newStatus,
      updatedAt: getCurrentTimestamp()
    };
  },
  
  // Other job-related pure functions
};

// External integration (imperative shell)
const JobIntegration = {
  saveJob: async (job) => {
    // Handles database interaction
    return await database.jobs.insert(job);
  },
  
  notifyJobStatusChange: async (job) => {
    // Handles notifications via external systems
    return await notificationService.notify(job.id, job.status);
  }
};
```

### Document Processing Domain

Similarly, organize document processing functions around the document domain:

```javascript
// Pure document transformation functions
const DocumentProcessing = {
  extractTextFromDocument: (document) => {
    // Pure function that transforms document data
    return {
      documentId: document.id,
      extractedText: performTextExtraction(document.content),
      metadata: extractMetadata(document)
    };
  },
  
  analyzeDocument: (documentWithText) => {
    // Pure analysis function
    return {
      ...documentWithText,
      analysis: performAnalysis(documentWithText.extractedText)
    };
  }
};

// External integration
const DocumentIntegration = {
  fetchDocument: async (documentUrl) => {
    // Fetches document from storage
    return await storageApi.fetch(documentUrl);
  },
  
  callGeminiForAnalysis: async (documentText) => {
    // Calls external Gemini API
    return await geminiCircuitBreaker.execute(() => 
      geminiApi.analyze(documentText)
    );
  }
};
```

### Deployment Environment

- Cloud Run for hosting the service
- Service account with permissions for Vertex AI and Firebase
- Auto-scaling managed by Cloud Run

## Functional Requirements

### Job Processing

1. **Job Types**
   - Initially support PDF processing with Google Gemini 1.5 Pro
   - Abstraction layer to support additional job types in the future

2. **Job Lifecycle**
   - Creation: Jobs are submitted via API endpoints
   - Scheduling: Jobs can be scheduled for immediate or future execution
   - Processing: Asynchronous execution with status updates
   - Completion: Results stored and made available to users
   - Failure: Comprehensive error information provided

3. **Job Attributes**
   - Job ID
   - User ID
   - Creation time
   - Status (pending, processing, completed, failed)
   - Scheduled execution time
   - Input parameters/files
   - Results/output location
   - Error messages
   - Retry count/history
   - Job-specific metadata

### PDF Processing Workflow

1. Accept PDF documents from front-end
2. Store PDFs in Google Cloud Storage
3. Process with Gemini 1.5 Pro model
4. Extract and save information
5. Make results available to the front-end

### Error Handling and Retries

1. **Automatic Retry**
   - Jobs that fail due to transient errors are automatically retried
   - Exponential backoff to prevent system overload
   - Configurable maximum retry limit

2. **Error Classification**
   - Different error types have different retry strategies
   - Permanent errors are marked as failed immediately

3. **Error Reporting**
   - Structured error information (code, message, context)
   - Retry information for retryable errors
   - Detailed diagnostic information for debugging

## API Endpoints

### Job Submission Endpoints

1. **POST /api/v1/jobs**
   - Generic endpoint for creating a new job
   - Accepts job type, parameters, priority, and scheduling information
   - Returns job ID and status URL for polling

2. **POST /api/v1/pdf-processing**
   - Specialized endpoint for PDF processing jobs
   - Accepts PDF file upload, processing parameters, and optional scheduling
   - Stores the PDF in Google Cloud Storage and creates a processing job

### Job Management Endpoints

1. **GET /api/v1/jobs**
   - List jobs for the authenticated user
   - Supports filtering by status, type, and time range
   - Includes pagination and sorting options

2. **GET /api/v1/jobs/{jobId}**
   - Retrieve detailed information about a specific job
   - Includes complete metadata, status, and results if available

3. **DELETE /api/v1/jobs/{jobId}**
   - Cancel a job that hasn't started processing
   - Updates job status to cancelled

4. **PUT /api/v1/jobs/{jobId}/retry**
   - Manually trigger retry for a failed job
   - Resets retry count and schedules for immediate execution

### Status Polling Endpoint

1. **GET /api/v1/jobs/{jobId}/status**
   - Lightweight endpoint for checking job status
   - Returns current status, progress information, and results when complete
   - Designed for efficient polling from frontend applications

## Authentication and Authorization

1. **Authentication**
   - Entra ID (Azure) authentication
   - Tokens passed from front-end to service

2. **Authorization**
   - Users can only access their own jobs
   - Service runs with a service account that has permissions for Vertex AI and Firebase

## Data Persistence

1. **Job Records**
   - Stored in Firebase indefinitely
   - Users control what to keep or delete

2. **File Storage**
   - PDFs and other files stored in Google Cloud Storage
   - Relies on GCS mechanisms for backup, cleanup, and archival

## Monitoring and Observability

### Logging

1. **DEBUG Level**
   - Detailed information about program execution

2. **INFO Level**
   - User actions and system operations
   - Job state transitions
   - Normal operational events

3. **WARN Level**
   - Potential issues (slow DB calls, cache capacity warnings)

4. **ERROR Level**
   - All error conditions with detailed context
   - Failed job information including input parameters and point of failure

### Metrics

1. **Job Lifecycle Events**
   - Track created, started, completed, failed, stalled events
   - Pre-aggregate common calculations for dashboard efficiency

2. **Observability Stack**
   - Prometheus and Grafana integration
   - Metrics exporters and scrapers

## Scaling and Performance

1. **Concurrency**
   - Configurable number of concurrent jobs
   - Cloud Run manages scaling behavior and resource allocation

2. **Job Throughput**
   - Variable and dependent on external services
   - No specific throughput guarantees

## Implementation Considerations

### Functional Programming Approach

1. **Pure Functions**
   - Minimize side effects
   - Separate data transformation from I/O operations

2. **Immutable Data**
   - Use immutable data structures
   - Avoid shared mutable state

3. **Function Composition**
   - Build complex operations from simple functions
   - Use higher-order functions for abstraction

### Code Organization

1. **Core Domain Logic**
   - Job processing pipeline
   - Error handling and retry logic

2. **Infrastructure Layer**
   - API endpoints
   - Authentication and authorization
   - Storage integration

3. **Integration Layer**
   - External service clients (Vertex AI, Firebase, etc.)

## Future Extensibility

The service is designed with an abstraction layer to support additional use cases in the future:

1. **Additional Job Types**
   - BigQuery data transformations
   - Other AI model integrations
   - Custom data processing pipelines

2. **Queue Categories**
   - Support for different job categories
   - Potential for priority-based processing in the future
