-- Add base_price column if it doesn't exist, and set meaningful MRP markup
-- base_price represents the original MRP, price is the discounted/selling price

-- Step 1: Add base_price column if missing
ALTER TABLE services ADD COLUMN IF NOT EXISTS base_price NUMERIC;

-- Step 2: For services where base_price is NULL, set it equal to price
UPDATE services SET base_price = price WHERE base_price IS NULL;

-- Step 3: For services where base_price = price (no existing discount),
-- set base_price to ~15-20% above price to show savings
-- Use CEIL to get clean round numbers
UPDATE services 
SET base_price = CEIL(price * 1.18 / 10) * 10
WHERE base_price = price 
  AND price > 0;
