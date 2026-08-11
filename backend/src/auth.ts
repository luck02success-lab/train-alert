export interface AuthContext { userId: string; }
export interface AuthProvider { authenticate(request: { headers: Record<string, string | string[] | undefined> }): Promise<AuthContext>; }
/** Development-only boundary. Replace with verified production identity before deployment. */
export class DevelopmentHeaderAuthProvider implements AuthProvider { async authenticate(request:{headers:Record<string,string|string[]|undefined>}):Promise<AuthContext>{const value=request.headers["x-user-id"];const userId=Array.isArray(value)?value[0]:value;if(!userId||!/^[0-9a-f-]{36}$/i.test(userId))throw new Error("UNAUTHENTICATED");return {userId};} }
