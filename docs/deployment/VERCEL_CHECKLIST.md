# Vercel Configuration Checklist

## ✅ Files Created
- [x] `vercel.json` - Main Vercel configuration
- [x] `.vercelignore` - Exclude unnecessary files
- [x] `api/index.js` - Serverless function wrapper
- [x] `.env.example` - Environment variables template
- [x] `VERCEL_DEPLOYMENT.md` - Complete deployment guide
- [x] `QUICK_DEPLOY.md` - Quick start guide
- [x] `deploy.bat` - Automated deployment script

## ✅ Code Changes
- [x] Modified `backend/server.js` to export app for Vercel
- [x] Server now detects Vercel environment and skips `listen()`

## ⚙️ Environment Variables Required

Configure these on Vercel Dashboard → Settings → Environment Variables:

### Required
- `DATABASE_URL` - PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database`
  - Get from: Vercel Postgres, Supabase, Railway, or Neon

- `JWT_SECRET` - Secret key for JWT authentication
  - Example: `your-secure-random-string-here`
  - Generate: Use a random string generator

### Optional
- `GOOGLE_CLIENT_ID` - For Google OAuth (if used)
- `GOOGLE_CLIENT_SECRET` - For Google OAuth (if used)
- `EMAIL_USER` - For email notifications
- `EMAIL_PASS` - For email notifications

## 📊 Database Status

✅ **Schema already configured for PostgreSQL**
- Provider: `postgresql` (in `schema.prisma`)
- No migration needed from SQLite
- Ready for Vercel deployment

## 🚀 Deployment Steps

### Quick Deploy (Recommended)
```bash
# Run the automated script
deploy.bat
```

### Manual Deploy
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

### After First Deploy
1. Configure environment variables on Vercel Dashboard
2. Run database migrations:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. Re-deploy to apply changes:
   ```bash
   vercel --prod
   ```

## 🤖 AI Agent Configuration

The AI Agent works **client-side** and requires users to:
1. Go to AI Agent page
2. Click **⚙️ Settings**
3. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. Enter and save the key

**No server-side configuration needed!**

## 🔍 Testing Checklist

After deployment, test:
- [ ] Homepage loads
- [ ] Login/Registration works
- [ ] Staff management page
- [ ] Schedule generation
- [ ] AI Agent page loads
- [ ] AI Agent responds (after entering API key)
- [ ] Statistics page

## 📝 Important Notes

1. **Database**: SQLite doesn't work on Vercel. PostgreSQL is required and already configured.

2. **Serverless Functions**: The backend runs as serverless functions, not a persistent server.

3. **Cold Starts**: First request after inactivity may be slower (serverless cold start).

4. **File Storage**: No persistent file system. All data must be in the database.

5. **Environment Variables**: Must be configured on Vercel Dashboard, not in `.env` files.

## 🆘 Troubleshooting

### Build Fails
- Check build logs on Vercel Dashboard
- Verify all dependencies are in `package.json`
- Ensure `DATABASE_URL` is configured

### Database Connection Error
- Verify `DATABASE_URL` is correct
- Check database is accessible from Vercel's IP ranges
- Run migrations: `npx prisma migrate deploy`

### API Routes Not Working
- Check routes in `vercel.json`
- Verify `api/index.js` imports correctly
- Check function logs on Vercel Dashboard

### AI Agent Not Working
- This is client-side, check browser console
- Verify user has entered valid Gemini API key
- Check CORS settings if needed

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Google Gemini API](https://ai.google.dev/docs)

---

**Status**: ✅ Ready for deployment
**Last Updated**: 2025-12-25
