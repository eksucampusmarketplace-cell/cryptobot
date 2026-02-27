# Future Schema Migrations Guide

## Important Note

Because we're using Supabase's Transaction Pooler (port 6543), **DO NOT** use `prisma db push` or `prisma migrate` commands directly. They will hang or fail.

## How to Modify Schema in Future

### Step 1: Update Schema File

Edit `prisma/schema.prisma` to make your changes.

### Step 2: Generate Migration SQL

```bash
# If this is a fresh schema or major changes:
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# If comparing against existing database (once tables exist):
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > migration.sql
```

### Step 3: Review the SQL

Open `migration.sql` and review what changes will be made.

### Step 4: Run SQL in Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Click **Run**

### Step 5: Regenerate Prisma Client

```bash
npm run db:generate
```

## Common Migration Types

### Adding a New Column

Example: Adding a field to User model

```prisma
model User {
  // ... existing fields
  newField String?  // Add this
}
```

Generate SQL, review, run in Supabase Dashboard.

### Adding a New Table

Example: Adding a new model

```prisma
model NewTable {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  @@map("new_table")
}
```

Generate SQL, review, run in Supabase Dashboard.

### Modifying a Column

Example: Making a field required

```prisma
model User {
  // ... existing fields
  phoneNumber String   // Remove the ? to make it required
}
```

⚠️ **WARNING**: Making fields required that have existing NULL data will fail. You may need to:
1. First add a default value
2. Run a data migration to update existing records
3. Then make it required

### Adding Indexes

```prisma
model User {
  email String @unique
  @@index([email])
}
```

Generate SQL, review, run in Supabase Dashboard.

### Adding Relations

```prisma
model User {
  posts Post[]
}

model Post {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

Generate SQL, review, run in Supabase Dashboard.

## Data Migrations

If you need to migrate existing data:

### Step 1: Create the schema change

Generate the SQL as described above.

### Step 2: Create data migration SQL

Write custom SQL to transform your data:

```sql
-- Example: Migrating phone numbers to a new format
UPDATE users
SET phone_number = REGEXP_REPLACE(phone_number, '\D', '')
WHERE phone_number IS NOT NULL;
```

### Step 3: Run both in Supabase Dashboard

Run schema SQL first, then data migration SQL.

## Testing Changes Locally

If you want to test schema changes locally before deploying:

### Option 1: Use Docker PostgreSQL

```bash
# Start local PostgreSQL
docker run --name local-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# Update DATABASE_URL temporarily
export DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"

# Run migrations locally
npx prisma db push

# Test your app
npm run dev

# Clean up when done
docker stop local-postgres && docker rm local-postgres
```

### Option 2: Use Supabase Branching (Paid)

Supabase offers database branching for testing schema changes. See: https://supabase.com/docs/guides/platform/branching

## Rollback Strategy

Always keep a backup of your data before schema changes:

### Supabase Automated Backups

Supabase creates automatic backups daily. You can restore from these in the Dashboard.

### Manual Backup Before Changes

```sql
-- Export all data to backup
CREATE TABLE users_backup AS SELECT * FROM users;
-- Repeat for each table
```

### Restore from Backup

```sql
-- Restore data
TRUNCATE users;
INSERT INTO users SELECT * FROM users_backup;
```

## Best Practices

1. **Always Review Generated SQL**: Never run auto-generated SQL without reviewing it first
2. **Test in Non-Production**: If possible, test schema changes in a staging environment first
3. **Backup First**: Always backup before destructive changes
4. **Document Changes**: Keep a changelog of schema modifications
5. **Version Control**: Keep your schema.prisma in git
6. **Review Dependencies**: Check if foreign keys or indexes will be affected

## Common Issues and Solutions

### Error: "relation already exists"

**Cause**: Table already exists from previous migration

**Solution**: The migration SQL may include CREATE TABLE statements for existing tables. Remove or comment out those lines.

### Error: "column already exists"

**Cause**: Column already exists

**Solution**: Remove the ALTER TABLE statement for that column from the migration SQL.

### Error: "cannot drop constraint"

**Cause**: Trying to drop a constraint that doesn't exist

**Solution**: Check if the constraint exists first, or remove the DROP CONSTRAINT statement.

### Error: "foreign key violation"

**Cause**: Trying to add a foreign key to data that doesn't exist

**Solution**: Either:
1. Create the referenced data first
2. Make the foreign key nullable initially
3. Use ON DELETE SET NULL for optional relations

## Tools

### Prisma Studio

```bash
npx prisma studio
```

Open a GUI to view and edit your database data.

### Supabase Table Editor

Access from Supabase Dashboard. Good for quick data inspections.

### SQL Editor

Access from Supabase Dashboard. Essential for running migrations.

## When to Use Different Approaches

| Task | Approach |
|------|----------|
| Initial setup | Manual SQL (as done in QUICK_FIX.md) |
| Small schema changes | Generate SQL + Run manually |
| Data migrations | Custom SQL + Run manually |
| Local testing | Docker PostgreSQL + prisma db push |
| Production | Generate SQL + Review + Run manually in Supabase Dashboard |

## Support Resources

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Supabase SQL Editor Docs](https://supabase.com/docs/guides/database/sql-editor)
- [PostgreSQL ALTER TABLE Docs](https://www.postgresql.org/docs/current/sql-altertable.html)
