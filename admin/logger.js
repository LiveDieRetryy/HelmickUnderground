/**
 * Logging & Monitoring System
 * Provides structured logging, error tracking, and performance monitoring
 */

class Logger {
    constructor(options = {}) {
        this.appName = options.appName || 'HelmickUnderground';
        this.environment = options.environment || this.detectEnvironment();
        this.userId = options.userId || null;
        this.sessionId = this.generateSessionId();
        this.logLevel = options.logLevel || 'info';
        this.maxLogsInMemory = options.maxLogsInMemory || 100;
        this.logs = [];
        this.errorCount = 0;
        this.warningCount = 0;
        
        // Log levels hierarchy
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            fatal: 4
        };
        
        // Performance tracking
        this.performanceMarks = new Map();
        
        // Initialize
        this.init();
    }

    init() {
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Unhandled Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.stack
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });

        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.info('Page Hidden', { timestamp: Date.now() });
            } else {
                this.info('Page Visible', { timestamp: Date.now() });
            }
        });

        // Log initial session
        this.info('Session Started', {
            userAgent: navigator.userAgent,
            screen: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href
        });
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('vercel') || hostname.includes('preview')) {
            return 'staging';
        }
        return 'production';
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    shouldLog(level) {
        return this.levels[level] >= this.levels[this.logLevel];
    }

    createLogEntry(level, message, data = {}) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            appName: this.appName,
            environment: this.environment,
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
    }

    addToMemory(entry) {
        this.logs.push(entry);
        
        // Keep only recent logs in memory
        if (this.logs.length > this.maxLogsInMemory) {
            this.logs.shift();
        }
    }

    /**
     * Debug level logging
     */
    debug(message, data = {}) {
        if (!this.shouldLog('debug')) return;
        
        const entry = this.createLogEntry('debug', message, data);
        console.debug(`[DEBUG] ${message}`, data);
        this.addToMemory(entry);
    }

    /**
     * Info level logging
     */
    info(message, data = {}) {
        if (!this.shouldLog('info')) return;
        
        const entry = this.createLogEntry('info', message, data);
        console.info(`[INFO] ${message}`, data);
        this.addToMemory(entry);
    }

    /**
     * Warning level logging
     */
    warn(message, data = {}) {
        if (!this.shouldLog('warn')) return;
        
        this.warningCount++;
        const entry = this.createLogEntry('warn', message, data);
        console.warn(`[WARN] ${message}`, data);
        this.addToMemory(entry);
        
        // Send to monitoring service in production
        if (this.environment === 'production') {
            this.sendToMonitoring(entry);
        }
    }

    /**
     * Error level logging
     */
    error(message, data = {}) {
        if (!this.shouldLog('error')) return;
        
        this.errorCount++;
        const entry = this.createLogEntry('error', message, data);
        console.error(`[ERROR] ${message}`, data);
        this.addToMemory(entry);
        
        // Always send errors to monitoring
        this.sendToMonitoring(entry);
    }

    /**
     * Fatal error logging (for critical failures)
     */
    fatal(message, data = {}) {
        this.errorCount++;
        const entry = this.createLogEntry('fatal', message, data);
        console.error(`[FATAL] ${message}`, data);
        this.addToMemory(entry);
        
        // Always send fatal errors
        this.sendToMonitoring(entry);
    }

    /**
     * Track API calls
     */
    logApiCall(method, url, status, duration, data = {}) {
        const level = status >= 400 ? 'error' : 'info';
        this[level]('API Call', {
            method,
            url,
            status,
            duration: `${duration}ms`,
            ...data
        });
    }

    /**
     * Track user actions
     */
    logUserAction(action, data = {}) {
        this.info('User Action', {
            action,
            ...data
        });
    }

    /**
     * Track performance metrics
     */
    startPerformanceMark(name) {
        this.performanceMarks.set(name, performance.now());
    }

    endPerformanceMark(name, data = {}) {
        const startTime = this.performanceMarks.get(name);
        if (!startTime) {
            this.warn('Performance mark not found', { name });
            return;
        }

        const duration = performance.now() - startTime;
        this.performanceMarks.delete(name);

        this.info('Performance', {
            metric: name,
            duration: `${duration.toFixed(2)}ms`,
            ...data
        });

        return duration;
    }

    /**
     * Send logs to monitoring service
     */
    async sendToMonitoring(entry) {
        // Skip in development
        if (this.environment === 'development') {
            return;
        }

        try {
            // In a real implementation, you would send to Sentry, LogRocket, etc.
            // For now, we'll store in localStorage for debugging
            const key = `log_${Date.now()}`;
            const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
            logs.push(entry);
            
            // Keep only last 50 errors
            if (logs.length > 50) {
                logs.shift();
            }
            
            localStorage.setItem('error_logs', JSON.stringify(logs));

            // Example: Send to a logging endpoint
            // await fetch('/api/logs', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(entry)
            // });
        } catch (error) {
            console.error('Failed to send log to monitoring:', error);
        }
    }

    /**
     * Get logs from memory
     */
    getLogs(filter = {}) {
        let filtered = [...this.logs];

        if (filter.level) {
            filtered = filtered.filter(log => log.level === filter.level);
        }

        if (filter.since) {
            const sinceTime = new Date(filter.since).getTime();
            filtered = filtered.filter(log => 
                new Date(log.timestamp).getTime() >= sinceTime
            );
        }

        if (filter.message) {
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(filter.message.toLowerCase())
            );
        }

        return filtered;
    }

    /**
     * Export logs as JSON
     */
    exportLogs() {
        const data = {
            appName: this.appName,
            environment: this.environment,
            sessionId: this.sessionId,
            exportedAt: new Date().toISOString(),
            stats: {
                totalLogs: this.logs.length,
                errors: this.errorCount,
                warnings: this.warningCount
            },
            logs: this.logs
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Download logs as a file
     */
    downloadLogs() {
        const json = this.exportLogs();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${this.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear logs from memory
     */
    clearLogs() {
        const count = this.logs.length;
        this.logs = [];
        this.errorCount = 0;
        this.warningCount = 0;
        console.log(`Cleared ${count} logs from memory`);
    }

    /**
     * Get session info
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            environment: this.environment,
            startTime: this.logs[0]?.timestamp,
            duration: this.logs.length > 0 
                ? new Date() - new Date(this.logs[0].timestamp)
                : 0,
            logCount: this.logs.length,
            errorCount: this.errorCount,
            warningCount: this.warningCount
        };
    }

    /**
     * Set user ID for tracking
     */
    setUserId(userId) {
        this.userId = userId;
        this.info('User ID Set', { userId });
    }

    /**
     * Track page view
     */
    trackPageView(page, data = {}) {
        this.info('Page View', {
            page,
            referrer: document.referrer,
            ...data
        });
    }

    /**
     * Create a child logger with context
     */
    child(context = {}) {
        const childLogger = Object.create(this);
        childLogger.context = { ...this.context, ...context };
        return childLogger;
    }
}

// Create global logger instance
window.logger = new Logger({
    appName: 'Helmick Underground Admin',
    logLevel: window.location.hostname === 'localhost' ? 'debug' : 'info'
});

// Add convenience methods to console
console.trackAction = (action, data) => window.logger.logUserAction(action, data);
console.trackApi = (method, url, status, duration, data) => 
    window.logger.logApiCall(method, url, status, duration, data);
console.startTimer = (name) => window.logger.startPerformanceMark(name);
console.endTimer = (name, data) => window.logger.endPerformanceMark(name, data);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
