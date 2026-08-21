# Database Configuration - Phase 1

## MongoDB Setup

### Connection String Format
```
mongodb://username:password@host:port/database-name
```

### Local Development
```
mongodb://localhost:27017/it-management-system
```

### MongoDB Atlas (Cloud)
```
mongodb+srv://username:password@cluster.mongodb.net/it-management-system?retryWrites=true&w=majority
```

## Environment Configuration

Set the connection string in `server/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/it-management-system
```

## Mongoose Configuration

The database connection is configured in `server/src/config/database.js`:

```javascript
import mongoose from 'mongoose';
import { config } from './environment.js';

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

export { connectDB };
```

## Connection Options

| Option | Value | Purpose |
|--------|-------|---------|
| useNewUrlParser | true | Use new URL parser |
| useUnifiedTopology | true | Use new connection management |
| serverSelectionTimeoutMS | 5000 | Connection timeout (5 seconds) |
| socketTimeoutMS | 45000 | Socket timeout (45 seconds) |
| retryWrites | true | Automatic retry on failures |

## Collections (Phase 1)

**Phase 1** establishes the foundation with no collections yet.

Collections will be created in Phase 2+ as modules are implemented:

### Phase 2 Collections
- **users** - User accounts and authentication
- **employees** - HRMS employee records
- **clients** - CRM client information
- **projects** - Project tracking

### Phase 3+ Collections
- **departments** - Organizational structure
- **designations** - Job titles and roles
- **payroll** - Salary and compensation
- **invoices** - Financial records
- **tickets** - Support tickets
- **reports** - Analytics and reporting

## Indexes (Phase 2+)

Indexes will be created for:
- User email (unique)
- Employee ID (unique)
- Client name
- Project status
- Creation timestamps

## Data Validation (Phase 2+)

Mongoose schemas will define:
- Field types
- Required fields
- Default values
- Validation rules
- Unique constraints

## Backups

### Development
No backups required for development databases.

### Production (Phase 5+)
- Daily automated backups to S3
- Point-in-time recovery
- Backup retention policy: 30 days

## Monitoring

### Development
- Connection logs
- Query execution time
- Memory usage

### Production (Phase 5+)
- Connection pool monitoring
- Query performance tracking
- Automated alerts for issues

## Migration Strategy (Phase 2+)

Database migrations will use:
- Mongoose model versioning
- Migration scripts for schema changes
- Backward compatibility for running instances

## Performance Optimization

### Connection Pooling
- Default pool size: 10 connections
- Adjustable based on load

### Query Optimization (Phase 2+)
- Proper index usage
- Aggregation pipeline optimization
- Lean queries for read-only data

### Caching (Phase 3+)
- Redis for frequently accessed data
- Cache invalidation strategy

## Security (Production)

### Authentication
- Enable MongoDB authentication
- Use strong credentials
- Store in secure .env file

### Network
- Use VPC in MongoDB Atlas
- Whitelist IP addresses
- Use TLS/SSL connections

### Encryption
- Encryption at rest (MongoDB Enterprise)
- Encryption in transit (TLS)

## Development Workflow

1. **Setup Local MongoDB**
   ```bash
   # macOS with Homebrew
   brew install mongodb-community
   brew services start mongodb-community
   
   # Windows
   # Download from https://www.mongodb.com/try/download/community
   # Or use WSL with Linux instructions
   
   # Linux
   # Follow OS-specific instructions
   ```

2. **Verify Connection**
   ```bash
   mongosh
   show dbs
   exit
   ```

3. **Start Application**
   ```bash
   cd server
   npm run dev
   ```

## Troubleshooting

### Connection Refused
- **Problem:** Cannot connect to MongoDB
- **Solution:** 
  - Verify MongoDB is running
  - Check connection string
  - Verify firewall settings

### Authentication Failed
- **Problem:** MongoDB requires authentication
- **Solution:**
  - Verify username and password in connection string
  - Check database name matches

### Timeout
- **Problem:** Connection times out
- **Solution:**
  - Increase serverSelectionTimeoutMS
  - Check network connectivity
  - Verify MongoDB resources

## Database Reset

To reset the development database:

```bash
mongosh
use it-management-system
db.dropDatabase()
exit
```

## Data Seeding (Phase 2+)

Test data will be seeded using:
- Seed scripts in `server/scripts/seed.js`
- Faker.js for generating fake data
- Run: `npm run seed`

---

**Status:** Phase 1 - Configuration Complete
**Database:** MongoDB with Mongoose ODM
**Collections:** Coming in Phase 2
