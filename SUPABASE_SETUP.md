# Supabase Integration Guide

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Get your credentials from:
- **Supabase Dashboard** → Project Settings → API
- `VITE_SUPABASE_URL`: Your project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your anon/public key

### 2. Run Database Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `supabase/migrations/001_complete_schema.sql`
3. Paste into SQL Editor and click **Run**
4. Verify tables in **Table Editor**

### 3. Usage in Components

#### Authentication

```tsx
import { useSupabaseUser } from "@/lib/supabase-hooks";
import { signIn, signOut, signUp } from "@/lib/supabase";

function LoginButton() {
  const { user, loading } = useSupabaseUser();

  if (loading) return <div>Loading...</div>;
  if (user) {
    return (
      <button onClick={() => signOut()}>
        Logout ({user.email})
      </button>
    );
  }

  return (
    <button onClick={() => signIn("email@example.com", "password")}>
      Login
    </button>
  );
}
```

#### Fetch Data

```tsx
import { supabase } from "@/lib/supabase";

async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  
  return { data, error };
}
```

#### Realtime Updates

```tsx
import { useSupabaseRealtime } from "@/lib/supabase-hooks";
import type { Database } from "@/lib/database.types";

type Event = Database["public"]["Tables"]["events"]["Row"];

function EventList() {
  const { data: events, loading } = useSupabaseRealtime<Event>("events");

  if (loading) return <div>Loading...</div>;
  return (
    <ul>
      {events.map((event) => (
        <li key={event.id}>{event.title}</li>
      ))}
    </ul>
  );
}
```

#### File Upload

```tsx
import { uploadFile, getPublicUrl } from "@/lib/supabase";

async function uploadProfilePhoto(file: File, userId: string) {
  const path = `${userId}/avatar.png`;
  const { data, error } = await uploadFile("profile-photos", path, file);
  
  if (error) throw error;
  
  const publicUrl = getPublicUrl("profile-photos", path);
  return publicUrl;
}
```

### 4. Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **Public read**: Most content tables (events, campaigns, marketplace_listings, etc.)
- **User owns data**: Users can only update/delete their own data
- **Admin access**: Admins can read all data

### 5. Storage Buckets

Available buckets:
- `profile-photos` - Public, user can upload/delete own
- `event-covers` - Public, authenticated can upload
- `tournament-banners` - Public, authenticated can upload
- `media-uploads` - Public, authenticated can upload/delete own
- `business-proposals` - Private, user can read own
- `learning-content` - Public, authenticated can upload
- `crypto-documents` - Private, user can read own

### 6. Migration from Old Backend

The old backend (`/functions/v1/app`) still works. To migrate:

1. **Dual-write phase**: Write to both old backend and Supabase
2. **Read from Supabase**: Switch reads to Supabase first
3. **Remove old backend**: Once confident, remove old API calls

Example migration:

```tsx
// Old way
const events = await api("events.list");

// New way (Supabase)
const { data: events } = await supabase
  .from("events")
  .select("*")
  .eq("status", "published");
```

### 7. TypeScript Types

Types are defined in `src/lib/database.types.ts`. Update this file when schema changes:

```bash
# If you have Supabase CLI installed
supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
```

### 8. Testing

Test Supabase connection:

```tsx
import { supabase } from "@/lib/supabase";

async function testConnection() {
  const { data, error } = await supabase
    .from("events")
    .select("count", { count: "exact", head: true });
  
  console.log("Connection test:", { data, error });
}
```

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `.env` file exists in project root
- Check variable names match exactly (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Restart dev server after adding `.env`

### "Row Level Security policy violation"
- Check RLS policies in Supabase Dashboard
- Ensure user is authenticated for write operations
- Verify user has correct role/permissions

### "Storage bucket not found"
- Run migration script to create buckets
- Check bucket names match exactly
- Verify bucket is public if needed

## Next Steps

- [ ] Set up Supabase project
- [ ] Run migration script
- [ ] Configure `.env` with credentials
- [ ] Test authentication flow
- [ ] Migrate one feature to Supabase (e.g., events)
- [ ] Gradually migrate other features
- [ ] Remove old backend when ready
