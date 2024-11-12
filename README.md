# Pharmaceutical Supply Chain Management System

A decentralized supply chain management system built on the Internet Computer Protocol (ICP) for tracking pharmaceuticals, managing quality control, and implementing a reward system for participants.

## Features

### 🏛 Core Management
- User management with role-based access control (Admin, Manufacturer, Distributor, Viewer)
- Pharmaceutical product registration and tracking
- Complete supply chain event logging
- Gamified reward system for participants

### 🔍 Quality Control
- Temperature and humidity monitoring
- Quality check submissions and verification
- Automated temperature excursion detection
- Comprehensive quality metrics analysis

### ⚠️ Safety Features
- Real-time temperature monitoring and alerts
- Product recall management system
- Batch tracking and traceability
- Active recall notifications

### 📊 Analytics
- Quality metrics tracking and reporting
- Temperature excursion analysis
- Supply chain event history
- Participant reward tracking

## Technical Architecture

### Data Models

#### User Management
```typescript
const UserRole = Variant({
  Admin: Null,
  Manufacturer: Null,
  Distributor: Null,
  Viewer: Null
});

const User = Record({
  id: text,
  username: text,
  role: UserRole,
  points: nat64
});
```

#### Product Management
```typescript
const Pharmaceutical = Record({
  id: text,
  userId: text,
  name: text,
  manufacturer: text,
  batchNumber: text,
  expiryDate: nat64
});
```

#### Supply Chain Events
```typescript
const SupplyChainEventType = Variant({
  Production: Null,
  Packaging: Null,
  Storage: Null,
  Transportation: Null,
  Delivery: Null,
  QualityControl: Null,
  TemperatureExcursion: Null,
  RecallInitiated: Null
});
```

## API Reference

### User Management

#### Create User
```typescript
createUser: (payload: UserPayload) => Result<User, Error>
```

#### Get User
```typescript
getUserById: (userId: text) => Result<User, Error>
getUsersByRole: (role: UserRole) => Result<Vec<User>, Error>
```

### Pharmaceutical Management

#### Register Pharmaceutical
```typescript
createPharmaceutical: (payload: PharmaceuticalPayload) => Result<Pharmaceutical, Error>
```

#### Track Supply Chain Events
```typescript
createSupplyChainEvent: (payload: SupplyChainEventPayload) => Result<SupplyChainEvent, Error>
```

### Quality Control

#### Submit Quality Check
```typescript
submitQualityCheck: (payload: QualityCheckPayload) => Result<QualityCheck, Error>
```

#### Temperature Monitoring
```typescript
logTemperature: (payload: TemperatureLogPayload) => Result<TemperatureLog, Error>
```

### Recall Management

#### Initiate Recall
```typescript
initiateRecall: (payload: RecallAlertPayload) => Result<RecallAlert, Error>
```

## Setup Instructions

1. Clone the repository
```bash
git clone <repository-url>
cd pharmaceutical-supply-chain
```

2. Install dependencies
```bash
npm install
```

3. Start the local replica
```bash
dfx start --background --clean
```

4. Deploy the canister
```bash
dfx deploy
```

## Development

### Prerequisites
- Node.js (v14 or higher)
- DFINITY Canister SDK
- Internet Computer CLI (dfx)

### Local Development
1. Start the local network
```bash
dfx start --clean --background
```

2. Deploy the canister locally
```bash
dfx deploy
```

3. Stop the local network when done
```bash
dfx stop
```

## Security Considerations

- Role-based access control for different user types
- Temperature excursion monitoring and alerts
- Validation checks for all input data
- Error handling for invalid operations
- Secure storage of sensitive data

## Reward System

The system implements a gamified reward mechanism:
- Supply Chain Event Recording: 10 points
- Quality Check Submission: 15 points
- Recall Management: 25 points

## Error Handling

The system implements comprehensive error handling:
```typescript
const Error = Variant({
  NotFound: text,
  InvalidPayload: text,
  Unauthorized: text,
  ValidationError: text,
  TemperatureExcursion: text
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.