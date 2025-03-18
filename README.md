# CloudCall - Virtual Phone System

CloudCall is a comprehensive cloud-based phone system designed for sales and support teams, similar to JustCall. This platform enables businesses to make and receive calls, send and receive SMS, set up IVR systems, and integrate with popular CRM tools.

## Features

- **Virtual Phone Numbers**: Local and toll-free numbers in 70+ countries
- **Voice Calling**: Make and receive calls from web and mobile apps
- **SMS/MMS**: Two-way messaging with media support
- **Call Management**: IVR, call routing, transferring, recording
- **Team Collaboration**: Shared inbox, call assignment, notes
- **Analytics**: Call metrics, team performance, custom reports
- **CRM Integration**: Seamless connection with popular CRM platforms
- **API Access**: Build custom integrations with our robust API

## Project Structure

```
cloudcall/
├── backend/                 # Backend services
│   ├── auth/                # Authentication service
│   ├── calls/               # Call processing service
│   ├── messaging/           # SMS/MMS service
│   ├── numbers/             # Phone number management
│   └── analytics/           # Reporting and analytics
├── frontend/
│   ├── web/                 # Web dashboard (React)
│   ├── mobile/              # Mobile apps (React Native)
│   │   ├── android/
│   │   └── ios/
│   └── desktop/             # Electron desktop app
├── infrastructure/          # IaC and deployment scripts
├── docs/                    # Documentation
│   ├── api/                 # API documentation
│   ├── wireframes/          # UI/UX design files
│   └── architecture/        # System architecture docs
└── integrations/            # Third-party integration modules
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose
- Twilio account (or alternative VoIP provider)
- AWS account (or alternative cloud provider)

### Local Development Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/cloudcall.git
cd cloudcall
```

2. Install dependencies
```bash
# Backend
cd backend
npm install

# Frontend web
cd ../frontend/web
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development servers
```bash
# In one terminal (backend)
cd backend
npm run dev

# In another terminal (frontend)
cd frontend/web
npm start
```

5. Access the application at http://localhost:3000

## Development Guidelines

- Follow the Git workflow outlined in CONTRIBUTING.md
- Write unit tests for all new features
- Update documentation when changing functionality
- Follow the established code style (enforced by linters)

## Deployment

The application can be deployed using Docker containers to any cloud provider. See the detailed deployment guide in `docs/deployment.md`.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Twilio for telephony infrastructure
- React and Node.js communities for excellent tools and libraries
