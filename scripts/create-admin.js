// Helper to create first admin via service_role key
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(res => rl.question(q, res));

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log('=== Create First Admin ===');
  const email = await question('Admin email: ');
  const password = await question('Admin password (min 6 chars): ');
  const fullName = await question('Full name: ');
  const studentCode = await question('Student code (e.g., ADMIN001): ') || 'ADMIN001';

  if (!email || !password || !fullName) {
    console.error('Missing fields');
    process.exit(1);
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    });
    if (authError) throw authError;
    console.log('Auth user created:', authData.user.id);

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      full_name: fullName,
      student_code: studentCode.toUpperCase(),
      email,
      role: 'admin'
    });
    if (profileError) throw profileError;

    console.log('✅ Admin profile created successfully!');
    console.log(`Login at /login.html with ${email}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    rl.close();
  }
}

main();
