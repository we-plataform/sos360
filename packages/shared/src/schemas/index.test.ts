import { describe, it, expect } from 'vitest';
import { registerSchema } from './index';

describe('Password Validation', () => {
  describe('Special Character Requirement', () => {
    it('rejects password without special characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123', // No special character
        fullName: 'Test User',
        companyName: 'Test Company',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map(e => e.message);
        expect(errorMessages).toContain('Senha deve conter pelo menos um caractere especial');
      }
    });

    it('accepts password with special character', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'SecureP@ss123', // Has special character, not in breached list
        fullName: 'Test User',
        companyName: 'Test Company',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Breached Password Detection', () => {
    it('rejects commonly breached passwords', async () => {
      // Common passwords from known breaches (top of HaveIBeenPwned list)
      const breachedPasswords = [
        'Password123!',
        '12345678Aa@',
        'Welcome1!',
      ];

      for (const password of breachedPasswords) {
        const result = registerSchema.safeParse({
          email: 'test@example.com',
          password,
          fullName: 'Test User',
          companyName: 'Test Company',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          const errorMessages = result.error.errors.map(e => e.message);
          expect(errorMessages).toContain('Esta senha foi exposta em vazamentos de dados. Por favor, escolha outra senha.');
        }
      }
    });

    it('accepts strong, unique passwords', async () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Tr0ub4dor&3', // Unique, strong password
        fullName: 'Test User',
        companyName: 'Test Company',
      });

      expect(result.success).toBe(true);
    });
  });
});
