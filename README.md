## GoalTracker AI

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

## Demo User Credentials

To test the application, you can use the following demo credentials:

- Email: demo@example.com
- Password: Demo123!
- Name: Demo User

## Running Locally

To run the devserver:
```
npm install
npm run dev
```

## Creating the Demo User

1. Open the application in your browser
2. Click on the "Login / Sign Up" button in the header
3. Toggle to "Sign Up" mode
4. Enter the following details:
   - Name: Demo User
   - Email: demo@example.com
   - Password: Demo123!
   - Confirm Password: Demo123!
5. Click "Sign Up"

## Logging In

After creating the demo user (or if it already exists):

1. Click on the "Login / Sign Up" button in the header
2. Select "Email" login method
3. Enter email: demo@example.com
4. Enter password: Demo123!
5. Click "Login"

## Deployment

This application can be deployed to various platforms. For Vercel deployment:

1. Push this repository to GitHub
2. Connect your GitHub repository to Vercel
3. Configure environment variables in Vercel dashboard:
   - JWT_SECRET (use a strong secret key)
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REDIRECT_URI
4. Deploy!

Note: You may need to modify the database configuration for production use.
