// server/index.js - Express Server Entry Point
import express from 'express';
import cors from 'cors';
import { loadBackendConfig, getSanitizedConfig } from './config.js';
import emailRoutes from './routes/emailRoutes.js';

const config = loadBackendConfig();
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Smart Vehicle Safety Email Backend',
        timestamp: Date.now()
    });
});

// Email Service API
app.use('/api/email', emailRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start listener only when executed directly
if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(config.port, () => {
        console.log(`=======================================================`);
        console.log(`🚗 Smart Vehicle Safety Backend running on port ${config.port}`);
        console.log(`📧 Mode: ${config.mockEmail ? 'MOCK EMAIL (No Gmail credentials required)' : 'LIVE GMAIL SMTP'}`);
        console.log(`📡 Recipient: ${config.defaultRecipient || '(None configured yet)'}`);
        console.log(`=======================================================`);
    });

    process.on('SIGTERM', () => {
        server.close(() => console.log('Backend server terminated.'));
    });
}

export default app;
