/**
 * Simple logging utility for the Proxy Agent application.
 * Supports different log levels that can be controlled via environment variables.
 * 
 * Log Levels (in order of severity):
 * - ERROR: Critical errors that need immediate attention
 * - WARN: Warning messages for potentially problematic situations
 * - INFO: General informational messages about application flow
 * - DEBUG: Detailed diagnostic information for debugging
 * 
 * Set LOG_LEVEL environment variable to control verbosity:
 * - error: Only ERROR messages
 * - warn: ERROR and WARN messages
 * - info: ERROR, WARN, and INFO messages (default)
 * - debug: All messages including DEBUG
 */

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    // Default to INFO level, can be overridden by LOG_LEVEL env var
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    
    switch (envLevel) {
      case 'error':
        this.currentLevel = LogLevel.ERROR;
        break;
      case 'warn':
        this.currentLevel = LogLevel.WARN;
        break;
      case 'info':
        this.currentLevel = LogLevel.INFO;
        break;
      case 'debug':
        this.currentLevel = LogLevel.DEBUG;
        break;
      default:
        // Default to INFO for production-ready sample code
        this.currentLevel = LogLevel.INFO;
    }
  }

  /**
   * Log error messages - critical errors that need attention
   */
  error(message: string, ...args: unknown[]): void {
    if (this.currentLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * Log warning messages - potentially problematic situations
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.currentLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log informational messages - general application flow
   */
  info(message: string, ...args: unknown[]): void {
    if (this.currentLevel >= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log debug messages - detailed diagnostic information
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.currentLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

// Export a singleton instance
export const logger = new Logger();
