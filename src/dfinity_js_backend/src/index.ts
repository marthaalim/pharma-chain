import { verify } from "@dfinity/agent";
import { auto } from "@popperjs/core";
import {
  query,
  update,
  text,
  Null,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  None,
  Some,
  Ok,
  Err,
  ic,
  Principal,
  Opt,
  nat64,
  Duration,
  Result,
  bool,
  Canister,
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Enums
const UserRole = Variant({
  Admin: Null,
  Manufacturer: Null,
  Distributor: Null,
  Viewer: Null,
});

const SupplyChainEventType = Variant({
  Production: Null,
  Packaging: Null,
  Storage: Null,
  Transportation: Null,
  Delivery: Null,
  QualityControl: Null,
  TemperatureExcursion: Null,
  RecallInitiated: Null,
});

const RewardType = Variant({
  SupplyChainEvent: Null,
  QualityReport: Null,
  RecallManagement: Null,
  Other: Null,
});

// Record Types
const User = Record({
  id: text,
  username: text,
  role: UserRole,
  points: nat64,
});

const Pharmaceutical = Record({
  id: text,
  userId: text,
  name: text,
  manufacturer: text,
  batchNumber: text,
  expiryDate: nat64,
});

const SupplyChainEvent = Record({
  id: text,
  pharmaceuticalId: text,
  eventType: SupplyChainEventType,
  location: text,
  date: nat64,
  participantId: text,
});

const Reward = Record({
  id: text,
  participantId: text,
  points: nat64,
  rewardType: RewardType,
});

const QualityCheck = Record({
  id: text,
  pharmaceuticalId: text,
  temperature: nat64,
  humidity: nat64,
  inspectorId: text,
  passed: bool,
  notes: text,
  timestamp: nat64,
});

const RecallAlert = Record({
  id: text,
  pharmaceuticalId: text,
  severity: text,
  reason: text,
  initiatedBy: text,
  initiatedDate: nat64,
  affectedBatches: Vec(text),
  status: text,
});

const TemperatureLog = Record({
  id: text,
  pharmaceuticalId: text,
  temperature: nat64,
  timestamp: nat64,
  location: text,
  isExcursion: bool,
});

// Payload Types
const UserPayload = Record({
  username: text,
  role: UserRole,
});

const PharmaceuticalPayload = Record({
  name: text,
  userId: text,
  manufacturer: text,
  batchNumber: text,
  expiryDate: nat64,
});

const SupplyChainEventPayload = Record({
  pharmaceuticalId: text,
  eventType: SupplyChainEventType,
  location: text,
  participantId: text,
});

const RewardPayload = Record({
  participantId: text,
  points: nat64,
  rewardType: RewardType,
});

const QualityCheckPayload = Record({
  pharmaceuticalId: text,
  temperature: nat64,
  humidity: nat64,
  inspectorId: text,
  passed: bool,
  notes: text,
});

const TemperatureLogPayload = Record({
  pharmaceuticalId: text,
  temperature: nat64,
  location: text,
});

const RecallAlertPayload = Record({
  initiatedBy: text,
  pharmaceuticalId: text,
  severity: text,
  reason: text,
  affectedBatches: Vec(text),
});

const QualityMetricsResponse = Record({
  totalChecks: nat64,
  passRate: nat64,
  averageTemperature: nat64,
  averageHumidity: nat64,
});

// Error Type
const Error = Variant({
  NotFound: text,
  InvalidPayload: text,
  Unauthorized: text,
  ValidationError: text,
  TemperatureExcursion: text,
});

// Storage
const usersStorage = StableBTreeMap(0, text, User);
const pharmaceuticalsStorage = StableBTreeMap(1, text, Pharmaceutical);
const supplyChainEventsStorage = StableBTreeMap(2, text, SupplyChainEvent);
const rewardsStorage = StableBTreeMap(3, text, Reward);
const qualityChecksStorage = StableBTreeMap(4, text, QualityCheck);
const recallAlertsStorage = StableBTreeMap(5, text, RecallAlert);
const temperatureLogsStorage = StableBTreeMap(6, text, TemperatureLog);

export default Canister({
  // User Management
  createUser: update([UserPayload], Result(User, Error), (payload) => {
    if (!payload.username) {
      return Err({ InvalidPayload: "Username is required" });
    }

    // Ensure username is unique
    const existingUser = usersStorage
      .values()
      .find((user) => user.username === payload.username);

    if (existingUser) {
      return Err({
        ValidationError: "Username already exists, try another one",
      });
    }

    const userId = uuidv4();
    const user = {
      id: userId,
      username: payload.username,
      role: payload.role,
      points: 0n,
    };

    usersStorage.insert(userId, user);
    return Ok(user);
  }),

  getUserById: query([text], Result(User, Error), (userId) => {
    const userOpt = usersStorage.get(userId);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${userId} not found` });
    }
    return Ok(userOpt.Some);
  }),

  getUsersByRole: query([UserRole], Result(Vec(User), Error), (role) => {
    const users = usersStorage
      .values()
      .filter((user) => JSON.stringify(user.role) === JSON.stringify(role));

    if (users.length === 0) {
      return Err({ NotFound: "No users found with the specified role" });
    }
    return Ok(users);
  }),

  // Pharmaceutical Management
  createPharmaceutical: update(
    [PharmaceuticalPayload],
    Result(Pharmaceutical, Error),
    (payload) => {
      if (!payload.name || !payload.manufacturer || !payload.batchNumber) {
        return Err({ InvalidPayload: "All fields are required" });
      }

      // Validate user ID
      const userOpt1 = usersStorage.get(payload.userId);

      if ("None" in userOpt1) {
        return Err({ NotFound: `User with ID ${payload.userId} not found` });
      }

      // Verify user is admin
      const userOpt = usersStorage.get(payload.userId);
      if ("None" in userOpt || !("Admin" in userOpt.Some.role)) {
        return Err({ Unauthorized: "Only admins can create pharmaceuticals" });
      }

      const id = uuidv4();
      const pharmaceutical = {
        id,
        userId: payload.userId,
        name: payload.name,
        manufacturer: payload.manufacturer,
        batchNumber: payload.batchNumber,
        expiryDate: payload.expiryDate,
      };

      pharmaceuticalsStorage.insert(id, pharmaceutical);
      return Ok(pharmaceutical);
    }
  ),

  // Supply Chain Event Management
  createSupplyChainEvent: update(
    [SupplyChainEventPayload],
    Result(SupplyChainEvent, Error),
    (payload) => {
      // Validate the payload
      if (
        !payload.pharmaceuticalId ||
        !payload.eventType ||
        !payload.location ||
        !payload.participantId
      ) {
        return Err({
          InvalidPayload: "Ensure all required fields are provided",
        });
      }

      // Validate pharmaceutical ID
      const pharmaceuticalOpt = pharmaceuticalsStorage.get(
        payload.pharmaceuticalId
      );
      if ("None" in pharmaceuticalOpt) {
        return Err({
          NotFound: `Pharmaceutical with ID ${payload.pharmaceuticalId} not found`,
        });
      }

      // Validate participant ID
      const userOpt = usersStorage.get(payload.participantId);

      if ("None" in userOpt) {
        return Err({
          NotFound: `User with ID ${payload.participantId} not found`,
        });
      }

      const id = uuidv4();
      const event = {
        id,
        pharmaceuticalId: payload.pharmaceuticalId,
        eventType: payload.eventType,
        location: payload.location,
        date: ic.time(),
        participantId: payload.participantId,
      };

      supplyChainEventsStorage.insert(id, event);

      // Create reward for participant
      const rewardId = uuidv4();
      const reward = {
        id: rewardId,
        participantId: payload.participantId,
        points: 10n, // Default points
        // Initialize reward type to SupplyChainEvent
        rewardType: { SupplyChainEvent: null },
      };

      // Update user points
      const user = userOpt.Some;

      // Update user points
      user.points += 10n;

      // Update user in storage
      usersStorage.insert(payload.participantId, user);

      // Insert reward into storage
      rewardsStorage.insert(rewardId, reward);

      return Ok(event);
    }
  ),

  // Temperature Log Management
  logTemperature: update(
    [TemperatureLogPayload],
    Result(TemperatureLog, Error),
    (payload) => {
      // Check if temperature is within the acceptable range
      const isExcursion = payload.temperature < 2 || payload.temperature > 8;

      const id = uuidv4();
      const temperatureLog = {
        id,
        pharmaceuticalId: payload.pharmaceuticalId,
        temperature: payload.temperature,
        timestamp: ic.time(),
        location: payload.location,
        isExcursion,
      };

      temperatureLogsStorage.insert(id, temperatureLog);

      if (isExcursion) {
        return Err({ TemperatureExcursion: "Temperature excursion detected" });
      }

      return Ok(temperatureLog);
    }
  ),

  // Analytics
  getQualityMetrics: query([], QualityMetricsResponse, () => {
    const allQualityChecks = qualityChecksStorage.values();
    const totalChecks = allQualityChecks.length;
    let passCount = 0;
    let totalTemperature = 0n;
    let totalHumidity = 0n;

    allQualityChecks.forEach((check) => {
      if (check.passed) passCount++;
      totalTemperature += check.temperature;
      totalHumidity += check.humidity;
    });

    return {
      totalChecks: totalChecks,
      passRate: passCount,
      averageTemperature: totalTemperature / totalChecks.length,
      averageHumidity: totalHumidity / totalChecks.length,
    };
  }),
});
