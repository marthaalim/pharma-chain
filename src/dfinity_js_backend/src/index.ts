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

  // Create Reward with validation
  createReward: update([RewardPayload], Result(Reward, Error), (payload) => {
    // Validate the payload
    if (!payload.participantId || !payload.points || !payload.rewardType) {
      return Err({ InvalidPayload: "Ensure all required fields are provided" });
    }

    // Validate participant ID
    const userOpt = usersStorage.get(payload.participantId);
    if ("None" in userOpt) {
      return Err({
        NotFound: `User with ID ${payload.participantId} not found`,
      });
    }

    const id = uuidv4();
    const reward = {
      id,
      participantId: payload.participantId,
      points: payload.points,
      rewardType: payload.rewardType,
    };

    // Update user points
    const user = userOpt.Some;

    // Update user points
    user.points += payload.points;

    // Update user in storage
    usersStorage.insert(payload.participantId, user);

    // Insert reward into storage
    rewardsStorage.insert(id, reward);
    return Ok(reward);
  }),

  // Querying Functions
  getPharmaceuticalHistory: query(
    [text],
    Result(Vec(SupplyChainEvent), Error),
    (pharmaceuticalId) => {
      const events = supplyChainEventsStorage
        .values()
        .filter((event) => event.pharmaceuticalId === pharmaceuticalId);

      if (events.length === 0) {
        return Err({ NotFound: "No events found for this pharmaceutical" });
      }

      return Ok(events);
    }
  ),

  getAllPharmaceuticals: query([], Result(Vec(Pharmaceutical), Error), () => {
    const pharmaceuticals = pharmaceuticalsStorage.values();
    if (pharmaceuticals.length === 0) {
      return Err({ NotFound: "No pharmaceuticals found" });
    }
    return Ok(pharmaceuticals);
  }),

  getAllSupplyChainEvents: query(
    [],
    Result(Vec(SupplyChainEvent), Error),
    () => {
      const events = supplyChainEventsStorage.values();
      if (events.length === 0) {
        return Err({ NotFound: "No supply chain events found" });
      }
      return Ok(events);
    }
  ),

  getAllRewards: query([], Result(Vec(Reward), Error), () => {
    const rewards = rewardsStorage.values();
    if (rewards.length === 0) {
      return Err({ NotFound: "No rewards found" });
    }
    return Ok(rewards);
  }),

  // Quality Control Functions
  submitQualityCheck: update(
    [QualityCheckPayload],
    Result(QualityCheck, Error),
    (payload) => {
      if (!payload.pharmaceuticalId || !payload.inspectorId) {
        return Err({ InvalidPayload: "Required fields missing" });
      }

      // Validate Pharmaceutical ID
      const pharmaceuticalOpt = pharmaceuticalsStorage.get(
        payload.pharmaceuticalId
      );
      if ("None" in pharmaceuticalOpt) {
        return Err({
          NotFound: `Pharmaceutical with ID ${payload.pharmaceuticalId} not found`,
        });
      }

      // Validate Inspector ID
      const inspectorOpt = usersStorage.get(payload.inspectorId);

      if ("None" in inspectorOpt) {
        return Err({
          NotFound: `User with ID ${payload.inspectorId} not found`,
        });
      }

      const id = uuidv4();
      const qualityCheck = {
        id,
        ...payload,
        timestamp: ic.time(),
      };

      qualityChecksStorage.insert(id, qualityCheck);

      // Create event for quality control
      const eventId = uuidv4();
      const event = {
        id: eventId,
        pharmaceuticalId: payload.pharmaceuticalId,
        eventType: { QualityControl: null },
        location: "Quality Control Lab",
        date: ic.time(),
        participantId: payload.inspectorId,
      };

      supplyChainEventsStorage.insert(eventId, event);

      // Award points for quality check
      if (payload.passed) {
        const rewardId = uuidv4();
        const reward = {
          id: rewardId,
          participantId: payload.inspectorId,
          points: 15n,
          rewardType: { QualityReport: null },
        };

        // Update user points
        const user = inspectorOpt.Some;

        // Update user points
        user.points += 15n;

        // Update user in storage
        usersStorage.insert(payload.inspectorId, user);

        // Insert reward into storage
        rewardsStorage.insert(rewardId, reward);
      }

      return Ok(qualityCheck);
    }
  ),

  // Temperature Monitoring
  logTemperature: update(
    [TemperatureLogPayload],
    Result(TemperatureLog, Error),
    (payload) => {
      const pharmaceuticalOpt = pharmaceuticalsStorage.get(
        payload.pharmaceuticalId
      );
      if ("None" in pharmaceuticalOpt) {
        return Err({ NotFound: "Pharmaceutical not found" });
      }

      const id = uuidv4();
      const isExcursion = payload.temperature > 25n || payload.temperature < 2n;

      const tempLog = {
        id,
        pharmaceuticalId: payload.pharmaceuticalId,
        temperature: payload.temperature,
        timestamp: ic.time(),
        location: payload.location,
        isExcursion,
      };

      temperatureLogsStorage.insert(id, tempLog);

      if (isExcursion) {
        const eventId = uuidv4();
        const event = {
          id: eventId,
          pharmaceuticalId: payload.pharmaceuticalId,
          eventType: { TemperatureExcursion: null },
          location: payload.location,
          date: ic.time(),
          participantId: ic.caller().toString(),
        };
        supplyChainEventsStorage.insert(eventId, event);

        return Err({
          TemperatureExcursion: `Temperature excursion detected: ${payload.temperature}°C`,
        });
      }

      return Ok(tempLog);
    }
  ),

  // Recall Management
  initiateRecall: update(
    [RecallAlertPayload],
    Result(RecallAlert, Error),
    (payload) => {
      // Validate the payload
      if (
        !payload.pharmaceuticalId ||
        !payload.initiatedBy ||
        !payload.severity ||
        !payload.reason ||
        !payload.affectedBatches
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
        return Err({ NotFound: "Pharmaceutical not found" });
      }

      // Validate initiator ID
      const initiatorOpt = usersStorage.get(payload.initiatedBy);
      if ("None" in initiatorOpt) {
        return Err({ NotFound: "Initiator not found" });
      }

      // Validate severity
      if (!["Low", "Medium", "High", "Critical"].includes(payload.severity)) {
        return Err({
          ValidationError:
            "Invalid severity level. Must be Low, Medium, High, or Critical",
        });
      }

      const id = uuidv4();
      const recall = {
        id,
        ...payload,
        initiatedDate: ic.time(),
        status: "Active",
      };

      recallAlertsStorage.insert(id, recall);

      // Create recall event
      const eventId = uuidv4();
      const event = {
        id: eventId,
        pharmaceuticalId: payload.pharmaceuticalId,
        eventType: { RecallInitiated: null },
        location: "System",
        date: ic.time(),
        participantId: payload.initiatedBy,
      };

      supplyChainEventsStorage.insert(eventId, event);

      // Award points for recall management
      const rewardId = uuidv4();
      const reward = {
        id: rewardId,
        participantId: payload.initiatedBy,
        points: 25n,
        rewardType: { RecallManagement: null },
      };

      // Update user points
      const userOpt = usersStorage.get(payload.initiatedBy);

      if ("None" in userOpt) {
        return Err({ NotFound: "User not found" });
      }

      const user = userOpt.Some;

      // Update user points
      user.points += 25n;

      // Update user in storage
      usersStorage.insert(payload.initiatedBy, user);

      // Insert reward into storage
      rewardsStorage.insert(rewardId, reward);

      return Ok(recall);
    }
  ),

  // Analytics Functions
  getQualityMetrics: query(
    [text],
    Result(QualityMetricsResponse, Error),
    (pharmaceuticalId) => {
      const checks = qualityChecksStorage
        .values()
        .filter((check) => check.pharmaceuticalId === pharmaceuticalId);

      if (checks.length === 0) {
        return Err({
          NotFound: "No quality checks found for this pharmaceutical",
        });
      }

      const totalChecks = BigInt(checks.length);
      const passedChecks = BigInt(
        checks.filter((check) => check.passed).length
      );
      const passRate = (passedChecks * 100n) / totalChecks;

      const totalTemp = checks.reduce(
        (sum, check) => sum + check.temperature,
        0n
      );
      const totalHumidity = checks.reduce(
        (sum, check) => sum + check.humidity,
        0n
      );

      return Ok({
        totalChecks,
        passRate,
        averageTemperature: totalTemp / totalChecks,
        averageHumidity: totalHumidity / totalChecks,
      });
    }
  ),

  // Query Functions
  getActiveRecalls: query([], Result(Vec(RecallAlert), Error), () => {
    const recalls = recallAlertsStorage
      .values()
      .filter((recall) => recall.status === "Active");

    if (recalls.length === 0) {
      return Err({ NotFound: "No active recalls found" });
    }
    return Ok(recalls);
  }),

  getTemperatureExcursions: query(
    [text],
    Result(Vec(TemperatureLog), Error),
    (pharmaceuticalId) => {
      const excursions = temperatureLogsStorage
        .values()
        .filter(
          (log) => log.pharmaceuticalId === pharmaceuticalId && log.isExcursion
        );

      if (excursions.length === 0) {
        return Err({ NotFound: "No temperature excursions found" });
      }
      return Ok(excursions);
    }
  ),
});
