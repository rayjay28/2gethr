const { neon } = require('@neondatabase/serverless');

async function debugDigestQuery() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log("=== Checking Digest Query ===\n");
  
  // Check users
  const users = await sql`SELECT id, email, first_name, is_active FROM users LIMIT 10`;
  console.log("Users in database:", users.length);
  users.forEach(u => console.log(`  - ${u.email} (active: ${u.is_active})`));
  
  // Check family_members
  const members = await sql`SELECT fm.user_id, fm.role, fm.is_active, f.name as family_name 
    FROM family_members fm 
    JOIN families f ON fm.family_id = f.id 
    LIMIT 10`;
  console.log("\nFamily members:", members.length);
  members.forEach(m => console.log(`  - ${m.family_name}: ${m.role} (active: ${m.is_active})`));
  
  // Check reminder_settings
  const settings = await sql`SELECT user_id, weekly_digest FROM reminder_settings LIMIT 10`;
  console.log("\nReminder settings:", settings.length);
  settings.forEach(s => console.log(`  - user ${s.user_id}: weekly_digest=${s.weekly_digest}`));
  
  // Run the actual digest query
  console.log("\n=== Running Digest Users Query ===\n");
  
  const digestUsers = await sql`
    SELECT 
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.last_login_at,
      f.name as family_name,
      f.id as family_id,
      fm.role,
      rs.weekly_digest as digest_enabled
    FROM users u
    JOIN family_members fm ON u.id = fm.user_id
    JOIN families f ON fm.family_id = f.id
    LEFT JOIN reminder_settings rs ON u.id = rs.user_id
    WHERE u.is_active = true
    AND fm.is_active = true
    AND fm.role IN ('PARENT', 'GUARDIAN')
    AND (rs.weekly_digest = true OR rs.weekly_digest IS NULL)
    ORDER BY f.name, u.first_name
  `;
  
  console.log("Eligible digest users:", digestUsers.length);
  digestUsers.forEach(u => {
    console.log(`  - ${u.first_name} ${u.last_name} (${u.email}) - ${u.role} in ${u.family_name}`);
  });
  
  // Check events
  const startOfWeek = new Date();
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  
  const events = await sql`
    SELECT COUNT(*) as event_count
    FROM events e
    JOIN calendars c ON e.calendar_id = c.id
    WHERE e.status = 'APPROVED'
    AND e.start_time >= ${startOfWeek.toISOString()}
    AND e.start_time <= ${endOfWeek.toISOString()}
  `;
  
  console.log("\nUpcoming events this week:", events[0]?.event_count);
  
  console.log("\n=== Done ===");
}

debugDigestQuery().catch(console.error);
