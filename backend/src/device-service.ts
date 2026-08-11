import type {
  Device,
  DeviceRepository,
} from "./device-repository.js";

export class DeviceServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export class DeviceService {
  constructor(
    private readonly repository: DeviceRepository
  ) {}

  async register(
    userId: string,
    input: {
      platform: "android";
      token: string;
    }
  ): Promise<Device> {
    const token = input.token.trim();

    if (!token) {
      throw new DeviceServiceError(
        "INVALID_DEVICE_TOKEN",
        "Device token is required.",
        400
      );
    }

    if (input.platform !== "android") {
      throw new DeviceServiceError(
        "INVALID_DEVICE_PLATFORM",
        "Only Android devices are supported.",
        400
      );
    }

    return this.repository.register(
      userId,
      input.platform,
      token
    );
  }

  async invalidate(
    userId: string,
    deviceId: string
  ): Promise<Device> {
    const device =
      await this.repository.invalidate(
        deviceId,
        userId
      );

    if (!device) {
      throw new DeviceServiceError(
        "DEVICE_NOT_FOUND",
        "Device not found or is already invalidated.",
        404
      );
    }

    return device;
  }

  async list(
    userId: string
  ): Promise<Device[]> {
    return this.repository.listForUser(
      userId
    );
  }

  response(device: Device) {
    return {
      id: device.id,
      platform: device.platform,
      registeredAt:
        device.createdAt.toISOString(),
      invalidatedAt:
        device.invalidatedAt?.toISOString() ??
        null,
    };
  }
}