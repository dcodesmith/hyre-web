# Database Setup Guide - Neon PostgreSQL

This guide walks you through setting up separate databases for preview and production environments using Neon.

## Overview

We use two separate Neon PostgreSQL databases:
- **Preview Database**: For staging/preview deployments
- **Production Database**: For live production environment

## Step-by-Step Setup

### 1. Create Neon Databases via Vercel Integration

Since you already have Neon linked through Vercel, you can create both databases directly in Vercel:

#### Create Production Database
1. Go to your **Vercel project dashboard**
2. Click on the **"Storage"** tab
3. Click **"Create Database"** or **"Add Database"**
4. Select **"Neon"** (already connected)
5. Configure:
   - **Name**: `hireapp-production`
   - **Environment**: Production
   - **Region**: Same as your existing database

#### Your Existing Database (Preview)
Your current database will be used for preview/development environments.

### 2. Environment Variables (Automatic Setup)

**Good news!** When you create the database through Vercel Storage, it automatically:
- Sets up the `DATABASE_URL` environment variable
- Configures it correctly for each environment (Production vs Preview)
- No manual connection string copying needed!

#### Local Development
Create a `.env` file (not tracked in git):
```bash
DATABASE_URL=postgresql://<username>:<password>@ep-preview-xxx.us-east-2.aws.neon.tech/hireapp_preview?sslmode=require
```

### 3. Automatic Migration Handling

**No additional scripts needed!** Your existing setup already handles everything:

- **`vercel-build`**: Runs `prisma migrate deploy` automatically during deployment
- **`migrate-deploy-seed.ts`**: Handles migrations and seeding intelligently
- **Vercel**: Automatically deploys on git push with environment-specific DATABASE_URL

### 4. How It Works

#### Automatic Deployment Flow
1. **Preview**: Push to any branch → Vercel deploys with preview DATABASE_URL
2. **Production**: Merge to main → Vercel deploys with production DATABASE_URL  
3. **Migrations**: Run automatically via `vercel-build` script
4. **Seeding**: Runs automatically only if database is empty

### 5. Environment Variable Setup in Vercel

1. Go to your Vercel project dashboard
2. Click on "Settings" → "Environment Variables"
3. Add the following variables:

**Preview Environment Variables:**
- `PREVIEW_DATABASE_URL`: Your preview database connection string
- Set "Environment" to "Preview"

**Production Environment Variables:**
- `PRODUCTION_DATABASE_URL`: Your production database connection string  
- Set "Environment" to "Production"

**All Other Environment Variables:**
Make sure to set all other required environment variables for both environments:
- `SESSION_SECRET`
- `ENCRYPTION_SECRET`
- `RESEND_API_KEY`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_PUBLIC_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GOOGLE_MAPS_API_KEY`
- etc.

### 6. Deployment Workflow

#### For Preview Deployments:
1. Push to a branch (not main)
2. Vercel automatically deploys with `DATABASE_URL` from preview environment variables
3. Migrations run automatically via `vercel-build` script

#### For Production Deployments:
1. Merge to main branch  
2. Vercel automatically deploys with `DATABASE_URL` from production environment variables
3. Migrations run automatically via `vercel-build` script

### 7. Manual Database Operations

#### Force Seed (⚠️ Use with caution)
If you need to force seed an existing database, set the `FORCE_SEED=true` environment variable in Vercel and redeploy:

1. Go to Vercel → Settings → Environment Variables
2. Add `FORCE_SEED` with value `true`
3. Redeploy (push to branch for preview, merge to main for production)
4. **Important**: Remove the `FORCE_SEED` variable after deployment to prevent accidental data wipes

#### Connect to Database Directly
Use the Neon dashboard or connect with any PostgreSQL client using the connection strings.

### 9. Monitoring and Maintenance

- **Neon Dashboard**: Monitor database performance, connections, and usage
- **Database Backups**: Neon provides automated backups
- **Connection Pooling**: Neon includes built-in connection pooling
- **Scaling**: Neon auto-scales based on demand

### 10. Troubleshooting

#### Common Issues:

**Connection Issues:**
- Verify connection strings are correct
- Check that `sslmode=require` is included
- Ensure environment variables are set correctly in Vercel

**Migration Failures:**
- Check Vercel build logs
- Verify database is accessible
- Ensure Prisma schema is up to date

**Seed Script Issues:**
- Check if database already has data
- Use `FORCE_SEED=true` only if you want to wipe existing data
- Verify seed data doesn't conflict with existing constraints

### 11. Best Practices

1. **Never use production database for testing**
2. **Always test migrations on preview first**
3. **Keep connection strings secure**
4. **Monitor database usage and performance**
5. **Use preview environment for all development and testing**
6. **Only force seed in production during initial setup**

## Security Notes

- Connection strings contain sensitive credentials
- Store them securely in Vercel environment variables
- Never commit connection strings to version control
- Use different credentials for preview and production
- Regularly rotate database passwords

## Support

For Neon-specific issues, check:
- [Neon Documentation](https://neon.tech/docs)
- [Neon Support](https://neon.tech/docs/introduction/support)

For application-specific database issues, check the application logs in Vercel dashboard.
