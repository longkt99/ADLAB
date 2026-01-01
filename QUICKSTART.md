# Content Machine - Quick Start Guide ⚡

Get up and running in 5 minutes!

## Step 1: Install Dependencies (1 min)

```bash
npm install
```

## Step 2: Set Up Supabase (2 min)

### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose name, password, region
4. Wait for project to initialize

### Run Database Migration
1. Go to SQL Editor in Supabase dashboard
2. Open `supabase/migrations/001_initial_schema.sql` from this project
3. Copy all content
4. Paste into SQL Editor
5. Click "Run"

### Create Storage Bucket
1. Go to Storage in Supabase dashboard
2. Click "Create bucket"
3. Name: `post-images`
4. Set as Public
5. Click "Create"

## Step 3: Configure Environment (1 min)

Create `.env.local` file in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

Get these values from:
- Supabase Dashboard → Settings → API

## Step 4: Run Development Server (1 min)

```bash
npm run dev
```

Open http://localhost:3000

## Step 5: Create Your First Post! 🎉

1. Click "Go to Dashboard"
2. Click "Create New Post"
3. Fill in title and content
4. Select some platforms
5. Click "Create Post"
6. View your post
7. Click "Generate Variants"
8. Watch the magic happen!

---

## What's Next?

### Enable Real AI (Optional)

1. Get OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Add to `.env.local`:
   ```
   OPENAI_API_KEY=sk-...
   ```
3. Edit `app/api/posts/[id]/generate-variants/route.ts`:
   - Comment out stub function
   - Uncomment real OpenAI implementation
4. Restart server

### Deploy to Production

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables
5. Deploy!

### Add Scheduling (Optional)

See `README.md` section on "Scheduling & Publishing"

---

## Troubleshooting

**"Cannot connect to Supabase"**
- Check `.env.local` has correct values
- Verify project is active in Supabase dashboard

**"Table does not exist"**
- Run the migration SQL again
- Check for error messages in SQL Editor

**"Image upload failed"**
- Verify `post-images` bucket exists
- Ensure bucket is set to Public

**"Variants not generating"**
- Check browser console for errors
- Verify API route is accessible at `/api/posts/[id]/generate-variants`

---

## Quick Tips

💡 **Start with draft status** while testing

💡 **Use "both" language** for bilingual content (Vietnamese + English)

💡 **Select fewer platforms first** to test faster

💡 **Check character counts** - red warnings mean content is too long

💡 **Use the copy button** to quickly grab variant content

---

## File Structure at a Glance

```
Content Machine/
├── app/                    # Next.js pages
│   ├── (dashboard)/       # Dashboard routes
│   └── api/               # API endpoints
├── components/            # React components
│   └── posts/            # Post-related components
├── lib/                   # Core business logic
│   ├── api/              # Data access layer
│   └── integrations/     # External services
├── supabase/             # Database migrations
└── .env.local            # Your environment variables (create this!)
```

---

## Support

- 📖 Read `README.md` for full documentation
- 📋 Check `IMPLEMENTATION_SUMMARY.md` for architecture details
- 🐛 Check browser console for errors
- 📊 Check Supabase dashboard for database issues

---

**Ready to create amazing multi-platform content!** 🚀
