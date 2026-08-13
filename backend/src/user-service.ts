import type {
  User,
  UserRepository,
} from "./user-repository.js";

export class UserService {
  constructor(
    private readonly users: UserRepository
  ) {}

  async create(): Promise<User> {
    return this.users.create();
  }

  async getOrCreateForFirebaseUid(
    firebaseUid: string
  ): Promise<User> {
    return this.users
      .createOrGetByFirebaseUid(
        firebaseUid
      );
  }

  response(user: User) {
    return {
      id: user.id,
      createdAt:
        user.createdAt.toISOString(),
    };
  }
}