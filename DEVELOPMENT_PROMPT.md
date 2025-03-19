# CloudCall Development Prompt Guide

This document provides guidance for development teams working on the CloudCall virtual phone system. Use these prompts to efficiently develop, debug, and enhance the system.

## Architecture Planning

```
Create a high-level system architecture diagram for CloudCall, showing the relationships between:
- Frontend applications (web, mobile, desktop)
- Backend services (auth, calls, messaging, etc.)
- Database systems
- Third-party APIs (Twilio, CRM integrations)
- Caching and message queues
- Deployment infrastructure

Include data flow patterns and highlight scalability considerations.
```

## Backend Development

### API Design

```
Design RESTful API endpoints for [feature], including:
- Endpoint paths and HTTP methods
- Request parameters and validation rules
- Response schemas with examples
- Error handling approach
- Authentication and authorization requirements
- Rate limiting considerations

The API should follow our standard practices for versioning and documentation.
```

### Twilio Integration

```
Implement the following Twilio integration for [calls/messaging/number purchasing]:
- Required Twilio API endpoints and authentication
- Webhook handlers for [specific events]
- Error handling and retry mechanisms
- Cost optimization strategies
- Testing approach with Twilio test credentials

Include examples of the request/response payloads and handling edge cases.
```

### Database Schemas

```
Design database schemas for the following entities in our MongoDB database:
- [Entity name(s)]

For each entity, include:
- Field names, types, and validations
- Indexes for performance optimization
- Relationships to other entities
- Example documents
- Considerations for querying patterns
```

## Frontend Development

### Component Development

```
Create a React component for [specific feature] with the following requirements:
- Props interface with TypeScript types
- State management approach
- User interactions and event handlers
- Error handling and loading states
- Responsive design considerations
- Accessibility requirements
- Unit test coverage

Include sample usage examples and storybook documentation.
```

### State Management

```
Design the Redux state management for [feature area], including:
- Slice structure
- Action creators
- Reducers
- Selectors
- Async thunks for API integration
- Error handling approach

Demonstrate usage patterns and provide examples of component integration.
```

## Mobile Development

```
Implement the following screen in React Native for the CloudCall mobile app:
- [Screen name and purpose]
- UI components needed
- Navigation flow
- Platform-specific considerations (iOS vs Android)
- Performance optimization strategies
- Offline support approach

Include mockups and interaction specifications.
```

## Testing

```
Develop a comprehensive test plan for [feature], including:
- Unit tests for critical business logic
- Integration tests for API endpoints
- End-to-end tests for user flows
- Performance testing scenarios
- Security testing considerations
- Mock data requirements

Specify testing tools and frameworks to be used.
```

## DevOps

```
Create a CI/CD pipeline for CloudCall with the following stages:
- Code linting and static analysis
- Unit and integration testing
- Build process for frontend and backend
- Containerization strategy
- Deployment to staging environment
- Automated testing in staging
- Approval process for production deployment
- Production deployment strategy
- Monitoring and alerting setup

Include necessary configuration files and scripts.
```

## Feature Implementation

### Implementing Call Recording

```
Implement the call recording feature for CloudCall with the following requirements:
- Recording initiation and termination via Twilio
- Secure storage of recordings with appropriate retention policies
- Access control for recordings based on user permissions
- Playback interface in the web and mobile apps
- Transcription service integration
- Export functionality

Include technical approach, API design, and frontend implementation details.
```

### SMS Template System

```
Design and implement an SMS template system with the following capabilities:
- Template creation and management in the admin interface
- Variable substitution for personalization
- Template categories and search
- Version history
- Usage analytics
- Template sharing across team members

Provide the database schema, API endpoints, and frontend component designs.
```

### Analytics Dashboard

```
Design and implement an analytics dashboard for call and messaging metrics:
- Key performance indicators to display
- Filtering and date range selection
- Data visualization components (charts, tables)
- Export functionality
- Scheduled reports
- Real-time updates for active metrics

Include data aggregation strategy, caching approach, and frontend implementation details.
```

## Debugging and Optimization

```
The [specific feature] is experiencing [performance issue/bug]. Develop a plan to:
1. Diagnose the root cause
2. Implement a fix with minimal service disruption
3. Verify the solution
4. Prevent similar issues in the future

Include monitoring tools to use, logging strategies, and potential bottlenecks to investigate.
```

## Security

```
Conduct a security assessment of the CloudCall system, focusing on:
- Authentication and authorization mechanisms
- Data encryption in transit and at rest
- PII and call recording protection
- API security
- Frontend security best practices
- Infrastructure security
- Compliance with relevant regulations (GDPR, CCPA, etc.)

Identify potential vulnerabilities and recommend mitigations.
```

## Documentation

```
Create comprehensive documentation for the CloudCall API, including:
- Authentication process
- Available endpoints with request/response examples
- Error codes and handling
- Rate limiting policies
- Webhook integration
- SDK usage examples
- Best practices for integration

The documentation should be suitable for both internal developers and external partners.
```

## Integration Development

```
Design and implement integration with [CRM/helpdesk system], including:
- Authentication flow
- Data synchronization strategy
- Call and message logging in the external system
- Contact synchronization
- Activity tracking
- Configuration options for administrators

Provide API designs, database schema updates, and frontend configuration interfaces.
```

This comprehensive prompt guide serves as a reference for development teams to maintain consistency, quality, and efficiency throughout the CloudCall development lifecycle. Adapt these prompts as needed for specific project requirements and team workflows.
