// This file is designed to be used on both the server and the client.
// It is NOT a client component.

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
  // We cannot include auth information here as it cannot be reliably determined on the server in the same way.
};

interface SecurityRuleRequest {
  auth: null; // Auth object is nulled out as it's not available on the server actions context in the same way
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds the simulated request object for the error message.
 * @param context The context of the failed Firestore operation.
 * @returns A structured request object.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  return {
    auth: null, // This is the key change: auth is not available here.
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

/**
 * Builds the final, formatted error message for the LLM.
 * @param requestObject The simulated request object.
 * @returns A string containing the error message and the JSON payload.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`;
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 * This class can be instantiated on either the server or the client.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}

/**
 * Custom error class for Firestore rate limit errors.
 */
export class FirestoreRateLimitError extends Error {
  constructor(public readonly path: string, public readonly operation: string) {
    super(`Rate limit exceeded for ${operation} operation on ${path}. Please try again later.`);
    this.name = 'FirestoreRateLimitError';
  }
}

/**
 * Type guard to check if an error is a Firestore error with a code property.
 */
export function isFirestoreError(error: any): error is { code: string; message: string } {
  return error && typeof error === 'object' && 'code' in error;
}

/**
 * Checks if the error is a rate limit error from Firestore.
 */
export function isRateLimitError(error: any): boolean {
  return isFirestoreError(error) && error.code === 'resource-exhausted';
}

/**
 * Checks if the error is a permission denied error from Firestore.
 */
export function isPermissionError(error: any): boolean {
  return isFirestoreError(error) && (error.code === 'permission-denied' || error.code === 'unauthenticated');
}
