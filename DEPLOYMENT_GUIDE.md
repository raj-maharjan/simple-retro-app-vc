# 🚀 Deployment Guide: Netlify + Supabase

This guide will help you deploy your retrospective meeting app to Netlify with Supabase as the backend.

## 📋 Prerequisites

- ✅ Supabase project set up
- ✅ GitHub/GitLab repository
- ✅ Netlify account (free)

## 🔧 Environment Variables Needed

Your app requires these environment variables:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (for `VITE_SUPABASE_URL`)
   - **anon/public key** (for `VITE_SUPABASE_ANON_KEY`)

## 🚀 Deployment Methods

### Method 1: Direct Git Integration (Recommended)

1. **Push to GitHub/GitLab**:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Choose your Git provider (GitHub/GitLab)
   - Select your repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`

3. **Set Environment Variables**:
   - In Netlify dashboard, go to **Site settings** → **Environment variables**
   - Add your Supabase credentials:
     ```
     VITE_SUPABASE_URL = your_supabase_project_url
     VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
     ```

4. **Deploy**:
   - Click "Deploy site"
   - Netlify will automatically build and deploy your app
   - Future pushes to main branch will auto-deploy

### Method 2: Manual Deployment

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Drag and drop the `dist` folder to deploy
   - Add environment variables in site settings

## 🌐 Configure Supabase for Production

### 1. Update Authentication URLs

In your Supabase Dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add your Netlify domain to **Site URL**:
   ```
   https://your-app-name.netlify.app
   ```
3. Add to **Redirect URLs**:
   ```
   https://your-app-name.netlify.app/auth/callback
   https://your-app-name.netlify.app
   ```

### 2. Configure CORS (if needed)

If you encounter CORS issues, add your domain to Supabase CORS settings:
- Go to **Settings** → **API**
- Add your Netlify URL to allowed origins

## 📧 Email Function Configuration

Your email notification system is already set up! Make sure:

1. **Resend API Key** is configured in Supabase secrets ✅
2. **Edge Function** is deployed ✅
3. **Storage buckets** are set up (run the SQL scripts if not done)

## 🔧 Troubleshooting

### Build Errors

**Error: "Missing Supabase environment variables"**
- Solution: Add environment variables in Netlify dashboard

**Error: "Command not found: npm"**
- Solution: Set Node.js version in `netlify.toml` (already configured)

### Runtime Errors

**Error: "Network request failed"**
- Check Supabase URL and keys
- Verify CORS configuration
- Check browser console for detailed errors

**Error: "Auth session not found"**
- Update redirect URLs in Supabase auth settings
- Clear browser cache and cookies

### Email Issues

**Emails not sending**
- Verify Resend API key in Supabase secrets
- Check edge function logs: `supabase functions logs send-meeting-summary`
- Ensure storage buckets are set up

## ⚡ Performance Optimization

### Automatic Optimizations (Already Configured)

- ✅ **Caching**: Static assets cached for 1 year
- ✅ **Compression**: Gzip compression enabled
- ✅ **CDN**: Global CDN distribution via Netlify
- ✅ **HTTP/2**: Modern protocol support

### Additional Optimizations

1. **Custom Domain** (Optional):
   - Buy a domain
   - Configure DNS in Netlify
   - Get free SSL certificate

2. **Performance Monitoring**:
   - Use Netlify Analytics
   - Monitor Core Web Vitals
   - Check Lighthouse scores

## 🔒 Security Checklist

- ✅ Environment variables secured
- ✅ Supabase RLS policies enabled
- ✅ HTTPS enforced
- ✅ Auth redirects configured
- ✅ No sensitive data in client code

## 📊 Post-Deployment Checklist

After deployment, test these features:

- [ ] User authentication (Google OAuth)
- [ ] Meeting creation and joining
- [ ] Real-time note updates
- [ ] Avatar uploads
- [ ] Email notifications
- [ ] CSV exports
- [ ] Mobile responsiveness

## 🎉 You're Live!

Once deployed, your app will be available at:
```
https://your-app-name.netlify.app
```

### Custom Domain (Optional)

To use your own domain:
1. Purchase a domain
2. In Netlify: **Domain management** → **Add custom domain**
3. Update DNS records as instructed
4. SSL certificate is automatically generated

## 🔄 Continuous Deployment

With Git integration:
- Every push to `main` branch auto-deploys
- Pull request previews available
- Rollback to previous versions anytime

## 📞 Support

If you encounter issues:
1. Check Netlify build logs
2. Check browser console for errors
3. Verify Supabase configuration
4. Test locally first: `npm run build && npm run preview` 