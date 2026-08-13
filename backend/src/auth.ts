import {
  getAuth,
} from "firebase-admin/auth";

import type {
  UserRepository,
} from "./user-repository.js";

import {
  getFirebaseApp,
} from "./fcm-firebase.js";

export interface AuthContext {
  userId: string;
  firebaseUid: string;
}

export interface AuthProvider {
  authenticate(request: {
    headers: Record<
      string,
      string | string[] | undefined
    >;
  }): Promise<AuthContext>;
}

export class FirebaseAuthProvider
  implements AuthProvider
{
  constructor(
    private readonly users: UserRepository
  ) {}

  async authenticate(
    request: {
      headers: Record<
        string,
        string | string[] | undefined
      >;
    }
  ): Promise<AuthContext> {
    const authorization =
      request.headers[
        "authorization"
      ];

    const value =
      Array.isArray(authorization)
        ? authorization[0]
        : authorization;

    if (!value) {
      throw new Error(
        "UNAUTHENTICATED"
      );
    }

    const match =
      /^Bearer\s+(.+)$/i.exec(value);

    if (!match?.[1]) {
      throw new Error(
        "UNAUTHENTICATED"
      );
    }

    const token =
      match[1].trim();

    if (!token) {
      throw new Error(
        "UNAUTHENTICATED"
      );
    }

    try {
      const decoded =
        await getAuth(
          getFirebaseApp()
        ).verifyIdToken(token);

      const firebaseUid =
        decoded.uid;

      const user =
        await this.users
          .createOrGetByFirebaseUid(
            firebaseUid
          );

      return {
        userId: user.id,
        firebaseUid,
      };
    } catch (error) {
      console.error(
        "Firebase authentication failed",
        error
      );

      throw new Error(
        "UNAUTHENTICATED"
      );
    }
  }
}