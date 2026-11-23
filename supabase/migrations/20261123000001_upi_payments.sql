-- Manual UPI payments (temporary, until Razorpay is live): the customer pays a UPI QR and submits the
-- transaction reference (UTR); an admin checks it in their bank app and confirms. provider_payment_id
-- holds 'upi_<UTR>' so the same UTR can never be used twice.
alter table payments drop constraint payments_provider_check;
alter table payments add constraint payments_provider_check check (provider in ('razorpay', 'mock', 'upi'));
create index payments_pending_upi_idx on payments(created_at) where provider = 'upi' and status = 'pending';
