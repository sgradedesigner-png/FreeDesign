import { ZodError, ZodSchema, ZodIssue } from 'zod';
import { FastifyReply } from 'fastify';

/**
 * Validation Helper
 * Validates data against a Zod schema and returns formatted error response
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply?: FastifyReply
): { success: true; data: T } | { success: false; error: any } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = {
        error: 'Validation failed',
        details: error.issues.map((e: ZodIssue) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      };

      if (reply) {
        reply.code(400).send(formattedErrors);
      }

      return { success: false, error: formattedErrors };
    }

    throw error;
  }
}

/**
 * Async version of validateData
 * For use with async validation schemas
 */
export async function validateDataAsync<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply?: FastifyReply
): Promise<{ success: true; data: T } | { success: false; error: any }> {
  try {
    const validatedData = await schema.parseAsync(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = {
        error: 'Validation failed',
        details: error.issues.map((e: ZodIssue) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      };

      if (reply) {
        reply.code(400).send(formattedErrors);
      }

      return { success: false, error: formattedErrors };
    }

    throw error;
  }
}

/**
 * Sanitize string input
 * Prevents XSS by stripping HTML tags
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, ''); // Remove < and > characters
}

/**
 * Sanitize object recursively
 * Applies sanitizeString to all string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value) as any;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item: any) =>
          typeof item === 'string' ? sanitizeString(item) :
          typeof item === 'object' && item !== null ? sanitizeObject(item) :
          item
        ) as any;
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}
