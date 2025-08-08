import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import bcrypt from "bcryptjs";
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  CreateDailyLogSchema,
  UpdateDailyLogSchema,
  CreateAISuggestionRequestSchema,
} from "@/shared/types";

// Define the environment type
interface Env {
  DB: any; // Using 'any' to avoid Cloudflare-specific type dependency
  JWT_SECRET: string;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  A4F_API_KEY: string;
  A4F_API_BASE: string;
  OPENAI_API_KEY: string;
}



// Custom auth middleware for our new system
const customAuthMiddleware = async (c: any, next: any) => {
  const token = getCookie(c, 'auth_token') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'your-secret-key');
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
    
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};



// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Helper function to send WhatsApp OTP (mock implementation)
const sendWhatsAppOTP = async (phone: string, otp: string) => {
  // In production, integrate with WhatsApp Business API or Twilio
  console.log(`Sending OTP ${otp} to WhatsApp number ${phone}`);
  // For demo, we'll just log it
  return true;
};

const app = new Hono<{ Bindings: Env; Variables: { user?: any } }>();

// Authentication endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// New Authentication System
app.post('/api/auth/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
    ).bind(email, hashedPassword, name).run();

    const user = await c.env.DB.prepare('SELECT id, email, name, is_email_verified, is_phone_verified FROM users WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    // Create JWT token
    const token = await sign({ userId: user.id }, c.env.JWT_SECRET);
    
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return c.json({ user });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || !user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Create JWT token
    const token = await sign({ userId: user.id }, c.env.JWT_SECRET);
    
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Return user without password
    const { password_hash, ...userResponse } = user;
    return c.json({ user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

app.post('/api/auth/send-otp', async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (!phone) {
      return c.json({ error: 'Phone number is required' }, 400);
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await c.env.DB.prepare(
      'INSERT INTO otp_verifications (phone, otp_code, expires_at) VALUES (?, ?, ?)'
    ).bind(phone, otp, expiresAt.toISOString()).run();

    // Send OTP via WhatsApp (mock implementation)
    await sendWhatsAppOTP(phone, otp);

    return c.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return c.json({ error: 'Failed to send OTP' }, 500);
  }
});

app.post('/api/auth/verify-otp', async (c) => {
  try {
    const { phone, otp } = await c.req.json();
    
    if (!phone || !otp) {
      return c.json({ error: 'Phone and OTP are required' }, 400);
    }

    // Verify OTP
    const otpRecord = await c.env.DB.prepare(
      'SELECT * FROM otp_verifications WHERE phone = ? AND otp_code = ? AND is_verified = 0 AND expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1'
    ).bind(phone, otp).first();

    if (!otpRecord) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    // Mark OTP as verified
    await c.env.DB.prepare(
      'UPDATE otp_verifications SET is_verified = 1 WHERE id = ?'
    ).bind(otpRecord.id).run();

    // Check if user exists, if not create
    let user = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
    
    if (!user) {
      const result = await c.env.DB.prepare(
        'INSERT INTO users (phone, name, is_phone_verified) VALUES (?, ?, ?)'
      ).bind(phone, `User ${phone.slice(-4)}`, 1).run();
      
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(result.meta.last_row_id).first();
    } else {
      // Update phone verification status
      await c.env.DB.prepare(
        'UPDATE users SET is_phone_verified = 1 WHERE id = ?'
      ).bind(user.id).run();
      
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    }

    // Create JWT token
    const token = await sign({ userId: user.id }, c.env.JWT_SECRET);
    
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Return user without password
    const { password_hash, ...userResponse } = user;
    return c.json({ user: userResponse });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return c.json({ error: 'OTP verification failed' }, 500);
  }
});

app.get('/api/auth/me', customAuthMiddleware, async (c) => {
  const user = c.get('user');
  const { password_hash, ...userResponse } = user;
  return c.json({ user: userResponse });
});

app.post('/api/auth/logout', async (c) => {
  setCookie(c, 'auth_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0
  });
  return c.json({ success: true });
});

app.put('/api/auth/profile', customAuthMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const updates = await c.req.json();
    
    const fields = [];
    const values = [];
    
    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.phone) {
      fields.push('phone = ?');
      values.push(updates.phone);
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(user.id);
      
      await c.env.DB.prepare(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    const { password_hash, ...userResponse } = updatedUser;
    
    return c.json({ user: userResponse });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Profile update failed' }, 500);
  }
});

// Google OAuth redirect
app.get('/api/auth/google', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });
  return c.redirect(redirectUrl);
});

// Goals endpoints (updated to use custom auth)
app.get("/api/goals", authMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const stmt = c.env.DB.prepare("SELECT * FROM goals WHERE is_active = 1 AND user_id = ? ORDER BY created_at DESC");
    const result = await stmt.bind(user.id).all();
    return c.json({ goals: result.results || [] });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return c.json({ error: "Failed to fetch goals" }, 500);
  }
});

app.post("/api/goals", customAuthMiddleware, zValidator("json", CreateGoalSchema), async (c) => {
  const user = c.get("user")!;
  try {
    const goal = c.req.valid("json");
    const stmt = c.env.DB.prepare(
      "INSERT INTO goals (title, description, category, target_frequency, user_id) VALUES (?, ?, ?, ?, ?)"
    );
    const result = await stmt.bind(
      goal.title,
      goal.description || null,
      goal.category || null,
      goal.target_frequency,
      user.id
    ).run();

    const newGoal = await c.env.DB.prepare("SELECT * FROM goals WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    return c.json({ goal: newGoal }, 201);
  } catch (error) {
    console.error("Error creating goal:", error);
    return c.json({ error: "Failed to create goal" }, 500);
  }
});

app.put("/api/goals/:id", customAuthMiddleware, zValidator("json", UpdateGoalSchema), async (c) => {
  const user = c.get("user")!;
  try {
    const id = parseInt(c.req.param("id"));
    const updates = c.req.valid("json");
    
    const fields = [];
    const values = [];
    
    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      fields.push("category = ?");
      values.push(updates.category);
    }
    if (updates.target_frequency !== undefined) {
      fields.push("target_frequency = ?");
      values.push(updates.target_frequency);
    }
    if (updates.is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(updates.is_active ? 1 : 0);
    }
    
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = c.env.DB.prepare(
      `UPDATE goals SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
    );
    await stmt.bind(...values, user.id).run();

    const updatedGoal = await c.env.DB.prepare("SELECT * FROM goals WHERE id = ?")
      .bind(id)
      .first();

    return c.json({ goal: updatedGoal });
  } catch (error) {
    console.error("Error updating goal:", error);
    return c.json({ error: "Failed to update goal" }, 500);
  }
});

app.delete("/api/goals/:id", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const id = parseInt(c.req.param("id"));
    
    // Soft delete by setting is_active to false
    const stmt = c.env.DB.prepare(
      "UPDATE goals SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    );
    await stmt.bind(id, user.id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return c.json({ error: "Failed to delete goal" }, 500);
  }
});

// Daily logs endpoints
app.get("/api/daily-logs", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const date = c.req.query("date");
    let query = "SELECT * FROM daily_logs WHERE user_id = ?";
    const params = [user.id];

    if (date) {
      query += " AND log_date = ?";
      params.push(date);
    }

    query += " ORDER BY created_at DESC";

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();
    return c.json({ logs: result.results || [] });
  } catch (error) {
    console.error("Error fetching daily logs:", error);
    return c.json({ error: "Failed to fetch daily logs" }, 500);
  }
});

app.post("/api/daily-logs", customAuthMiddleware, zValidator("json", CreateDailyLogSchema), async (c) => {
  const user = c.get("user")!;
  try {
    const log = c.req.valid("json");
    
    // Check if log already exists for this goal and date
    const existing = await c.env.DB.prepare(
      "SELECT id FROM daily_logs WHERE goal_id = ? AND log_date = ? AND user_id = ?"
    ).bind(log.goal_id, log.log_date, user.id).first();

    if (existing) {
      // Update existing log
      const stmt = c.env.DB.prepare(
        "UPDATE daily_logs SET is_completed = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      await stmt.bind(
        log.is_completed ? 1 : 0,
        log.notes || null,
        existing.id
      ).run();

      const updatedLog = await c.env.DB.prepare("SELECT * FROM daily_logs WHERE id = ?")
        .bind(existing.id)
        .first();

      return c.json({ log: updatedLog });
    } else {
      // Create new log
      const stmt = c.env.DB.prepare(
        "INSERT INTO daily_logs (goal_id, log_date, is_completed, notes, user_id) VALUES (?, ?, ?, ?, ?)"
      );
      const result = await stmt.bind(
        log.goal_id,
        log.log_date,
        log.is_completed ? 1 : 0,
        log.notes || null,
        user.id
      ).run();

      const newLog = await c.env.DB.prepare("SELECT * FROM daily_logs WHERE id = ?")
        .bind(result.meta.last_row_id)
        .first();

      return c.json({ log: newLog }, 201);
    }
  } catch (error) {
    console.error("Error creating/updating daily log:", error);
    return c.json({ error: "Failed to create/update daily log" }, 500);
  }
});

app.put("/api/daily-logs/:id", customAuthMiddleware, zValidator("json", UpdateDailyLogSchema), async (c) => {
  const user = c.get("user")!;
  try {
    const id = parseInt(c.req.param("id"));
    const updates = c.req.valid("json");
    
    const fields = [];
    const values = [];
    
    if (updates.is_completed !== undefined) {
      fields.push("is_completed = ?");
      values.push(updates.is_completed ? 1 : 0);
    }
    if (updates.notes !== undefined) {
      fields.push("notes = ?");
      values.push(updates.notes);
    }
    
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = c.env.DB.prepare(
      `UPDATE daily_logs SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
    );
    await stmt.bind(...values, user.id).run();

    const updatedLog = await c.env.DB.prepare("SELECT * FROM daily_logs WHERE id = ?")
      .bind(id)
      .first();

    return c.json({ log: updatedLog });
  } catch (error) {
    console.error("Error updating daily log:", error);
    return c.json({ error: "Failed to update daily log" }, 500);
  }
});

// AI suggestions endpoints
app.post("/api/ai-suggestions", customAuthMiddleware, zValidator("json", CreateAISuggestionRequestSchema), async (c) => {
  const user = c.get("user")!;
  let requestData;
  try {
    requestData = c.req.valid("json");
    const openai = new OpenAI({
      apiKey: c.env.A4F_API_KEY,
      baseURL: c.env.A4F_API_BASE,
    });

    // Get user's current goals for context
    const goalsResult = await c.env.DB.prepare(
      "SELECT title, category, target_frequency FROM goals WHERE is_active = 1 AND user_id = ?"
    ).bind(user.id).all();
    const goals = goalsResult.results || [];

    // Get recent completion data for context
    const recentLogsResult = await c.env.DB.prepare(
      "SELECT g.title, dl.is_completed, dl.log_date FROM daily_logs dl JOIN goals g ON g.id = dl.goal_id WHERE dl.log_date >= date('now', '-7 days') AND dl.user_id = ? ORDER BY dl.log_date DESC"
    ).bind(user.id).all();
    const recentLogs = recentLogsResult.results || [];

    // Build context for AI
    let contextPrompt = "User's current goals:\n";
    goals.forEach((goal: any) => {
      contextPrompt += `- ${goal.title} (${goal.target_frequency}${goal.category ? `, ${goal.category}` : ""})\n`;
    });

    if (recentLogs.length > 0) {
      contextPrompt += "\nRecent completion history:\n";
      recentLogs.slice(0, 10).forEach((log: any) => {
        contextPrompt += `- ${log.title}: ${log.is_completed ? "✓" : "✗"} (${log.log_date})\n`;
      });
    }

    if (requestData.context) {
      contextPrompt += `\nUser context: ${requestData.context}\n`;
    }

    let systemPrompt = "";
    if (requestData.type === "motivation") {
      systemPrompt = "You are an inspiring motivational coach. Generate unique, personalized motivational messages based on the user's specific goals and recent progress. Vary your approach - sometimes be encouraging about small wins, other times challenge them to push harder, or remind them of their why. Make each response feel fresh and tailored to their situation. Keep responses 2-3 sentences max.";
    } else if (requestData.type === "tip") {
      systemPrompt = "You are a productivity expert with diverse strategies. Provide varied, specific, actionable tips based on the user's goals and recent patterns. Draw from different productivity methodologies, time management techniques, habit formation strategies, and goal-setting frameworks. Always give unique, practical advice. Keep responses 2-3 sentences max.";
    } else if (requestData.type === "reminder") {
      systemPrompt = "You are a supportive reminder assistant. Create personalized reminders based on the user's goals and progress patterns. Vary your tone and approach - be gentle, urgent, encouraging, or strategic as appropriate. Reference specific goals and patterns when possible. Keep responses 2-3 sentences max.";
    } else if (requestData.type === "health") {
      systemPrompt = "You are a wellness and health expert. Provide personalized health and wellness suggestions based on the user's goals and lifestyle. Focus on holistic wellbeing including physical health, mental health, nutrition, exercise, sleep, and stress management. Give practical, actionable health advice that fits into their daily routine. Keep responses 2-3 sentences max.";
    } else if (requestData.type === "productivity") {
      systemPrompt = "You are a productivity optimization specialist. Analyze the user's goals and patterns to suggest specific productivity techniques, time management strategies, workflow improvements, and efficiency hacks. Focus on actionable systems that can immediately improve their performance and goal achievement. Keep responses 2-3 sentences max.";
    } else if (requestData.type === "mindfulness") {
      systemPrompt = "You are a mindfulness and mental wellness coach. Provide personalized mindfulness practices, stress reduction techniques, meditation suggestions, and mental clarity advice based on the user's goals and current situation. Focus on practical mindfulness that can be integrated into their daily life. Keep responses 2-3 sentences max.";
    } else {
      systemPrompt = "You are a versatile goal tracking assistant. Analyze the user's goals and recent progress to provide diverse, contextual guidance. Mix different types of advice - sometimes motivational, sometimes strategic, sometimes analytical. Always provide unique, relevant responses based on their specific situation. Keep responses 2-3 sentences max.";
    }

    // Add randomness and additional context for variety
    const timestamp = new Date().toISOString();
    const randomSeed = Math.random();
    
    const enhancedPrompt = `${contextPrompt}\n\nCurrent time: ${timestamp}\nGenerate a unique, contextual response (avoid generic advice). Random seed: ${randomSeed}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedPrompt }
      ],
      max_tokens: 150,
      temperature: 0.9,
    });

    const suggestionText = completion.choices[0].message.content || "Keep up the great work! Every small step counts towards achieving your goals.";

    // Save suggestion to database
    const stmt = c.env.DB.prepare(
      "INSERT INTO ai_suggestions (suggestion_text, suggestion_type, user_id) VALUES (?, ?, ?)"
    );
    const result = await stmt.bind(
      suggestionText,
      requestData.type || "general",
      user.id
    ).run();

    const newSuggestion = await c.env.DB.prepare("SELECT * FROM ai_suggestions WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    return c.json({ suggestion: newSuggestion }, 201);
  } catch (error) {
    console.error("Error creating AI suggestion:", error);
    
    // Dynamic fallback suggestions based on type and randomness
    const fallbackSuggestions = {
      motivation: [
        "Your progress matters more than perfection. Keep going!",
        "Every small step you take brings you closer to your dreams.",
        "You've started something amazing - trust the process!",
        "Your future self will thank you for the effort you're putting in today.",
        "Progress isn't always visible, but it's always happening when you stay consistent.",
        "Every small step you take brings you closer to success.",
        "Champions are made in the moments when no one is watching.",
        "The only impossible journey is the one you never begin.",
        "Your dedication today creates your success tomorrow.",
        "Those who accept defeat can never win, and those who win never accept defeat.",
        "Success is the sum of small efforts repeated daily.",
        "You're stronger than you think and closer than you believe.",
        "Every expert was once a beginner who never gave up.",
        "Today's struggle is tomorrow's strength.",
        "The best view comes after the hardest climb.",
        "Your potential is endless - believe in yourself!",
        "Difficult roads often lead to beautiful destinations.",
        "The path to success is never easy, but not impossible either.",
        "You've overcome challenges before, you'll overcome this too.",
        "Every setback is a setup for a comeback.",
        "Dreams don't have expiration dates - keep pursuing them!",
        "Your commitment today shapes your character tomorrow.",
        "The fruit of hard work is sweet.",
        "The difference between ordinary and extraordinary is practice.",
        "You're not just reaching goals, you're becoming who you're meant to be."
      ],
      tip: [
        "Try breaking your largest goal into 3 smaller, manageable tasks this week.",
        "Set a specific time each day for goal-related activities to build routine.",
        "Use the 2-minute rule: if something takes less than 2 minutes, do it now.",
        "Review your progress weekly and adjust your approach based on what's working.",
        "Celebrate small wins - they compound into major achievements.",
        "Create a morning ritual that energizes you for the day ahead.",
        "Track your energy levels and schedule important tasks during peak times.",
        "Use the Pomodoro Technique: 25 minutes focused work, 5 minute break.",
        "Write down 3 priorities every night for tomorrow.",
        "Break your goals into daily small tasks.",
        "Prepare your workspace the night before to minimize morning friction.",
        "Use accountability partners - share your goals with trusted friends.",
        "Practice the 'one more' principle - always do one more rep, page, or task.",
        "Batch similar tasks together to maintain focus and momentum.",
        "Use time-blocking for time management.",
        "Start with your most challenging task when your energy is highest.",
        "Use visualization techniques to mentally rehearse success.",
        "Create environment cues that trigger positive habits automatically.",
        "Practice the 80/20 rule: focus on the 20% that creates 80% results.",
        "Set aside 10 minutes daily for reflection.",
        "Re-examine your priorities.",
        "Set implementation intentions: 'When X happens, I will do Y.'",
        "Use habit stacking: attach new habits to existing strong ones.",
        "Keep a 'wins journal' to track daily accomplishments.",
        "Apply the 'Swiss cheese' method: poke holes in big projects.",
        "Do your most important work first in the morning.",
        "Use temptation bundling: pair tasks you need to do with things you want to do.",
        "Practice deliberate practice: focus on improving weakest skills.",
        "Create if-then scenarios for common obstacles you face."
      ],
      reminder: [
        "Don't forget to check in on your progress - small adjustments lead to big results.",
        "Your goals need attention today. Which one will you focus on?",
        "Time to review what you've accomplished and plan your next steps.",
        "Your commitment to growth is what sets you apart. Keep it up!",
        "Remember why you started - let that motivation drive you forward today.",
        "Have you celebrated your recent wins? Recognition fuels more success.",
        "It's time for your weekly goal review - what's working and what needs tweaking?",
        "Your future self is counting on the choices you make today.",
        "It's time to work on your goals today.",
        "Don't let perfect be the enemy of good - progress over perfection.",
        "Check your priorities - are your actions aligned with your goals?",
        "Take a moment to appreciate how far you've come since starting.",
        "Your habits are building your future - make today count.",
        "Have you taken any steps towards your dreams today?",
        "Time to water your goals with consistent action today.",
        "Remember: every day is a new opportunity to move closer to your dreams.",
        "Your discipline today creates your freedom tomorrow.",
        "Check your environment - does it support your goals?",
        "Revisit your priorities.",
        "It's not about having time, it's about making time for what matters.",
        "Your goals are waiting - show up for yourself today.",
        "Review your 'why' - is it still motivating you?",
        "Small consistent actions beat sporadic big efforts.",
        "Today's effort is tomorrow's success.",
        "Are you tracking the right metrics for your goals?",
        "Don't forget to rest - recovery is part of progress too.",
        "Your commitment level determines your achievement level.",
        "Time to eliminate one distraction that's holding you back."
      ],
      general: [
        "Focus on progress, not perfection. Every step counts!",
        "Your goals are waiting for your attention. What will you tackle today?",
        "Consistency beats intensity. Small daily actions create lasting results.",
        "You have everything you need to succeed. Trust yourself!",
        "Turn your goals into habits, and success becomes inevitable.",
        "Success is a journey, not a destination. Enjoy the process.",
        "The best time to plant a tree was 20 years ago. The second best time is now.",
        "Your destination is waiting for you.",
        "Growth happens outside your comfort zone. Take that step today.",
        "Your only competition is who you were yesterday.",
        "Excellence is not a skill, it's an attitude.",
        "The gap between where you are and where you want to be is what you do.",
        "Dreaming is free, but hard work is needed to fulfill them.",
        "Every master was once a disaster who kept practicing.",
        "Success is the result of preparation meeting opportunity.",
        "Your mindset determines your reality - think like a winner.",
        "The journey of a thousand miles begins with a single step.",
        "People who succeed keep working.",
        "Challenges are opportunities in disguise. Embrace them.",
        "Your potential is unlimited - the only limits are the ones you accept.",
        "Knowledge without action is useless. Take action today!",
        "The difference between dreams and reality is action.",
        "Every new morning is a new beginning.",
        "Winners are not people who never fail, but people who never quit.",
        "Your habits shape your identity, and your identity shapes your results.",
        "Success isn't given, it's earned through consistent effort.",
        "The road to success is always under construction.",
        "The only way to do great work is to love what you do.",
        "Innovation distinguishes between leaders and followers."
      ],
      health: [
        "Your body is your temple - treat it with respect and care.",
        "Health is not about the weight you lose, it's about the life you gain.",
        "Small healthy choices today create a stronger tomorrow.",
        "A healthy mind resides in a healthy body.",
        "Exercise is a celebration of what your body can do, not punishment.",
        "Drink more water - your body will thank you for it.",
        "Sleep is not a luxury, it's a necessity for optimal performance.",
        "The groundwork for all happiness is good health.",
        "Good health is the greatest wealth.",
        "Take care of your body - it's the only place you have to live.",
        "Healthy habits are investments in your future self.",
        "Your health is an investment, not an expense."
      ],
      productivity: [
        "Productivity is about energy management, not time management.",
        "Focus on being productive instead of busy.",
        "The key is not to prioritize your schedule, but to schedule your priorities.",
        "The quality of work is more important than quantity.",
        "Single-tasking is the new multitasking for maximum effectiveness.",
        "Eliminate, automate, then delegate - in that order.",
        "Your attention is your most valuable asset - protect it fiercely.",
        "Work smarter, not harder - efficiency beats effort.",
        "Adopt time-saving methods.",
        "Done is better than perfect when it comes to getting started.",
        "The most productive people say no to almost everything.",
        "Systems create freedom - build systems for recurring tasks."
      ],
      mindfulness: [
        "Be present - this moment is the only one that truly exists.",
        "Breathe deeply and let go of what you cannot control.",
        "Mindfulness is about being fully awake in our lives.",
        "Peace comes from within. Do not seek it outside.",
        "The present moment is the only moment available to us.",
        "Meditation is not about stopping thoughts, but not being disturbed by them.",
        "Peace comes from within - do not seek it without.",
        "Your breath is your anchor to the present moment.",
        "The joy of life is in living mindfully.",
        "Mindfulness is the basic human ability to be fully present.",
        "The quieter you become, the more you can hear.",
        "In stillness lies the wisdom you seek."
      ]
    };
    
    const suggestionType = (requestData?.type as string) || "general";
    const suggestions = fallbackSuggestions[suggestionType as keyof typeof fallbackSuggestions];
    const randomIndex = Math.floor(Math.random() * suggestions.length);
    const fallbackText = suggestions[randomIndex];
    
    const stmt = c.env.DB.prepare(
      "INSERT INTO ai_suggestions (suggestion_text, suggestion_type, user_id) VALUES (?, ?, ?)"
    );
    const result = await stmt.bind(fallbackText, suggestionType, user?.id || 'anonymous').run();

    const fallbackSuggestion = await c.env.DB.prepare("SELECT * FROM ai_suggestions WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    return c.json({ suggestion: fallbackSuggestion }, 201);
  }
});

app.get("/api/ai-suggestions/recent", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const stmt = c.env.DB.prepare(
      "SELECT * FROM ai_suggestions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5"
    );
    const result = await stmt.bind(user.id).all();
    return c.json({ suggestions: result.results || [] });
  } catch (error) {
    console.error("Error fetching recent AI suggestions:", error);
    return c.json({ error: "Failed to fetch suggestions" }, 500);
  }
});

// Analytics endpoint for progress tracking
app.get("/api/analytics/progress", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const days = parseInt(c.req.query("days") || "30");
    
    // Get completion stats by date
    const stmt = c.env.DB.prepare(`
      SELECT 
        log_date,
        COUNT(*) as total_tasks,
        SUM(is_completed) as completed_tasks,
        ROUND(CAST(SUM(is_completed) AS FLOAT) / COUNT(*) * 100, 2) as completion_rate
      FROM daily_logs 
      WHERE log_date >= date('now', '-${days} days') AND user_id = ?
      GROUP BY log_date 
      ORDER BY log_date ASC
    `);
    
    const result = await stmt.bind(user.id).all();
    return c.json({ progress: result.results || [] });
  } catch (error) {
    console.error("Error fetching progress analytics:", error);
    return c.json({ error: "Failed to fetch progress data" }, 500);
  }
});

// Goal-specific analytics
app.get("/api/analytics/goals", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  try {
    const stmt = c.env.DB.prepare(`
      SELECT 
        g.id,
        g.title,
        g.category,
        g.target_frequency,
        COUNT(dl.id) as total_logs,
        SUM(dl.is_completed) as completed_count,
        ROUND(CAST(SUM(dl.is_completed) AS FLOAT) / COUNT(dl.id) * 100, 2) as completion_rate
      FROM goals g
      LEFT JOIN daily_logs dl ON g.id = dl.goal_id AND dl.user_id = ?
      WHERE g.is_active = 1 AND g.user_id = ?
      GROUP BY g.id, g.title, g.category, g.target_frequency
      ORDER BY completion_rate DESC
    `);
    
    const result = await stmt.bind(user.id, user.id).all();
    return c.json({ goalStats: result.results || [] });
  } catch (error) {
    console.error("Error fetching goal analytics:", error);
    return c.json({ error: "Failed to fetch goal analytics" }, 500);
  }
});

// FAQ endpoints
app.get("/api/faqs", async (c) => {
  try {
    const stmt = c.env.DB.prepare("SELECT * FROM faq_questions WHERE is_active = 1 ORDER BY id ASC");
    const result = await stmt.all();
    return c.json({ faqs: result.results || [] });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return c.json({ error: "Failed to fetch FAQs" }, 500);
  }
});

app.get("/api/faqs/search", async (c) => {
  try {
    const query = c.req.query("q");
    const category = c.req.query("category");
    
    let sql = "SELECT * FROM faq_questions WHERE is_active = 1";
    const params = [];
    
    if (query) {
      sql += " AND (question LIKE ? OR answer LIKE ? OR tags LIKE ?)";
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (category && category !== 'all') {
      sql += " AND category = ?";
      params.push(category);
    }
    
    sql += " ORDER BY id ASC";
    
    const stmt = c.env.DB.prepare(sql);
    const result = await stmt.bind(...params).all();
    return c.json({ faqs: result.results || [] });
  } catch (error) {
    console.error("Error searching FAQs:", error);
    return c.json({ error: "Failed to search FAQs" }, 500);
  }
});

// AI Chat endpoint
app.post("/api/chat", customAuthMiddleware, async (c) => {
  const user = c.get("user")!;
  // Get user's goals and recent activity for better context (outside try block for scope)
  let userGoals: any[] = [];
  let recentActivity: any[] = [];
  
  try {
    const goalsResult = await c.env.DB.prepare(
      "SELECT title, category, target_frequency FROM goals WHERE is_active = 1 AND user_id = ? LIMIT 5"
    ).bind(user.id).all();
    userGoals = goalsResult.results || [];

    const recentLogsResult = await c.env.DB.prepare(
      "SELECT g.title, dl.is_completed, dl.log_date FROM daily_logs dl JOIN goals g ON g.id = dl.goal_id WHERE dl.log_date >= date('now', '-3 days') AND dl.user_id = ? ORDER BY dl.log_date DESC LIMIT 10"
    ).bind(user.id).all();
    recentActivity = recentLogsResult.results || [];
  } catch (dbError) {
    console.error("Error fetching user context:", dbError);
    // Continue with empty arrays if database fails
  }

  try {
    const { message } = await c.req.json();
    
    if (!message || typeof message !== 'string') {
      return c.json({ error: "Message is required" }, 400);
    }

    const openai = new OpenAI({
      apiKey: c.env.A4F_API_KEY,
      baseURL: c.env.A4F_API_BASE,
    });

    // Build contextual information
    let contextualInfo = "";
    if (userGoals.length > 0) {
      contextualInfo += "\nUser's current goals: " + userGoals.map((g: any) => g.title).join(', ');
    }
    if (recentActivity.length > 0) {
      const recentCompletions = recentActivity.filter((a: any) => a.is_completed).length;
      contextualInfo += `\nRecent activity: ${recentCompletions}/${recentActivity.length} goals completed in last 3 days`;
    }

    // Enhanced system prompt for better understanding
    const timestamp = new Date().toISOString();
    const conversationId = Math.random().toString(36).substring(7);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an intelligent, empathetic, and highly capable AI assistant specializing in goal tracking, productivity, and personal development. You understand context, nuance, and can provide meaningful help even with vague or unclear questions.

          Core Principles:
          - Always try to understand what the user really wants, even if their question is unclear
          - Provide helpful, actionable advice tailored to their situation
          - Be encouraging, supportive, and motivational
          - Draw insights from the user's context when available
          - Never ask users to "rephrase" or say you don't understand - always try to help
          - If a question is unclear, make reasonable assumptions and provide the best possible answer
          - Be conversational, warm, and genuinely helpful

          User Context: ${contextualInfo}
          
          Language Detection: Respond in the same language the user uses. If they ask in Hindi, respond in Hindi. If in English, respond in English.
          
          Current timestamp: ${timestamp}
          Conversation ID: ${conversationId}
          
          Remember: Your goal is to be as helpful as possible. Even if a question seems incomplete or unclear, provide the best guidance you can based on context and common sense.`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content || "I'm here to help you. Please tell me what you need.";

    return c.json({ response });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    
    // Contextual and intelligent fallback responses that adapt to user's situation
    const getContextualFallback = (userGoals: any[], recentActivity: any[]) => {
      const hasGoals = userGoals.length > 0;
      const hasActivity = recentActivity.length > 0;
      const completionRate = hasActivity ? (recentActivity.filter((a: any) => a.is_completed).length / recentActivity.length) * 100 : 0;
      
      if (hasGoals && hasActivity) {
        if (completionRate >= 70) {
          return [
            `Great job! You're doing excellent with a ${Math.round(completionRate)}% completion rate. I can help you level up further. What new challenge would you like to take on?`,
            `Great job! You're doing excellent with a ${Math.round(completionRate)}% completion rate. I can help you level up further. What new challenge would you like to take on?`,
            "Great job! You're consistent and results are showing. Let's plan for the next level. What's your strategy?",
          ];
        } else if (completionRate >= 40) {
          return [
            `You're on the right track with ${Math.round(completionRate)}% completion. I can help boost your performance. Where are you facing challenges?`,
            `You're on the right track with ${Math.round(completionRate)}% completion. I can help boost your performance. Where are you facing challenges?`,
            "Your goals are clear and you're making efforts. Let's see how we can make this even more effective.",
          ];
        } else {
          return [
            "I see you have goals but completion is challenging. That's normal! Let me help with better strategies. What's your biggest obstacle?",
            "I see you have goals but completion is challenging. That's normal! Let me help with better strategies. What's your biggest obstacle?",
            "Having goals is great! Now let's focus on execution. I'll give you a step-by-step approach.",
          ];
        }
      } else if (hasGoals) {
        return [
          "Great that you have goals set! Now it's time to start daily tracking. I can give you a simple system to begin.",
          "Great that you have goals set! Now it's time to start daily tracking. I can give you a simple system to begin.",
          "Your goals are ready, now it's time to take action. Big results come from daily small steps.",
        ];
      } else {
        return [
          "Let's start your goal-setting journey! I'll guide you step-by-step. Which area do you want to focus on - health, career, learning, or something else?",
          "Let's start your goal-setting journey! I'll guide you step-by-step. Which area do you want to focus on - health, career, learning, or something else?",
          "Starting something new is exciting! Let's first understand what your priorities are.",
        ];
      }
    };
    
    const intelligentFallbacks = getContextualFallback(userGoals, recentActivity);
    
    // Try to extract some context from the user's message for a better fallback
    let smartFallback;
    try {
      const { message: userMessage } = await c.req.json();
      if (userMessage && typeof userMessage === 'string') {
        // Detect language
        const isHindi = /[\u0900-\u097F]/.test(userMessage) || 
                       userMessage.toLowerCase().includes('hai') || 
                       userMessage.toLowerCase().includes('kya') ||
                       userMessage.toLowerCase().includes('mujhe') ||
                       userMessage.toLowerCase().includes('chahiye');
        
        // Enhanced contextual response based on user's message content and their data
        const hasGoals = userGoals.length > 0;
        const recentCompletions = recentActivity.filter((a: any) => a.is_completed).length;
        const totalRecent = recentActivity.length;
        
        if (userMessage.toLowerCase().includes('goal') || userMessage.toLowerCase().includes('target') || userMessage.toLowerCase().includes('lakshya')) {
          if (hasGoals) {
            smartFallback = isHindi ? 
              `You already have ${userGoals.length} goals set. I can help optimize these or add new ones. Which goal feels most important right now?` :
              `You already have ${userGoals.length} goals set. I can help optimize these or add new ones. Which goal feels most important right now?`;
          } else {
            smartFallback = isHindi ? 
              "Perfect timing! I'm great at goal setting. Let's create your first meaningful goal. Which area of your life would you like to improve?" :
              "Perfect timing! I'm great at goal setting. Let's create your first meaningful goal. Which area of your life would you like to improve?";
          }
        } else if (userMessage.toLowerCase().includes('motivat') || userMessage.toLowerCase().includes('prerana') || userMessage.toLowerCase().includes('inspire')) {
          if (totalRecent > 0 && recentCompletions >= totalRecent * 0.7) {
            smartFallback = isHindi ?
              `Wow! You're already motivated - ${recentCompletions}/${totalRecent} goals completed! Let's build on this momentum. What's your next level?` :
              `Wow! You're already motivated - ${recentCompletions}/${totalRecent} goals completed! Let's build on this momentum. What's your next level?`;
          } else {
            smartFallback = isHindi ?
              "Lack of motivation is normal! I'll give you proven techniques: 1) Find your strong 'why', 2) Celebrate small wins, 3) Make progress visible. Where will you start tomorrow?" :
              "Lack of motivation is normal! I'll give you proven techniques: 1) Find your strong 'why', 2) Celebrate small wins, 3) Make progress visible. Where will you start tomorrow?";
          }
        } else if (userMessage.toLowerCase().includes('time') || userMessage.toLowerCase().includes('manage') || userMessage.toLowerCase().includes('samay') || userMessage.toLowerCase().includes('busy')) {
          smartFallback = isHindi ?
            "Time management is a learnable skill! When are you most productive - morning, afternoon, or evening? Based on that, we'll create your perfect schedule." :
            "Time management is a learnable skill! When are you most productive - morning, afternoon, or evening? Based on that, we'll create your perfect schedule.";
        } else if (userMessage.toLowerCase().includes('help') || userMessage.toLowerCase().includes('madad') || userMessage.toLowerCase().includes('guide')) {
          if (hasGoals) {
            smartFallback = isHindi ?
              `Absolutely will help! You have ${userGoals.length} goals. Which goal would you like to focus on today? Or want to try a new strategy?` :
              `Absolutely will help! You have ${userGoals.length} goals. Which goal would you like to focus on today? Or want to try a new strategy?`;
          } else {
            smartFallback = isHindi ?
              "Helping is my passion! Let's organize your entire life. First tell me - what's your biggest challenge?" :
              "Helping is my passion! Let's organize your entire life. First tell me - what's your biggest challenge?";
          }
        } else if (userMessage.toLowerCase().includes('progress') || userMessage.toLowerCase().includes('track') || userMessage.toLowerCase().includes('pragatі')) {
          if (totalRecent > 0) {
            smartFallback = isHindi ?
              `Great question! Your recent progress: ${recentCompletions}/${totalRecent} completed. That's ${Math.round((recentCompletions/totalRecent)*100)}%. How can we make this even better?` :
              `Great question! Your recent progress: ${recentCompletions}/${totalRecent} completed. That's ${Math.round((recentCompletions/totalRecent)*100)}%. How can we make this even better?`;
          } else {
            smartFallback = isHindi ?
              "Perfect time to start progress tracking! I'll give you a simple but powerful system. You can start today itself!" :
              "Perfect time to start progress tracking! I'll give you a simple but powerful system. You can start today itself!";
          }
        } else {
          // Use contextual fallback based on user's current status
          const contextualOptions = intelligentFallbacks;
          smartFallback = isHindi ? contextualOptions[0] : contextualOptions[1];
        }
      } else {
        smartFallback = intelligentFallbacks[Math.floor(Math.random() * intelligentFallbacks.length)];
      }
    } catch {
      smartFallback = intelligentFallbacks[Math.floor(Math.random() * intelligentFallbacks.length)];
    }
    
    return c.json({ response: smartFallback });
  }
});

export default app;
