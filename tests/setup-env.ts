// Test environment: isolated database, simulated payments, a known webhook secret, no real email.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/noir_test";
process.env.APP_ENV = "test";
process.env.ENABLE_MOCK_PAYMENTS = "true";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
process.env.APP_SECRET = "test-app-secret-that-is-at-least-32-characters";
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RESEND_API_KEY;
