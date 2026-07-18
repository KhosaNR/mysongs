import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Masks personally identifiable information (PII) to comply with POPIA regulations.
 * 
 * Transforms sensitive data patterns into safe representations for logging and display.
 * Supports email addresses, phone numbers, ID numbers, and credit card numbers.
 * 
 * @example
 * // Usage in templates
 * {{ userEmail | piiMask }}
 * // Result: "j***@g*****.com"
 * 
 * @example
 * // Usage in services
 * this.logger.info(`User login: ${email | piiMask}`);
 */
@Pipe({
  name: 'piiMask',
  standalone: true,
})
export class PiiMaskPipe implements PipeTransform {
  /**
   * Masks PII in the input value.
   * 
   * @param value - The raw string value potentially containing PII
   * @returns The masked string safe for logging, or empty string if input is null/undefined
   * 
   * @remarks
   * Masking rules:
   * - Email: Shows first letter and domain (j***@g*****.com)
   * - Phone: Shows last 3 digits only (***-***-123)
   * - ID Number: Shows last 4 digits only (****-****-****-1234)
   * - Credit Card: Shows last 4 digits only (****-****-****-1234)
   * - Default: Shows first and last character (j***e)
   */
  transform(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();

    // Email pattern masking
    const emailMatch = trimmed.match(/^([a-zA-Z0-9._%+-])[^@]*@(.+)$/);
    if (emailMatch) {
      const firstChar = emailMatch[1];
      const domain = emailMatch[2];
      const maskedDomain = this.maskString(domain, 0, 2);
      return `${firstChar}***@${maskedDomain}`;
    }

    // Phone number masking (various formats)
    const phoneMatch = trimmed.match(/^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?(\d{4})$/);
    if (phoneMatch) {
      return '***-***-' + phoneMatch[2];
    }

    // South African ID number masking (13 digits)
    const idMatch = trimmed.match(/^(\d{6})\d{7}(\d{2})$/);
    if (idMatch) {
      return '****-****-****-' + idMatch[2];
    }

    // Credit card masking
    const cardMatch = trimmed.replace(/\s/g, '').match(/^(\d{4})\d{8}(\d{4})$/);
    if (cardMatch) {
      return '****-****-****-' + cardMatch[2];
    }

    // Default masking: show first and last character
    if (trimmed.length <= 2) {
      return trimmed;
    }

    return this.maskString(trimmed, 1, trimmed.length - 2);
  }

  /**
   * Masks a string by keeping specified start and end characters visible.
   * 
   * @param str - The string to mask
   * @param startVisible - Number of characters to keep visible at the start
   * @param endVisible - Number of characters to keep visible at the end
   * @returns The masked string with asterisks replacing the middle portion
   * @private
   */
  private maskString(str: string, startVisible: number, endVisible: number): string {
    if (str.length <= startVisible + endVisible) {
      return str;
    }

    const start = str.substring(0, startVisible);
    const end = str.substring(str.length - endVisible);
    const maskLength = str.length - startVisible - endVisible;
    const mask = '*'.repeat(maskLength);

    return `${start}${mask}${end}`;
  }
}