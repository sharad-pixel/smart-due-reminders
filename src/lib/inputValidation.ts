import { z } from 'zod';

/**
 * Centralized input validation utilities for all data entry points
 * Implements industry-standard validation patterns
 */

// Common validation schemas
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" })
  .transform(val => val.toLowerCase());

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name is required" })
  .max(100, { message: "Name must be less than 100 characters" })
  .regex(/^[a-zA-Z\s\-'.]+$/, { message: "Name contains invalid characters" });

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Company name is required" })
  .max(200, { message: "Company name must be less than 200 characters" });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s\-+()]+$/, { message: "Invalid phone number format" })
  .min(7, { message: "Phone number too short" })
  .max(20, { message: "Phone number too long" })
  .optional()
  .or(z.literal(''));

export const messageSchema = z
  .string()
  .trim()
  .min(1, { message: "Message is required" })
  .max(5000, { message: "Message must be less than 5000 characters" });

export const urlSchema = z
  .string()
  .trim()
  .url({ message: "Invalid URL" })
  .max(2048, { message: "URL too long" })
  .optional()
  .or(z.literal(''));

export const amountSchema = z
  .number()
  .min(0.01, { message: "Amount must be greater than 0" })
  .max(999999999.99, { message: "Amount exceeds maximum allowed" });

export const invoiceNumberSchema = z
  .string()
  .trim()
  .min(1, { message: "Invoice number is required" })
  .max(100, { message: "Invoice number too long" })
  .regex(/^[a-zA-Z0-9\-_#]+$/, { message: "Invoice number contains invalid characters" });

// Password validation (NIST compliant)
export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(128, { message: "Password must be less than 128 characters" })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" })
  .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character" });

// Contact form schema
export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  company: companyNameSchema,
  message: messageSchema,
  // Honeypot field - should always be empty
  website: z.string().max(0, { message: "Invalid submission" }).optional(),
});

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required" }),
  // Honeypot
  username: z.string().max(0).optional(),
});

// Signup form schema
export const signupFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  company: companyNameSchema.optional(),
  password: passwordSchema,
  confirmPassword: z.string(),
  // Honeypot
  referral_code: z.string().max(0).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Invoice form schema
export const invoiceFormSchema = z.object({
  invoice_number: invoiceNumberSchema,
  amount: amountSchema,
  due_date: z.string().min(1, { message: "Due date is required" }),
  debtor_id: z.string().uuid({ message: "Invalid account" }),
  description: z.string().max(1000).optional(),
});

// Debtor/Account form schema
export const accountFormSchema = z.object({
  name: nameSchema,
  company_name: companyNameSchema.optional(),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().max(500).optional(),
});

// AI command input schema
export const aiCommandSchema = z
  .string()
  .trim()
  .min(3, { message: "Command too short" })
  .max(2000, { message: "Command must be less than 2000 characters" })
  .refine(val => !containsSqlInjection(val), { message: "Invalid input detected" })
  .refine(val => !containsXss(val), { message: "Invalid input detected" });

// File upload validation
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = {
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  spreadsheets: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
};

export function validateFile(
  file: File, 
  allowedTypes: (keyof typeof ALLOWED_FILE_TYPES)[] = ['documents', 'spreadsheets', 'images'],
  maxSize: number = MAX_FILE_SIZE
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit` };
  }
  
  const allowedMimeTypes = allowedTypes.flatMap(type => ALLOWED_FILE_TYPES[type]);
  if (!allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  // Check for suspicious file extensions
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs', '.ps1', '.sh'];
  if (suspiciousExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  return { valid: true };
}

// SQL injection detection (basic patterns)
function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--|\/\*|\*\/|;|'|".*=.*"|1\s*=\s*1)/i,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  ];
  return sqlPatterns.some(pattern => pattern.test(input));
}

// XSS detection (basic patterns)
function containsXss(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  return xssPatterns.some(pattern => pattern.test(input));
}

// Sanitize text input (removes potentially dangerous content)
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

// Sanitize for URL parameters
export function sanitizeForUrl(input: string): string {
  return encodeURIComponent(sanitizeText(input));
}

// Validate and sanitize bulk data (for imports)
export function validateBulkData<T>(
  data: unknown[],
  schema: z.ZodSchema<T>,
  maxRows: number = 10000
): { valid: T[]; errors: { row: number; error: string }[] } {
  const valid: T[] = [];
  const errors: { row: number; error: string }[] = [];
  
  if (data.length > maxRows) {
    errors.push({ row: 0, error: `Maximum ${maxRows} rows allowed per import` });
    return { valid, errors };
  }
  
  data.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: index + 1,
        error: result.error.errors.map(e => e.message).join(', '),
      });
    }
  });
  
  return { valid, errors };
}
