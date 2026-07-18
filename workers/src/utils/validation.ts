/**
 * Server-side validation utilities for Cloudflare Workers.
 * 
 * Provides Zod-like schema validation for incoming request payloads.
 * All validation errors return structured responses suitable for API endpoints.
 * 
 * @example
 * ```typescript
 * const schema = {
 *   id: v.string().required(),
 *   email: v.string().email().required(),
 *   amount: v.number().positive().required()
 * };
 * 
 * const result = validate(schema, requestBody);
 * if (!result.success) {
 *   return new Response(JSON.stringify(result.errors), { status: 422 });
 * }
 * ```
 */

/**
 * Validation error details.
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result type.
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Validator function type.
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>;

/**
 * String validator.
 */
export const string = (): Validator<string> => (value) => {
  if (typeof value === 'string') {
    return { success: true, data: value };
  }
  return {
    success: false,
    errors: [{ field: 'value', message: 'Must be a string', value }],
  };
};

/**
 * Number validator.
 */
export const number = (): Validator<number> => (value) => {
  if (typeof value === 'number' && !isNaN(value)) {
    return { success: true, data: value };
  }
  return {
    success: false,
    errors: [{ field: 'value', message: 'Must be a number', value }],
  };
};

/**
 * Boolean validator.
 */
export const boolean = (): Validator<boolean> => (value) => {
  if (typeof value === 'boolean') {
    return { success: true, data: value };
  }
  return {
    success: false,
    errors: [{ field: 'value', message: 'Must be a boolean', value }],
  };
};

/**
 * Email validator.
 */
export const email = (): Validator<string> => (value) => {
  if (typeof value !== 'string') {
    return {
      success: false,
      errors: [{ field: 'value', message: 'Must be a string', value }],
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(value)) {
    return { success: true, data: value };
  }

  return {
    success: false,
    errors: [{ field: 'value', message: 'Must be a valid email address', value }],
  };
};

/**
 * UUID validator.
 */
export const uuid = (): Validator<string> => (value) => {
  if (typeof value !== 'string') {
    return {
      success: false,
      errors: [{ field: 'value', message: 'Must be a string', value }],
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(value)) {
    return { success: true, data: value };
  }

  return {
    success: false,
    errors: [{ field: 'value', message: 'Must be a valid UUID', value }],
  };
};

/**
 * Array validator.
 */
export const array = <T>(
  itemValidator: Validator<T>
): Validator<unknown[]> => (value) => {
  if (!Array.isArray(value)) {
    return {
      success: false,
      errors: [{ field: 'value', message: 'Must be an array', value }],
    };
  }

  const errors: ValidationError[] = [];
  const validatedItems: T[] = [];

  for (let i = 0; i < value.length; i++) {
    const itemResult = itemValidator(value[i]);
    if (!itemResult.success) {
      errors.push({
        field: `[${i}]`,
        message: itemResult.errors?.[0].message || 'Invalid item',
        value: value[i],
      });
    } else if (itemResult.data !== undefined) {
      validatedItems.push(itemResult.data);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validatedItems };
};

/**
 * Object validator.
 */
export const object = <T extends Record<string, unknown>>(
  schema: Record<keyof T, Validator<unknown>>
): Validator<T> => (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      success: false,
      errors: [{ field: 'value', message: 'Must be an object', value }],
    };
  }

  const errors: ValidationError[] = [];
  const validatedData: Record<string, unknown> = {};

  for (const [key, validator] of Object.entries(schema)) {
    const fieldValue = (value as Record<string, unknown>)[key];
    const result = validator(fieldValue);

    if (!result.success) {
      errors.push({
        field: key as string,
        message: result.errors?.[0].message || 'Invalid value',
        value: fieldValue,
      });
    } else if (result.data !== undefined) {
      validatedData[key] = result.data;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validatedData as T };
};

/**
 * Optional validator wrapper.
 */
export const optional = <T>(validator: Validator<T>): Validator<T | undefined> => (
  value
) => {
  if (value === undefined || value === null) {
    return { success: true, data: undefined };
  }
  return validator(value);
};

/**
 * Validates data against a schema.
 * 
 * @template T - The expected data type
 * @param schema - The validation schema
 * @param data - The data to validate
 * @returns A ValidationResult containing validated data or errors
 */
export function validate<T>(
  schema: Validator<T>,
  data: unknown
): ValidationResult<T> {
  return schema(data);
}

/**
 * Yoco webhook payload validator schema.
 */
export const yocoWebhookSchema = object({
  id: required(string()),
  type: required(string()),
  data: required(object({
    id: required(string()),
    amount: required(number()),
    currency: required(string()),
    status: required(string()),
    metadata: optional(object({})),
  })),
});

/**
 * Download request validator schema.
 */
export const downloadRequestSchema = object({
  songId: required(string()),
});

/**
 * Helper to add .required() to validators.
 */
export function required<T>(validator: Validator<T>): Validator<T> {
  return (value) => {
    if (value === undefined || value === null || value === '') {
      return {
        success: false,
        errors: [{ field: 'value', message: 'This field is required', value }],
      };
    }
    return validator(value);
  };
}
